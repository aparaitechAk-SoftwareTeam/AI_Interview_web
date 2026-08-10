import mongoose from "mongoose";
import { CandidateStatus } from "@aparaitech/shared";

const candidateSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  college: { type: String, trim: true, maxlength: 160 },
  qualification: { type: String, trim: true, maxlength: 160 },
  position: { type: String, trim: true, maxlength: 160 },
  notes: { type: String, trim: true, maxlength: 2000, select: false },
  invitationId: { type: mongoose.Schema.Types.ObjectId, ref: "Invitation", index: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
  currentInterviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview" },
  status: { type: String, enum: Object.values(CandidateStatus), default: CandidateStatus.INVITED, index: true },
  sessionVersion: { type: Number, default: 0 },
  consent: {
    acceptedAt: Date,
    version: String,
    recording: Boolean,
    camera: Boolean,
    microphone: Boolean,
    monitoring: Boolean
  }
}, { timestamps: true, versionKey: false });

candidateSchema.index({ email: 1, createdAt: -1 });
export const Candidate = mongoose.model("Candidate", candidateSchema);
