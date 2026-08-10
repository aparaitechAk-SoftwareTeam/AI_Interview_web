import { Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";

export function Field({ label, error, ...props }) {
  const borderColors = error ? ["#FF8898", "#D83C66"] : ["#26C5FF", "#466CFF", "#A53CF2"];
  return <View style={{ gap: 7 }}><Text selectable style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{label}</Text><LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, padding: 1 }}><TextInput placeholderTextColor="#7789AA" style={{ minHeight: 52, backgroundColor: "#06152E", borderRadius: 13, borderCurve: "continuous", color: colors.text, paddingHorizontal: 14, fontSize: 16 }} {...props} /></LinearGradient>{error ? <Text selectable style={{ color: colors.danger }}>{error}</Text> : null}</View>;
}
