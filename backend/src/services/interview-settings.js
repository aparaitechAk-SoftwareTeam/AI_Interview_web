import { AppSetting } from "../models/index.js";

export const DEFAULT_INTERVIEW_SETTINGS = Object.freeze({
  durationMinutes: 20, maxQuestions: 15, adaptiveDifficulty: true, recordingRetentionDays: 90,
  weights: { technical: 35, aptitude: 20, resume: 20, communication: 15, behavioral: 10 }
});

export async function getInterviewSettings() {
  const setting = await AppSetting.findOne({ key: "interview-defaults" }).lean();
  return setting?.value ? { ...DEFAULT_INTERVIEW_SETTINGS, ...setting.value, weights: { ...DEFAULT_INTERVIEW_SETTINGS.weights, ...setting.value.weights } } : DEFAULT_INTERVIEW_SETTINGS;
}
