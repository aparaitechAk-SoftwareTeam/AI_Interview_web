import { ActivityIndicator, Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";

export function Button({ title, onPress, loading, disabled, variant = "primary" }) {
  const secondary = variant === "secondary"; const danger = variant === "danger";
  const gradient = danger ? ["#D84467", "#9E244D"] : secondary ? ["#0B2452", "#11183F"] : ["#249FFF", "#4D60FF", "#9827E6"];
  const borderColor = danger ? "rgba(255, 145, 164, 0.48)" : secondary ? "rgba(111, 163, 255, 0.48)" : "transparent";
  return <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => ({ borderRadius: 14, borderCurve: "continuous", borderWidth: 1, borderColor, overflow: "hidden", opacity: disabled ? 0.5 : pressed ? 0.82 : 1 })}><LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, boxShadow: secondary ? undefined : "0 9px 22px rgba(63, 86, 255, 0.26)" }}>{loading ? <ActivityIndicator color={colors.white} /> : <Text selectable style={{ color: colors.white, fontWeight: "900", fontSize: 16 }}>{title}</Text>}</LinearGradient></Pressable>;
}
