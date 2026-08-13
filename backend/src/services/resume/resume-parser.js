import path from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import { storage } from "../storage/index.js";
import { extractVisualResume } from "../ai/visual-resume-service.js";
import { extractLocalImageText } from "./local-image-ocr.js";
import { ApiError } from "../../utils/api-error.js";

const knownSkills = ["JavaScript", "TypeScript", "React", "React Native", "Node.js", "Express", "MongoDB", "SQL", "Python", "Java", "C++", "AWS", "Docker", "Git", "Figma", "Flutter", "Angular", "Next.js"];
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function linesAfter(text, label) { const match = text.match(new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]+)`, "i")); return match ? match[1].split(/[,|•]/).map((x) => x.trim()).filter(Boolean) : []; }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function isRecoverableAiError(error) { return error instanceof ApiError && ["AI_RATE_LIMITED", "AI_UNAVAILABLE", "AI_INVALID_RESPONSE", "AI_DISABLED", "AI_NOT_CONFIGURED"].includes(error.code); }

export function structureResume(text) {
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
  const phones = text.match(/(?:\+?\d[\d\s()-]{8,}\d)/g) || [];
  const skills = unique(knownSkills.filter((skill) => new RegExp(`\\b${escapeRegex(skill)}\\b`, "i").test(text)).concat(linesAfter(text, "skills")));
  return {
    candidateName: text.split(/\n/).map((line) => line.trim()).find((line) => /^[A-Za-z][A-Za-z .'-]{2,80}$/.test(line)) || "",
    email: emails[0] || "", phone: phones[0]?.trim() || "", skills,
    programmingLanguages: skills.filter((x) => ["JavaScript", "TypeScript", "Python", "Java", "C++"].includes(x)),
    frameworks: skills.filter((x) => ["React", "React Native", "Express", "Flutter", "Angular", "Next.js"].includes(x)),
    tools: skills.filter((x) => ["Git", "Docker", "Figma", "AWS"].includes(x)),
    databases: skills.filter((x) => ["MongoDB", "SQL"].includes(x)),
    projects: linesAfter(text, "projects"), internships: linesAfter(text, "internships"), workExperience: linesAfter(text, "experience"),
    education: linesAfter(text, "education"), certifications: linesAfter(text, "certifications"), achievements: linesAfter(text, "achievements"),
    strengths: [], technologies: skills
  };
}

export async function parseImageResume({ buffer, mimeType }, { visualExtractor = extractVisualResume, localExtractor = extractLocalImageText } = {}) {
  try {
    return await visualExtractor({ buffer, mimeType });
  } catch (error) {
    if (!isRecoverableAiError(error)) throw error;
    const local = await localExtractor(buffer);
    return { ...local, structuredData: structureResume(local.extractedText) };
  }
}

export async function parseResume({ storageKey, format, mimeType }) {
  const buffer = await storage.readBuffer(storageKey);
  if (format === "image") return parseImageResume({ buffer, mimeType });
  let text;
  if (format === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else if (format === "docx") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    const tempPath = await storage.getPath(storageKey);
    const document = await new WordExtractor().extract(path.resolve(tempPath));
    text = document.getBody();
  }
  if (!text?.trim() || text.trim().length < 12) {
    if (format === "pdf") return extractVisualResume({ buffer, mimeType });
    throw new Error("No readable resume text was found.");
  }
  return { extractedText: text.slice(0, 100000), structuredData: structureResume(text) };
}
