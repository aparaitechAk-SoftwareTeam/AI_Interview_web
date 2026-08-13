import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import { z } from "zod";
import { ApiError } from "../../utils/api-error.js";
import { env } from "../../config/env.js";
import { GeminiProvider } from "../ai/gemini-provider.js";
import { extractLocalImageText } from "../resume/local-image-ocr.js";

const MAX_ROWS = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s()-]{6,20}[0-9]$/;
const headerAliases = {
  serial: ["serial", "sr", "sr no", "sr.no", "s no", "no", "roll no", "student id"],
  fullName: ["name", "full name", "candidate", "candidate name", "student", "student name"],
  email: ["email", "email id", "mail", "mail id", "e-mail"],
  phone: ["phone", "phone no", "mobile", "mobile no", "contact", "contact no", "whatsapp", "whatsapp no"],
  position: ["position", "role", "job role", "internship", "applied for"],
  college: ["college", "institute", "university"],
  qualification: ["qualification", "degree", "education"]
};

const aiRowsSchema = z.object({ rows: z.array(z.object({
  serial: z.string().max(40), fullName: z.string().max(160), email: z.string().max(254), phone: z.string().max(80),
  position: z.string().max(160), college: z.string().max(160), qualification: z.string().max(160)
}).strict()).max(MAX_ROWS) }).strict();

function normalizeHeader(value) { return String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9. ]/g, "").replace(/\s+/g, " ").trim(); }
function clean(value, max = 160) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max); }
function normalizePhone(value) { return clean(value, 30).replace(/^00/, "+"); }
function fieldForHeader(value) {
  const header = normalizeHeader(value);
  return Object.entries(headerAliases).find(([, aliases]) => aliases.includes(header))?.[0];
}

function validateRow(raw, index, defaults = {}) {
  const row = {
    serial: clean(raw.serial || index + 1, 40), fullName: clean(raw.fullName, 120), email: clean(raw.email, 254).toLowerCase(),
    phone: normalizePhone(raw.phone), position: clean(raw.position || defaults.position, 160), college: clean(raw.college, 160), qualification: clean(raw.qualification, 160)
  };
  const errors = [];
  if (row.fullName.length < 2) errors.push("Full name is required");
  if (!EMAIL.test(row.email)) errors.push("Valid email is required");
  if (!PHONE.test(row.phone)) errors.push("Valid phone/WhatsApp number is required");
  return { rowNumber: index + 1, ...row, valid: errors.length === 0, errors };
}

function rowsFromGrid(grid, defaults) {
  const nonEmpty = grid.map((row) => row.map((cell) => clean(cell, 500))).filter((row) => row.some(Boolean));
  if (!nonEmpty.length) return [];
  let headerIndex = nonEmpty.findIndex((row) => row.filter((cell) => fieldForHeader(cell)).length >= 2);
  if (headerIndex < 0) headerIndex = 0;
  const headers = nonEmpty[headerIndex].map(fieldForHeader);
  const hasMappedHeaders = headers.filter(Boolean).length >= 2;
  const data = hasMappedHeaders ? nonEmpty.slice(headerIndex + 1) : nonEmpty;
  return data.slice(0, MAX_ROWS).map((cells, index) => {
    const raw = {};
    if (hasMappedHeaders) headers.forEach((field, column) => { if (field) raw[field] = cells[column]; });
    else [raw.serial, raw.fullName, raw.email, raw.phone, raw.position, raw.college, raw.qualification] = cells;
    return validateRow(raw, index, defaults);
  }).filter((row) => row.fullName || row.email || row.phone);
}

function splitLine(line) {
  if (line.includes("\t")) return line.split(/\t+/);
  if (line.includes("|")) return line.split("|");
  if ((line.match(/,/g) || []).length >= 2) return line.split(",");
  return line.trim().split(/\s{2,}/);
}

function rowsFromText(text, defaults) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const grid = lines.map(splitLine);
  const mapped = rowsFromGrid(grid, defaults);
  if (mapped.some((row) => row.valid)) return mapped;
  const discovered = [];
  for (const line of lines) {
    const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const phone = line.match(/(?:\+?\d[\d\s()-]{7,}\d)/)?.[0];
    if (!email && !phone) continue;
    const beforeEmail = email ? line.slice(0, line.indexOf(email)) : line.slice(0, line.indexOf(phone));
    const fullName = beforeEmail.replace(/^\s*\d+[.)-]?\s*/, "").replace(/[|,;:-]+\s*$/, "").trim();
    discovered.push({ fullName, email, phone });
  }
  return discovered.slice(0, MAX_ROWS).map((row, index) => validateRow(row, index, defaults));
}

