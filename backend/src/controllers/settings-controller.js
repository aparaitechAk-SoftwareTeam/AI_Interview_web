import { AppSetting } from "../models/index.js";
import { asyncHandler } from "../utils/async-handler.js";
import { writeAudit } from "../utils/audit.js";
import { getInterviewSettings } from "../services/interview-settings.js";
import { interviewSettings } from "../validators/request.js";

export const getSettings = asyncHandler(async (_req, res) => res.json({ settings: await getInterviewSettings() }));
export const updateSettings = asyncHandler(async (req, res) => {
  const value = interviewSettings.parse(req.body);
  const setting = await AppSetting.findOneAndUpdate({ key: "interview-defaults" }, { value, updatedBy: req.auth.sub }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await writeAudit({ adminId: req.auth.sub, action: "INTERVIEW_SETTINGS_UPDATED", resourceType: "AppSetting", resourceId: setting.id, metadata: { durationMinutes: value.durationMinutes, maxQuestions: value.maxQuestions }, ip: req.ip });
  res.json({ settings: setting.value });
});
