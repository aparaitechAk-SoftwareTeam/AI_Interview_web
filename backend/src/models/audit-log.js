import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, immutable: true },
  action: { type: String, required: true, immutable: true, maxlength: 100 },
  resourceType: { type: String, required: true, immutable: true, maxlength: 80 },
  resourceId: { type: String, required: true, immutable: true, maxlength: 80 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  ip: { type: String, immutable: true, maxlength: 80 }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

auditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"], function rejectMutation() {
  throw new Error("Audit records are append-only");
});
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
