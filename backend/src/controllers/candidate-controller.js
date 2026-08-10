import fs from "node:fs";
import crypto from "node:crypto";
import { Candidate, Resume } from "../models/index.js";
import { CandidateStatus } from "@aparaitech/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { canonicalResumeMimeType, validateResumeFile } from "../services/resume/file-validation.js";
import { parseResume } from "../services/resume/resume-parser.js";
import { storage } from "../services/storage/local-storage.js";
import { assertCandidateId } from "../middleware/candidate-scope.js";

const publicStatus = (candidate) => ({ id: candidate.id, fullName: candidate.fullName, position: candidate.position, status: candidate.status, updatedAt: candidate.updatedAt });

export const status = asyncHandler(async (req, res) => res.json({ candidate: publicStatus(req.candidate) }));

export const uploadResume = asyncHandler(async (req, res) => {
  assertCandidateId(req, req.params.candidateId);
  const format = validateResumeFile(req.file);
  const mimeType = canonicalResumeMimeType(req.file.mimetype);
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
  const key = `resumes/${req.candidate.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  await storage.putBuffer(key, req.file.buffer);
  const resume = await Resume.create({ candidateId: req.candidate.id, originalName: safeName, storageKey: key, mimeType, fileSize: req.file.size, sha256: checksum, sourceType: format === "image" ? "IMAGE_OCR" : "DOCUMENT" });
  try {
    const parsed = await parseResume({ storageKey: key, format, mimeType });
    resume.parseStatus = "PARSED"; resume.extractedText = parsed.extractedText; resume.structuredData = parsed.structuredData; resume.ocrConfidence = parsed.ocrConfidence; if (parsed.ocrConfidence !== undefined) resume.sourceType = "IMAGE_OCR"; resume.processedAt = new Date(); await resume.save();
  } catch (error) {
    resume.parseStatus = "FAILED"; resume.parseError = error instanceof ApiError ? error.message : "Resume could not be parsed. Upload a readable PDF, DOC, DOCX, or a clear resume photo."; await resume.save();
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, "RESUME_PARSE_FAILED", resume.parseError);
  }
  req.candidate.resumeId = resume._id; req.candidate.status = CandidateStatus.READY_FOR_INTERVIEW; await req.candidate.save();
  res.status(201).json({ resume: { id: resume.id, originalName: resume.originalName, parseStatus: resume.parseStatus, structuredData: resume.structuredData } });
});

export const downloadOwnResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.resumeId, candidateId: req.candidate._id }).select("+storageKey");
  if (!resume) throw new ApiError(404, "RESUME_NOT_FOUND", "Resume was not found.");
  const target = await storage.getPath(resume.storageKey);
  if (!fs.existsSync(target)) throw new ApiError(404, "FILE_NOT_FOUND", "Resume file is unavailable.");
  res.setHeader("Content-Type", resume.mimeType); res.setHeader("Content-Disposition", `attachment; filename="${resume.originalName}"`); fs.createReadStream(target).pipe(res);
});
