import { secureStorage } from "./secure-storage";

const RECOVERY_KEY = "aparaitech.interview-recovery";
const PENDING_ANSWER_KEY = "aparaitech.pending-answer";
const PENDING_RECORDING_KEY = "aparaitech.pending-recording";
const PENDING_EVENTS_KEY = "aparaitech.pending-events";
let pendingEventMutation = Promise.resolve();
const pendingEventId = (value) => value.queueId || `${value.interviewId}:${value.event?.timestamp || "unknown"}:${value.event?.type || "event"}`;
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
  clearPendingRecording: () => secureStorage.remove(PENDING_RECORDING_KEY),
  getPendingEvents: () => pendingEventMutation.catch(() => {}).then(async () => (await readJson(PENDING_EVENTS_KEY)) || []),
  enqueuePendingEvent: (value) => {
    pendingEventMutation = pendingEventMutation.catch(() => {}).then(async () => {
      const current = (await readJson(PENDING_EVENTS_KEY)) || [];
      const queued = { ...value, queueId: pendingEventId(value) };
      if (!current.some((item) => pendingEventId(item) === queued.queueId)) await secureStorage.set(PENDING_EVENTS_KEY, JSON.stringify([...current, queued].slice(-100)));
    });
    return pendingEventMutation;
  },
  removePendingEvents: (queueIds) => {
    pendingEventMutation = pendingEventMutation.catch(() => {}).then(async () => {
      const removed = new Set(queueIds);
      const current = (await readJson(PENDING_EVENTS_KEY)) || [];
      const remaining = current.filter((item) => !removed.has(pendingEventId(item)));
      if (remaining.length) await secureStorage.set(PENDING_EVENTS_KEY, JSON.stringify(remaining));
      else await secureStorage.remove(PENDING_EVENTS_KEY);
    });
    return pendingEventMutation;
  },
  clearPendingEvents: () => secureStorage.remove(PENDING_EVENTS_KEY)
};
