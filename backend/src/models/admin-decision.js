import mongoose from "mongoose";
import { DECISIONS } from "../constants/enums.js";

const decisionSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  aiRecommendation: String,
  decision: { type: String, enum: DECISIONS, required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  comment: { type: String, trim: true, maxlength: 2000 },
  candidateFeedback: { type: String, trim: true, maxlength: 1500 },
  decisionAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

export const AdminDecision = mongoose.model("AdminDecision", decisionSchema);
