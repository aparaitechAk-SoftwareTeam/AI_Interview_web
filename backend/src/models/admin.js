import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  username: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, unique: true },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["ADMIN"], default: "ADMIN", immutable: true },
  active: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

export const Admin = mongoose.model("Admin", adminSchema);
