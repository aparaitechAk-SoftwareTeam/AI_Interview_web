import { secureStorage } from "./secure-storage";

const RECOVERY_KEY = "aparaitech.interview-recovery";
const PENDING_ANSWER_KEY = "aparaitech.pending-answer";
const PENDING_RECORDING_KEY = "aparaitech.pending-recording";
export const sessionStore = {
  saveRecovery: (value) => secureStorage.set(RECOVERY_KEY, JSON.stringify(value)),
  getRecovery: async () => { const raw = await secureStorage.get(RECOVERY_KEY); return raw ? JSON.parse(raw) : null; },
  clearRecovery: () => secureStorage.remove(RECOVERY_KEY),
  savePendingAnswer: (value) => secureStorage.set(PENDING_ANSWER_KEY, JSON.stringify(value)),
  getPendingAnswer: async () => { const raw = await secureStorage.get(PENDING_ANSWER_KEY); return raw ? JSON.parse(raw) : null; },
  clearPendingAnswer: () => secureStorage.remove(PENDING_ANSWER_KEY),
  savePendingRecording: (value) => secureStorage.set(PENDING_RECORDING_KEY, JSON.stringify(value)),
  getPendingRecording: async () => { const raw = await secureStorage.get(PENDING_RECORDING_KEY); return raw ? JSON.parse(raw) : null; },
  clearPendingRecording: () => secureStorage.remove(PENDING_RECORDING_KEY)
};
