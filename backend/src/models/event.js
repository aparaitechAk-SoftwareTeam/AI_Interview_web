import mongoose from "mongoose";
import { EVENT_TYPES } from "../constants/enums.js";

const eventSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
  type: { type: String, enum: EVENT_TYPES, required: true },
  timestamp: { type: Date, default: Date.now },
  durationMs: { type: Number, min: 0 },
  confidence: { type: Number, min: 0, max: 1 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });

eventSchema.index({ interviewId: 1, timestamp: 1 });
export const InterviewEvent = mongoose.model("InterviewEvent", eventSchema);
