import { ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { screenContent } from "../theme/styles";

export function Screen({ children, scroll = true, style }) {
  if (!scroll) return <View style={[styles.root, style]}><LinearGradient colors={["#020817", "#061637", "#100A38"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} /><StatusBar style="light" />{children}</View>;
  return <View style={styles.root}><LinearGradient colors={["#020817", "#061637", "#100A38"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} /><StatusBar style="light" /><ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scroll} contentContainerStyle={[screenContent, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background }, scroll: { flex: 1 } });
