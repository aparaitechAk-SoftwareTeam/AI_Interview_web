import { Text, View } from "react-native";
import { colors } from "../theme/colors";

const labels = { AI_SPEAKING: "Speaking", LISTENING: "Listening", PROCESSING: "Thinking", WAITING_FOR_ANSWER: "Ready", WARNING: "Attention", ERROR: "Paused" };
export function InterviewRobot({ state = "WAITING_FOR_ANSWER" }) {
  const active = state === "AI_SPEAKING"; const listening = state === "LISTENING";
  return <View accessibilityLabel={`AI interviewer is ${labels[state] || "ready"}`} style={{ alignItems: "center", gap: 12 }}><View style={{ width: 178, height: 178, borderRadius: 89, backgroundColor: colors.dark, borderWidth: 8, borderColor: active ? colors.cyan : listening ? colors.brand : "#334276", alignItems: "center", justifyContent: "center", boxShadow: active ? "0 0 30px rgba(7,167,201,0.5)" : "0 12px 28px rgba(16,28,68,0.28)" }}><View style={{ flexDirection: "row", gap: 25 }}><View style={{ width: 30, height: 18, borderRadius: 15, backgroundColor: colors.cyan }} /><View style={{ width: 30, height: 18, borderRadius: 15, backgroundColor: colors.cyan }} /></View><View style={{ width: active ? 54 : 32, height: active ? 20 : 8, borderRadius: 16, backgroundColor: "#A5DDF0", marginTop: 28 }} /></View><Text selectable style={{ color: colors.muted, fontWeight: "800" }}>AI INTERVIEWER · {labels[state] || "Ready"}</Text></View>;
}
