import { ApiError } from "../../utils/api-error.js";

const PDF = Buffer.from("%PDF-");
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const allowed = new Map([
  ["application/pdf", { format: "pdf", extensions: ["pdf"], matches: (buffer) => buffer.subarray(0, 5).equals(PDF) }],
  ["application/msword", { format: "doc", extensions: ["doc"], matches: (buffer) => buffer.subarray(0, 8).equals(OLE) }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { format: "docx", extensions: ["docx"], matches: (buffer) => buffer.subarray(0, 4).equals(ZIP) }],
  ["image/jpeg", { format: "image", extensions: ["jpg", "jpeg"], matches: (buffer) => buffer.subarray(0, 3).equals(JPEG) }],
  ["image/jpg", { format: "image", extensions: ["jpg", "jpeg"], matches: (buffer) => buffer.subarray(0, 3).equals(JPEG) }],
  ["image/png", { format: "image", extensions: ["png"], matches: (buffer) => buffer.subarray(0, 8).equals(PNG) }],
  ["image/webp", { format: "image", extensions: ["webp"], matches: (buffer) => buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" }],
  ["image/heic", { format: "image", extensions: ["heic"], matches: isHeifFamily }],
  ["image/heif", { format: "image", extensions: ["heif"], matches: isHeifFamily }]
]);

function isHeifFamily(buffer) {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = buffer.subarray(8, 12).toString("ascii");
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
}

export function validateResumeFile(file) {
  if (!file?.buffer?.length) throw new ApiError(400, "FILE_MISSING", "Choose a non-empty PDF, DOC, DOCX, or clear resume photo.");
  const extension = file.originalname.split(".").pop()?.toLowerCase();
  const declared = allowed.get(String(file.mimetype || "").toLowerCase());
  if (!declared || !declared.extensions.includes(extension)) throw new ApiError(415, "INVALID_FILE_TYPE", "Use a valid PDF, DOC, DOCX, JPG, PNG, WEBP, HEIC, or HEIF resume.");
  if (!declared.matches(file.buffer)) throw new ApiError(415, "UNSAFE_FILE", "The uploaded file content does not match its declared resume type.");
  return declared.format;
}

export function canonicalResumeMimeType(mimeType) {
  return String(mimeType || "").toLowerCase() === "image/jpg" ? "image/jpeg" : String(mimeType || "").toLowerCase();
}
