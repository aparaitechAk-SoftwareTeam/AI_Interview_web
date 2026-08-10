import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  originalName: { type: String, required: true, maxlength: 180 },
  storageKey: { type: String, required: true, select: false },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  sha256: { type: String, required: true },
  sourceType: { type: String, enum: ["DOCUMENT", "IMAGE_OCR"], default: "DOCUMENT" },
  ocrConfidence: { type: Number, min: 0, max: 100 },
  parseStatus: { type: String, enum: ["PENDING", "PARSED", "FAILED"], default: "PENDING" },
  parseError: { type: String, maxlength: 500 },
  extractedText: { type: String, select: false },
  structuredData: { type: mongoose.Schema.Types.Mixed, default: {} },
  processedAt: Date
}, { timestamps: true, versionKey: false });

resumeSchema.index({ candidateId: 1, createdAt: -1 });
export const Resume = mongoose.model("Resume", resumeSchema);
