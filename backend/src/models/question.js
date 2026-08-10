import mongoose from "mongoose";
import { DIFFICULTIES, QUESTION_CATEGORIES } from "../constants/enums.js";

const questionSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  category: { type: String, enum: QUESTION_CATEGORIES, required: true },
  difficulty: { type: String, enum: DIFFICULTIES, required: true },
  questionText: { type: String, required: true, maxlength: 1200 },
  generatedFrom: { type: [String], default: [] },
  relatedResumeSection: { type: String, maxlength: 120 },
  expectedConcepts: { type: [String], default: [] },
  rationale: { type: String, maxlength: 500 },
  askedAt: { type: Date, default: Date.now },
  answeredAt: Date,
  followUpOf: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewQuestion" },
  promptFingerprint: { type: String, required: true }
}, { timestamps: true, versionKey: false });

questionSchema.index({ interviewId: 1, sequence: 1 }, { unique: true });
export const InterviewQuestion = mongoose.model("InterviewQuestion", questionSchema);
