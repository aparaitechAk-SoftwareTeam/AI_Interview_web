import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewQuestion", required: true, unique: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
  transcript: { type: String, required: true, minlength: 1, maxlength: 12000 },
  transcriptConfidence: { type: Number, min: 0, max: 1 },
  source: { type: String, enum: ["SPEECH", "MANUAL"], default: "SPEECH" },
  evaluation: { type: mongoose.Schema.Types.Mixed, required: true },
  idempotencyKey: { type: String, required: true, maxlength: 128 },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

answerSchema.index({ interviewId: 1, idempotencyKey: 1 }, { unique: true });
export const InterviewAnswer = mongoose.model("InterviewAnswer", answerSchema);