function mimeAndFormat(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();
  const formats = { ".xlsx": "xlsx", ".csv": "csv", ".pdf": "pdf", ".docx": "docx", ".doc": "doc", ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image" };
  const format = formats[extension];
  if (!file.buffer?.length || !format) throw new ApiError(415, "BULK_FILE_INVALID", "Upload XLSX, CSV, PDF, DOC, DOCX, JPG, PNG, or WEBP only.");
  const signatures = {
    xlsx: () => file.buffer.subarray(0, 2).toString("ascii") === "PK",
    docx: () => file.buffer.subarray(0, 2).toString("ascii") === "PK",
    pdf: () => file.buffer.subarray(0, 5).toString("ascii") === "%PDF-",
    doc: () => file.buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    image: () => file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || (file.buffer.subarray(0, 4).toString("ascii") === "RIFF" && file.buffer.subarray(8, 12).toString("ascii") === "WEBP"),
    csv: () => !file.buffer.subarray(0, Math.min(file.buffer.length, 4096)).includes(0)
  };
  if (!signatures[format]()) throw new ApiError(415, "BULK_FILE_MISMATCH", "The uploaded content does not match its file extension. Export a fresh XLSX, CSV, PDF, DOC/DOCX, JPG, PNG, or WEBP file.");
  return { format, mimeType: mimeType || ({ ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extension]) };
}

async function textFromDoc(buffer) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aparaitech-bulk-"));
  const file = path.join(directory, "candidates.doc");
  try { await fs.writeFile(file, buffer); return (await new WordExtractor().extract(file)).getBody(); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function scanVisualWithAi(file, mimeType, defaults) {
  if (env.AI_PROVIDER !== "gemini") throw new ApiError(422, "BULK_SCAN_UNREADABLE", "This scan has no selectable text. Upload a clear image or a text-based PDF.");
  return (await new GeminiProvider().generateJson({
    contents: [
      { inlineData: { mimeType, data: file.buffer.toString("base64") } },
      { text: "Read this candidate roster exactly as visible. Never invent or merge people. Return one row per person with serial, fullName, email, phone, position, college and qualification. Use empty strings for missing cells. Return JSON only." }
    ], schema: aiRowsSchema, label: "Candidate roster scanner", useResponseSchema: false
  })).rows.map((row, index) => validateRow(row, index, defaults));
}

export async function scanCandidateFile(file, defaults = {}) {
  const { format, mimeType } = mimeAndFormat(file);
  let rows = [];
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ApiError(422, "BULK_SHEET_EMPTY", "The workbook has no worksheet.");
    const grid = []; sheet.eachRow({ includeEmpty: false }, (row) => grid.push(row.values.slice(1).map((value) => value?.text || value?.result || value)));
    rows = rowsFromGrid(grid, defaults);
  } else if (format === "csv") rows = rowsFromText(file.buffer.toString("utf8"), defaults);
  else if (format === "docx") rows = rowsFromText((await mammoth.extractRawText({ buffer: file.buffer })).value, defaults);
  else if (format === "doc") rows = rowsFromText(await textFromDoc(file.buffer), defaults);
  else if (format === "image") {
    try {
      rows = rowsFromText((await extractLocalImageText(file.buffer)).extractedText, defaults);
      if (!rows.some((row) => row.valid)) rows = await scanVisualWithAi(file, mimeType, defaults);
    } catch { rows = await scanVisualWithAi(file, mimeType, defaults); }
  } else {
    const parser = new PDFParse({ data: file.buffer }); let text = "";
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
    rows = text.trim().length >= 10 ? rowsFromText(text, defaults) : [];
    if (!rows.some((row) => row.valid)) rows = await scanVisualWithAi(file, mimeType || "application/pdf", defaults);
  }
  if (!rows.length) throw new ApiError(422, "BULK_NO_CANDIDATES", "No candidate rows were found. Follow the sample column order and upload a clearer file.");
  const seenEmails = new Set(); const seenPhones = new Set();
  rows = rows.map((row) => {
    const errors = [...row.errors];
    if (row.email && seenEmails.has(row.email)) errors.push("Duplicate email in this file");
    if (row.phone && seenPhones.has(row.phone.replace(/\D/g, ""))) errors.push("Duplicate phone in this file");
    if (row.email) seenEmails.add(row.email); if (row.phone) seenPhones.add(row.phone.replace(/\D/g, ""));
    return { ...row, valid: errors.length === 0, errors };
  });
  return { fileName: clean(file.originalname, 180), total: rows.length, valid: rows.filter((row) => row.valid).length, invalid: rows.filter((row) => !row.valid).length, rows };
}

export const candidateImportRow = z.object({
  serial: z.string().trim().max(40).optional(), fullName: z.string().trim().min(2).max(120), email: z.string().email(), phone: z.string().trim().min(7).max(30),
  position: z.string().trim().max(160).optional(), college: z.string().trim().max(160).optional(), qualification: z.string().trim().max(160).optional()
}).strict();
