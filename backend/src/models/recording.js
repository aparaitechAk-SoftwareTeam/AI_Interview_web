import mongoose from "mongoose";

const recordingSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  storageKey: { type: String, select: false },
  mimeType: String,
  fileSize: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
  status: { type: String, enum: ["NOT_STARTED", "UPLOADING", "READY", "FAILED", "DELETED"], default: "NOT_STARTED" },
  chunks: [{ index: Number, size: Number, sha256: String, receivedAt: Date }],
  expectedChunks: { type: Number, min: 1, max: 10001 },
  expectedBytes: { type: Number, min: 1 },
  lastError: { type: String, maxlength: 500 },
  finalizedAt: Date,
  retentionUntil: Date,
  deletedAt: Date,
  deleteReason: { type: String, maxlength: 300 }
}, { timestamps: true, versionKey: false });

export const InterviewRecording = mongoose.model("InterviewRecording", recordingSchema);
