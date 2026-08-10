import { AppState, BackHandler } from "react-native";

export function monitorInterviewIntegrity(interviewId, sendEvent, { onBackAttempt, onBackground, onRecovered } = {}) {
  let previous = AppState.currentState; let backgroundedAt = null;
  const appStateSubscription = AppState.addEventListener("change", (next) => {
    if (previous === "active" && /inactive|background/.test(next)) { backgroundedAt = Date.now(); onBackground?.(); }
    if (backgroundedAt && next === "active") { const durationMs = Date.now() - backgroundedAt; sendEvent(interviewId, { type: "APP_BACKGROUND", timestamp: new Date().toISOString(), durationMs, metadata: { returned: true } }).catch(() => {}); onRecovered?.(durationMs); backgroundedAt = null; }
    previous = next;
  });
  const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => { sendEvent(interviewId, { type: "BACK_BUTTON_ATTEMPT", timestamp: new Date().toISOString() }).catch(() => {}); onBackAttempt?.(); return true; });
  return () => { appStateSubscription.remove(); backSubscription.remove(); };
}
