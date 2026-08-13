import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { api } from "../api/client";

const heroImage = require("../../assets/images/interview-hero-v2.png");
const brandLogo = require("../../assets/images/aparaitech-interview-logo.png");

const palette = {
  background: "#020817",
  surface: "#07162C",
  surfaceStrong: "#081A35",
  border: "rgba(118, 151, 205, 0.22)",
  heading: "#F7F8FF",
  body: "#A8B5D0",
  quiet: "#71819F",
  blue: "#3696FF",
  violet: "#9D37F5",
  cyan: "#34C8FF"
};

function BrandMark() {
  return <Image source={brandLogo} contentFit="contain" style={styles.brandMark} accessibilityLabel="Aparaitech AI Interview logo" />;
}

function PersonGlyph({ color = "#F5F8FF" }) {
  return <View style={styles.personGlyph} accessibilityElementsHidden>
    <View style={[styles.personHead, { borderColor: color }]} />
    <View style={[styles.personBody, { borderColor: color }]} />
  </View>;
}

function ShieldGlyph() {
  return <View style={styles.shieldGlyph} accessibilityElementsHidden><Text style={styles.shieldGlyphText}>◇</Text></View>;
}

function TinySignal({ symbol, label }) {
  return <View style={styles.signalItem}>
    <Text style={styles.signalSymbol}>{symbol}</Text>
    <Text selectable style={styles.signalText}>{label}</Text>
  </View>;
}

