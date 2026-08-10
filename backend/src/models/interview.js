import mongoose from "mongoose";
import { InterviewStatus } from "@aparaitech/shared";

const interviewSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
  invitationId: { type: mongoose.Schema.Types.ObjectId, ref: "Invitation", required: true },
  status: { type: String, enum: Object.values(InterviewStatus), default: InterviewStatus.READY, index: true },
  startedAt: Date,
  completedAt: Date,
  terminatedAt: Date,
  terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  terminationReason: { type: String, maxlength: 500 },
  durationSeconds: { type: Number, default: 0 },
  configuration: {
    durationMinutes: { type: Number, default: 20, min: 5, max: 60 },
    maxQuestions: { type: Number, default: 15, min: 5, max: 30 },
    adaptiveDifficulty: { type: Boolean, default: true },
    recordingRetentionDays: { type: Number, default: 90, min: 1, max: 365 },
    weights: {
      technical: { type: Number, default: 35 },
      aptitude: { type: Number, default: 20 },
      resume: { type: Number, default: 20 },
      communication: { type: Number, default: 15 },
      behavioral: { type: Number, default: 10 }
    }
  },
  currentQuestionIndex: { type: Number, default: 0 },
  state: {
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD"], default: "MEDIUM" },
    topicHistory: { type: [String], default: [] },
    weakAreas: { type: [String], default: [] },
    strongAreas: { type: [String], default: [] },
    followUpCount: { type: Number, default: 0 },
    lastSyncedAt: Date
  },
  scores: { type: mongoose.Schema.Types.Mixed, default: {} },
  finalAssessment: { type: mongoose.Schema.Types.Mixed },
  aiRecommendation: { type: String, enum: ["STRONGLY_QUALIFY", "QUALIFY", "BORDERLINE", "REVIEW_REQUIRED", "NOT_RECOMMENDED"] },
  integrity: { score: { type: Number, min: 0, max: 100 }, label: { type: String, enum: ["NORMAL", "LOW_CONCERN", "REVIEW_RECOMMENDED", "HIGH_CONCERN"] } },
  recordingId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewRecording" },
  adminDecisionId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminDecision" }
}, { timestamps: true, versionKey: false });

interviewSchema.index({ candidateId: 1, status: 1 });
export const Interview = mongoose.model("Interview", interviewSchema);
