export function calculateIntegrity(events = []) {
  const weights = { APP_BACKGROUND: 9, MULTIPLE_FACES: 12, FACE_MISSING: 4, GAZE_DEVIATION: 3, RECORDING_INTERRUPTION: 8, CAMERA_INTERRUPTION: 6, MIC_INTERRUPTION: 4 };
  const concern = Math.min(100, events.reduce((score, event) => score + (weights[event.type] || 1) * Math.min(3, 1 + (event.durationMs || 0) / 30000), 0));
  const score = Math.round(100 - concern);
  const label = score >= 85 ? "NORMAL" : score >= 65 ? "LOW_CONCERN" : score >= 40 ? "REVIEW_RECOMMENDED" : "HIGH_CONCERN";
  return { score, label };
}