export default function WelcomeScreen() {
  const [code, setCode] = useState("");
  const { width } = useWindowDimensions();
  const heroWidth = Math.min(340, Math.max(270, width * 0.55));
  const continueToCandidate = () => router.push({ pathname: "/candidate-access", params: code.trim() ? { code: code.trim().toUpperCase() } : {} });

  // Wake a sleeping Render instance while the candidate reads the welcome page.
  useEffect(() => { api.health().catch(() => {}); }, []);

  return <View style={styles.root}>
    <StatusBar style="light" />
    <LinearGradient colors={["#020817", "#03102A", "#071240", "#110B3D"]} locations={[0, 0.42, 0.77, 1]} style={StyleSheet.absoluteFill} />
    <View style={styles.topGlow} />
    <View style={styles.bottomGlow} />
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brandLockup}>
            <BrandMark />
            <View>
              <Text selectable style={styles.brandName}>APARAITECH</Text>
              <Text selectable style={styles.brandSub}>S O F T W A R E</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open administrator login" onPress={() => router.push("/admin-login")} style={({ pressed }) => [styles.secureChip, pressed && styles.secureChipPressed]}>
            <ShieldGlyph />
            <Text selectable style={styles.secureChipText}>Secure & Verified</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Image source={heroImage} contentFit="contain" style={[styles.heroArt, { width: heroWidth }]} accessible={false} />
          <View style={styles.heroCopy}>
            <Text selectable style={styles.eyebrow}>AI-POWERED INTERVIEW PLATFORM</Text>
            <Text selectable style={styles.title}>Interview.{"\n"}With <Text style={styles.titleGradientWord}>Confidence.</Text></Text>
            <Text selectable style={styles.subtitle}>A secure, AI-assisted recruitment experience for candidates and authorized administrators.</Text>
          </View>
        </View>

        <View style={styles.accessCard}>
          <View style={styles.accessHeading}>
            <LinearGradient colors={["#27B8FF", "#3554EE", "#6F28D9"]} style={styles.personOrb}>
              <PersonGlyph />
            </LinearGradient>
            <View style={styles.accessTitleBlock}>
              <Text selectable style={styles.cardTitle}>Candidate access</Text>
              <Text selectable style={styles.cardDescription}>Enter the <Text style={styles.inlineBlue}>invitation code</Text> shared by Aparaitech to begin your AI interview experience.</Text>
            </View>
          </View>

          <LinearGradient colors={["#22C8FF", "#2E70FF", "#8D36F3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inputBorder}>
            <View style={styles.inputShell}>
              <Text style={styles.inputSymbol}>◇</Text>
              <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Invitation code" placeholder="Enter invitation code" placeholderTextColor="#7384A5" style={styles.codeInput} />
            </View>
          </LinearGradient>

          <Pressable accessibilityRole="button" accessibilityLabel="Access interview" onPress={continueToCandidate} style={({ pressed }) => [styles.accessButtonPressable, pressed && styles.pressed]}>
            <LinearGradient colors={["#299AFF", "#4A63FF", "#9729E8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accessButton}>
              <Text style={styles.buttonArrow}>→</Text><Text selectable style={styles.accessButtonText}>Access Interview</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.signalRow}>
            <TinySignal symbol="◇" label="Identity Verified" />
            <View style={styles.signalDivider} />
            <TinySignal symbol="▣" label="Data Secure" />
            <View style={styles.signalDivider} />
            <TinySignal symbol="⌁" label="AI Monitored" />
          </View>
        </View>

        <View style={styles.privacyCard}>
          <LinearGradient colors={["#174CB6", "#142D70"]} style={styles.privacyOrb}><Text style={styles.privacySymbol}>◇</Text></LinearGradient>
          <View style={styles.privacyCopy}>
            <Text selectable style={styles.privacyTitle}>Privacy & Consent</Text>
            <Text selectable style={styles.privacyDetail}>Camera, microphone, recording and monitoring are used only after explicit interview consent.</Text>
          </View>
          <Text style={styles.chevron}>⌄</Text>
        </View>

        <Text selectable style={styles.footer}>© 2025 Aparaitech Software. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background, overflow: "hidden" },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24, gap: 18 },
  topGlow: { position: "absolute", width: 180, height: 310, borderRadius: 155, backgroundColor: "rgba(22, 86, 224, 0.14)", top: 120, right: 0, boxShadow: "0 0 90px rgba(34, 90, 255, 0.24)" },
  bottomGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(134, 38, 251, 0.1)", bottom: 0, left: 0, boxShadow: "0 0 90px rgba(123, 47, 255, 0.22)" },
  topbar: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 46, height: 46, borderRadius: 15, boxShadow: "0 6px 22px rgba(58, 92, 255, 0.48)" },
  brandName: { color: palette.heading, fontSize: 22, fontWeight: "800", letterSpacing: 0.7 },
  brandSub: { color: "#3F7CFF", fontSize: 10, fontWeight: "800", letterSpacing: 4.5, marginTop: -1 },
  secureChip: { height: 39, borderRadius: 22, borderWidth: 1, borderColor: "rgba(136, 165, 213, 0.42)", backgroundColor: "rgba(5, 16, 38, 0.65)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  secureChipPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  shieldGlyph: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "#AFC5EE", justifyContent: "center", alignItems: "center" },
  shieldGlyphText: { color: "#C9D7F2", fontSize: 12, lineHeight: 14 },
  secureChipText: { color: "#C1CAE0", fontSize: 12, fontWeight: "600" },
  hero: { minHeight: 330, justifyContent: "flex-end", position: "relative", overflow: "hidden" },
  heroArt: { position: "absolute", height: 240, right: 0, top: 45, opacity: 0.92 },
  heroCopy: { width: "62%", paddingTop: 66, zIndex: 1 },
  eyebrow: { color: "#9B67FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.15, marginBottom: 13 },
  title: { color: palette.heading, fontSize: 37, lineHeight: 47, letterSpacing: -1.15, fontWeight: "800" },
  titleGradientWord: { color: "#7F5BFF" },
  subtitle: { color: palette.body, fontSize: 16, lineHeight: 25, marginTop: 13, paddingRight: 2 },
  accessCard: { backgroundColor: "rgba(6, 23, 48, 0.89)", borderRadius: 19, borderCurve: "continuous", borderWidth: 1, borderColor: palette.border, padding: 20, gap: 20, boxShadow: "0 16px 38px rgba(0, 0, 0, 0.22)" },
  accessHeading: { flexDirection: "row", alignItems: "flex-start", gap: 18 },
  personOrb: { width: 83, height: 83, borderRadius: 42, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 8px 24px rgba(52, 89, 255, 0.28)" },
  personGlyph: { width: 37, height: 40, alignItems: "center" },
  personHead: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, marginTop: 1 },
  personBody: { width: 28, height: 16, marginTop: 6, borderWidth: 2, borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomWidth: 0 },
  accessTitleBlock: { flex: 1, minWidth: 0, gap: 8, paddingTop: 7 },
  cardTitle: { color: palette.heading, fontSize: 21, lineHeight: 25, fontWeight: "800", letterSpacing: -0.35 },
  cardDescription: { color: palette.body, fontSize: 15, lineHeight: 23 },
  inlineBlue: { color: "#69A4FF" },
  inputBorder: { borderRadius: 14, padding: 1 },
  inputShell: { minHeight: 65, borderRadius: 13, backgroundColor: "#06152E", flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12 },
  inputSymbol: { color: "#9DB7E7", fontSize: 25, lineHeight: 28, transform: [{ rotate: "-24deg" }] },
  codeInput: { flex: 1, color: palette.heading, fontSize: 16, minHeight: 60, letterSpacing: 0.2 },
  accessButtonPressable: { borderRadius: 14 },
  accessButton: { height: 67, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 13, boxShadow: "0 10px 25px rgba(79, 73, 255, 0.25)" },
  buttonArrow: { color: "#F6F9FF", fontSize: 27, fontWeight: "400", marginTop: -2 },
  accessButtonText: { color: "#F8FAFF", fontSize: 17, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  signalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  signalItem: { flexDirection: "row", gap: 6, alignItems: "center", flexShrink: 1 },
  signalSymbol: { color: "#A6B9DD", fontSize: 16 },
  signalText: { color: "#9AAAC9", fontSize: 11, fontWeight: "600" },
  signalDivider: { height: 25, width: 1, backgroundColor: "rgba(127, 153, 197, 0.22)" },
  privacyCard: { minHeight: 116, flexDirection: "row", alignItems: "center", gap: 15, borderRadius: 19, borderCurve: "continuous", borderWidth: 1, borderColor: palette.border, padding: 18, backgroundColor: "rgba(8, 27, 56, 0.76)" },
  privacyOrb: { width: 59, height: 59, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  privacySymbol: { color: "#D7E7FF", fontSize: 31, lineHeight: 34 },
  privacyCopy: { flex: 1, minWidth: 0, gap: 4 },
  privacyTitle: { color: palette.heading, fontSize: 15, fontWeight: "800" },
  privacyDetail: { color: palette.body, fontSize: 12, lineHeight: 18 },
  chevron: { color: "#8FA6D0", fontSize: 25, marginTop: -6 },
  footer: { color: "#6F7E9F", fontSize: 11, textAlign: "center", paddingTop: 7 }
});
