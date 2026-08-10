import { Text, View } from "react-native";

const palette = { success: ["rgba(27, 144, 91, 0.18)", "#8DEEC0"], warning: ["rgba(217, 144, 24, 0.18)", "#FFD185"], danger: ["rgba(217, 45, 72, 0.18)", "#FFABB9"], info: ["rgba(65, 112, 255, 0.18)", "#AFC8FF"] };
export function StatusPill({ children, tone = "info" }) { const [backgroundColor, color] = palette[tone] || palette.info; return <View style={{ alignSelf: "flex-start", backgroundColor, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}><Text selectable style={{ color, fontWeight: "800", fontSize: 12 }}>{children}</Text></View>; }
