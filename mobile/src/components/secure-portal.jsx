import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const heroImage = require("../../assets/images/interview-hero-v2.png");
const brandLogo = require("../../assets/images/aparaitech-interview-logo.png");

export const portal = {
  background: "#020817",
  surface: "rgba(7, 22, 47, 0.9)",
  border: "rgba(116, 149, 205, 0.26)",
  heading: "#F7F9FF",
  body: "#AAB8D3",
  quiet: "#7787A6",
  blue: "#4A9DFF",
  violet: "#A646F4",
  red: "#FF9B9B"
};

export function SecurePortal({ routeTitle, eyebrow, heading, description, accent = "blue", children }) {
  const accentColor = accent === "violet" ? "#B765FF" : "#65B6FF";
  return <View style={styles.root}>
    <StatusBar style="light" />
    <LinearGradient colors={["#020817", "#041333", "#09164A", "#110B3D"]} locations={[0, 0.38, 0.76, 1]} style={StyleSheet.absoluteFill} />
    <View style={styles.topGlow} /><View style={styles.bottomGlow} />
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backArrow}>←</Text><Text selectable style={styles.backText}>Home</Text>
          </Pressable>
          <View style={styles.routeMark}><Image source={brandLogo} contentFit="contain" style={styles.routeMarkImage} accessibilityLabel="Aparaitech AI Interview logo" /><Text selectable style={styles.routeTitle}>{routeTitle}</Text></View>
        </View>

        <View style={styles.hero}>
          <Image source={heroImage} contentFit="contain" style={styles.heroArt} accessible={false} />
          <View style={styles.heroCopy}>
            <Text selectable style={[styles.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
            <Text selectable style={styles.heading}>{heading}</Text>
            <Text selectable style={styles.description}>{description}</Text>
          </View>
        </View>

        {children}
        <Text selectable style={styles.footer}>Protected by Aparaitech secure interview systems</Text>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

export function PortalCard({ children, style, accent = "blue" }) {
  const border = accent === "violet" ? "rgba(186, 98, 255, 0.38)" : portal.border;
  return <View style={[styles.card, { borderColor: border }, style]}>{children}</View>;
}

export function PortalIcon({ symbol, tone = "blue" }) {
  const colors = tone === "violet" ? ["#C55BFF", "#6824D7"] : ["#3CC2FF", "#3457EA"];
  return <LinearGradient colors={colors} style={styles.iconOrb}><Text style={styles.iconSymbol}>{symbol}</Text></LinearGradient>;
}

export function PortalField({ label, icon = "◇", error, style, ...props }) {
  return <View style={[styles.field, style]}>
    <Text selectable style={styles.fieldLabel}>{label}</Text>
    <LinearGradient colors={error ? ["#FF7F86", "#D93859"] : ["#31C5FF", "#396BFF", "#A13BF1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fieldBorder}>
      <View style={styles.fieldShell}>
        <Text style={styles.fieldIcon}>{icon}</Text>
        <TextInput placeholderTextColor="#7789AA" selectionColor="#80BFFF" style={styles.fieldInput} {...props} />
      </View>
    </LinearGradient>
    {error ? <Text selectable style={styles.inlineError}>{error}</Text> : null}
  </View>;
}

export function PortalError({ message }) {
  if (!message) return null;
  return <View style={styles.errorBox}><Text style={styles.errorSymbol}>!</Text><Text selectable style={styles.errorText}>{message}</Text></View>;
}

export function PortalButton({ title, onPress, loading, disabled, variant = "blue", accessibilityLabel }) {
  const colors = variant === "violet" ? ["#7C36F0", "#B42BE7"] : ["#279DFF", "#475DFF", "#9729E8"];
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.buttonPressable, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
      <Text style={styles.buttonArrow}>{loading ? "…" : "→"}</Text><Text selectable style={styles.buttonText}>{loading ? "Please wait" : title}</Text>
    </LinearGradient>
  </Pressable>;
}

export function PortalOutlineButton({ title, onPress, accessibilityLabel }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} onPress={onPress} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}><Text style={styles.outlineButtonText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: portal.background, overflow: "hidden" },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28, gap: 18 },
  topGlow: { position: "absolute", top: 95, right: 0, width: 160, height: 270, borderRadius: 135, backgroundColor: "rgba(42, 92, 255, 0.16)", boxShadow: "0 0 90px rgba(47, 93, 255, 0.22)" },
  bottomGlow: { position: "absolute", bottom: 0, left: 0, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(151, 42, 236, 0.1)", boxShadow: "0 0 80px rgba(145, 48, 255, 0.21)" },
  nav: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 39, paddingHorizontal: 7, borderRadius: 20 },
  backArrow: { color: "#C6D7F4", fontSize: 25, lineHeight: 28 },
  backText: { color: "#C6D7F4", fontSize: 13, fontWeight: "700" },
  routeMark: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeMarkImage: { width: 32, height: 32, borderRadius: 10 },
  routeTitle: { color: "#EAF0FF", fontSize: 14, fontWeight: "800" },
  hero: { minHeight: 235, position: "relative", justifyContent: "flex-end", overflow: "hidden" },
  heroArt: { position: "absolute", width: 255, height: 205, top: 10, right: -4, opacity: 0.9 },
  heroCopy: { width: "68%", paddingBottom: 7, zIndex: 1 },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
  heading: { color: portal.heading, fontSize: 32, lineHeight: 39, fontWeight: "900", letterSpacing: -0.8 },
  description: { color: portal.body, fontSize: 15, lineHeight: 23, marginTop: 10 },
  card: { backgroundColor: portal.surface, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, padding: 19, gap: 17, boxShadow: "0 14px 36px rgba(0, 0, 0, 0.22)" },
  iconOrb: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", boxShadow: "0 8px 22px rgba(43, 91, 255, 0.3)" },
  iconSymbol: { color: "#F6FAFF", fontSize: 27, lineHeight: 31 },
  field: { gap: 8 },
  fieldLabel: { color: "#EAF0FF", fontSize: 14, fontWeight: "800" },
  fieldBorder: { padding: 1, borderRadius: 14 },
  fieldShell: { minHeight: 60, borderRadius: 13, backgroundColor: "#06152E", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 11 },
  fieldIcon: { color: "#A7C1EE", fontSize: 22, lineHeight: 26 },
  fieldInput: { color: portal.heading, fontSize: 16, flex: 1, minHeight: 58 },
  inlineError: { color: portal.red, fontSize: 12, lineHeight: 17 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255, 113, 119, 0.58)", backgroundColor: "rgba(112, 23, 41, 0.3)", padding: 13 },
  errorSymbol: { width: 19, height: 19, borderRadius: 10, overflow: "hidden", textAlign: "center", textAlignVertical: "center", color: "#FFE8E8", fontWeight: "900", backgroundColor: "#D7405B" },
  errorText: { color: "#FFB8B8", flex: 1, fontSize: 13, lineHeight: 19 },
  buttonPressable: { borderRadius: 14 },
  button: { minHeight: 62, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 11, boxShadow: "0 10px 26px rgba(66, 83, 255, 0.28)" },
  buttonArrow: { color: "#F8FAFF", fontSize: 25, marginTop: -2 },
  buttonText: { color: "#F8FAFF", fontSize: 16, fontWeight: "900" },
  outlineButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "rgba(129, 166, 233, 0.52)", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  outlineButtonText: { color: "#BFD2F5", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  footer: { color: "#7585A3", fontSize: 11, textAlign: "center", paddingTop: 2 }
});
