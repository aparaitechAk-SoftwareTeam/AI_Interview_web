import { secureStorage } from "./secure-storage";

const RECOVERY_KEY = "aparaitech.interview-recovery";
const PENDING_ANSWER_KEY = "aparaitech.pending-answer";
const PENDING_RECORDING_KEY = "aparaitech.pending-recording";
async function readJson(key) {
  const raw = await secureStorage.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { await secureStorage.remove(key); return null; }
}
export const sessionStore = {
  saveRecovery: (value) => secureStorage.set(RECOVERY_KEY, JSON.stringify(value)),
  getRecovery: () => readJson(RECOVERY_KEY),
  clearRecovery: () => secureStorage.remove(RECOVERY_KEY),
  savePendingAnswer: (value) => secureStorage.set(PENDING_ANSWER_KEY, JSON.stringify(value)),
  getPendingAnswer: () => readJson(PENDING_ANSWER_KEY),
  clearPendingAnswer: () => secureStorage.remove(PENDING_ANSWER_KEY),
  savePendingRecording: (value) => secureStorage.set(PENDING_RECORDING_KEY, JSON.stringify(value)),
  getPendingRecording: () => readJson(PENDING_RECORDING_KEY),
  clearPendingRecording: () => secureStorage.remove(PENDING_RECORDING_KEY)
};
