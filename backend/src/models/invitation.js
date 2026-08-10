import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  active: { type: Boolean, default: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  maxAttempts: { type: Number, default: 8, min: 1, max: 20 },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  singleUse: { type: Boolean, default: false },
  usedAt: Date,
  revokedAt: Date,
  reattemptCount: { type: Number, default: 0 },
  lastVerifiedAt: Date
}, { timestamps: true, versionKey: false });

export const Invitation = mongoose.model("Invitation", invitationSchema);
