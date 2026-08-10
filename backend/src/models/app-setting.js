import mongoose from "mongoose";

const appSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
}, { timestamps: true, versionKey: false });

export const AppSetting = mongoose.model("AppSetting", appSettingSchema);
