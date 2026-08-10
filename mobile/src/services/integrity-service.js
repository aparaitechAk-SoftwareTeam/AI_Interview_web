import { AppState, BackHandler } from "react-native";

export function monitorInterviewIntegrity(interviewId, sendEvent, onBackAttempt) {
  let previous = AppState.currentState; let backgroundedAt = null;
  const appStateSubscription = AppState.addEventListener("change", (next) => {
    if (previous === "active" && /inactive|background/.test(next)) { backgroundedAt = Date.now(); sendEvent(interviewId, { type: "APP_BACKGROUND", timestamp: new Date().toISOString() }).catch(() => {}); }
    if (backgroundedAt && next === "active") { sendEvent(interviewId, { type: "APP_BACKGROUND", timestamp: new Date().toISOString(), durationMs: Date.now() - backgroundedAt, metadata: { returned: true } }).catch(() => {}); backgroundedAt = null; }
    previous = next;
  });
  const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => { sendEvent(interviewId, { type: "BACK_BUTTON_ATTEMPT", timestamp: new Date().toISOString() }).catch(() => {}); onBackAttempt?.(); return true; });
  return () => { appStateSubscription.remove(); backSubscription.remove(); };
}
