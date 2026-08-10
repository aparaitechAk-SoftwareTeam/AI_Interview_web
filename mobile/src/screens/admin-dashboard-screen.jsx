import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { api } from "../api/client";
import { adminSession } from "../services/admin-session";
import { PortalError, portal } from "../components/secure-portal";

const heroImage = require("../../assets/images/interview-hero-v2.png");

const metricDefinitions = [
  { key: "total", label: "Total candidates", hint: "Open candidate list", icon: "◉", colors: ["#436DFF", "#6954F2"] },
  { key: "invited", label: "Invited", hint: "View invitations", icon: "↗", status: "INVITED", colors: ["#38A8FF", "#2674E7"] },
  { key: "resumeUploaded", label: "Resume verified", hint: "Ready to interview", icon: "▤", status: "READY_FOR_INTERVIEW", colors: ["#31D3C8", "#1D9FAD"] },
  { key: "liveInterviews", label: "Interview live", hint: "Open live sessions", icon: "◌", status: "INTERVIEW_IN_PROGRESS", colors: ["#C45DFF", "#7635DF"] },
  { key: "interviewsCompleted", label: "Completed", hint: "Awaiting review", icon: "✓", status: "INTERVIEW_COMPLETED", colors: ["#53D795", "#1C9A69"] },
  { key: "underReview", label: "Under review", hint: "Needs decision", icon: "◷", status: "UNDER_REVIEW", colors: ["#FFB553", "#E48725"] },
  { key: "selected", label: "Selected", hint: "View selected", icon: "★", status: "SELECTED", colors: ["#4E9DFF", "#3564E4"] },
  { key: "rejected", label: "Rejected", hint: "View closed decisions", icon: "−", status: "REJECTED", colors: ["#FF8B9A", "#E94D6D"] }
];

const pipelineDefinitions = [
  { key: "invited", label: "Invited", status: "INVITED", color: "#7087FF" },
  { key: "resumeUploaded", label: "Resume ready", status: "READY_FOR_INTERVIEW", color: "#43C6DB" },
  { key: "liveInterviews", label: "Live now", status: "INTERVIEW_IN_PROGRESS", color: "#BE76FF" },
  { key: "interviewsCompleted", label: "Completed", status: "INTERVIEW_COMPLETED", color: "#58D89B" },
  { key: "underReview", label: "Under review", status: "UNDER_REVIEW", color: "#FFC363" }
];

function number(value) { return new Intl.NumberFormat().format(value || 0); }
function initials(name) { return (name || "Candidate").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function duration(seconds) {
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
function localDate(date) {
  if (!date) return "Recently completed";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function dayLabel(date) { return date ? date.slice(8) : ""; }
function recommendationTone(value) {
  if (["STRONGLY_QUALIFY", "QUALIFY"].includes(value)) return { text: "Qualified", color: "#8DEBC4", background: "rgba(31, 169, 112, 0.18)" };
  if (value === "NOT_RECOMMENDED") return { text: "Review", color: "#FFAFBA", background: "rgba(226, 67, 94, 0.16)" };
  return { text: "Review", color: "#FFD28A", background: "rgba(232, 153, 42, 0.16)" };
}

function MetricCard({ item, value, width, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.label}`} onPress={onPress} style={({ pressed }) => [styles.metricCard, { width }, pressed && styles.pressed]}>
    <LinearGradient colors={item.colors} style={styles.metricIcon}><Text style={styles.metricIconText}>{item.icon}</Text></LinearGradient>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text selectable numberOfLines={1} style={styles.metricLabel}>{item.label}</Text>
      <Text selectable style={styles.metricValue}>{number(value)}</Text>
      <Text selectable numberOfLines={1} style={styles.metricHint}>{item.hint}</Text>
    </View>
  </Pressable>;
}

function NavAction({ icon, label, active, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.navAction, active && styles.navActionActive, pressed && styles.pressed]}>
    <Text style={[styles.navActionIcon, active && styles.navActionTextActive]}>{icon}</Text>
    <Text selectable numberOfLines={1} style={[styles.navActionText, active && styles.navActionTextActive]}>{label}</Text>
  </Pressable>;
}

function ActivityChart({ days }) {
  const highest = Math.max(1, ...(days || []).map((item) => item.completed));
  return <View style={styles.chart}>
    <View style={styles.chartGrid}>
      <View style={styles.gridLine} /><View style={styles.gridLine} /><View style={styles.gridLine} />
    </View>
    <View style={styles.barRow}>{(days || []).map((item) => {
      const height = item.completed ? Math.max(16, Math.round((item.completed / highest) * 110)) : 7;
      return <View key={item.date} style={styles.barItem}>
        <Text selectable style={styles.barValue}>{item.completed || ""}</Text>
        <LinearGradient colors={item.completed ? ["#45B8FF", "#8E36F5"] : ["#142B59", "#142B59"]} style={[styles.activityBar, { height }]} />
        <Text selectable style={styles.barLabel}>{dayLabel(item.date)}</Text>
      </View>;
    })}</View>
  </View>;
}

function Pipeline({ totals, onPress }) {
  const max = Math.max(1, totals.total || 0, ...pipelineDefinitions.map((item) => totals[item.key] || 0));
  return <View style={styles.pipelineRows}>{pipelineDefinitions.map((item) => {
    const count = totals[item.key] || 0;
    const width = `${Math.max(count ? 12 : 4, Math.round((count / max) * 100))}%`;
    return <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.label} candidates`} key={item.key} onPress={() => onPress(item.status)} style={({ pressed }) => [styles.pipelineRow, pressed && styles.pressed]}>
      <View style={styles.pipelineTitle}><View style={[styles.pipelineDot, { backgroundColor: item.color }]} /><Text selectable style={styles.pipelineLabel}>{item.label}</Text><Text selectable style={styles.pipelineCount}>{number(count)}</Text></View>
      <View style={styles.pipelineTrack}><View style={[styles.pipelineFill, { backgroundColor: item.color, width }]} /></View>
    </Pressable>;
  })}</View>;
}

function Insight({ icon, label, value, colors, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View candidates for ${label}`} onPress={onPress} style={({ pressed }) => [styles.insight, pressed && styles.pressed]}><LinearGradient colors={colors} style={styles.insightIcon}><Text style={styles.insightIconText}>{icon}</Text></LinearGradient><View style={{ flex: 1 }}><Text selectable numberOfLines={1} style={styles.insightLabel}>{label}</Text><Text selectable style={styles.insightValue}>{value}</Text></View></Pressable>;
}

function RecentInterview({ item }) {
  const tone = recommendationTone(item.aiRecommendation);
  const candidate = item.candidate || {};
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${candidate.fullName || "candidate"} interview`} onPress={() => candidate.id && router.push(`/admin-candidate/${candidate.id}`)} style={({ pressed }) => [styles.recentItem, pressed && styles.pressed]}>
    <LinearGradient colors={["#4E9DFF", "#9A3FF3"]} style={styles.avatar}><Text selectable style={styles.avatarText}>{initials(candidate.fullName)}</Text></LinearGradient>
    <View style={styles.recentCopy}><Text selectable numberOfLines={1} style={styles.recentName}>{candidate.fullName || "Candidate"}</Text><Text selectable numberOfLines={1} style={styles.recentMeta}>{candidate.position || "Position not set"} · {localDate(item.completedAt)}</Text></View>
    <View style={styles.recentScore}><Text selectable style={styles.scoreValue}>{item.overallScore ?? "—"}{item.overallScore !== undefined ? "%" : ""}</Text><View style={[styles.recommendation, { backgroundColor: tone.background }]}><Text selectable style={[styles.recommendationText, { color: tone.color }]}>{tone.text}</Text></View></View>
  </Pressable>;
}

export default function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const metricWidth = useMemo(() => Math.max(148, (width - 56) / 2), [width]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await adminSession.get();
      if (!token) return router.replace("/admin-login");
      setData(await api.adminDashboard(token));
      setError("");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const logout = async () => { await adminSession.clear(); router.replace("/"); };
  const totals = data?.totals || {};
  const analytics = data?.analytics || { last7Days: [] };
  const openCandidates = (status) => router.push({ pathname: "/admin-candidates", params: status ? { status } : {} });

  return <View style={styles.root}>
    <StatusBar style="light" />
    <LinearGradient colors={["#020817", "#06183B", "#090D36", "#130A3C"]} locations={[0, 0.42, 0.75, 1]} style={StyleSheet.absoluteFill} />
    <View style={styles.topGlow} /><View style={styles.bottomGlow} />
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go to home" onPress={() => router.replace("/")} style={({ pressed }) => [styles.brand, pressed && styles.pressed]}><LinearGradient colors={["#40B9FF", "#783DF1"]} style={styles.brandMark}><Text style={styles.brandMarkText}>A</Text></LinearGradient><View><Text selectable style={styles.brandName}>APARAITECH</Text><Text selectable style={styles.brandRole}>AI INTERVIEW</Text></View></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={logout} style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}><Text style={styles.exitText}>Exit</Text><Text style={styles.exitArrow}>↗</Text></Pressable>
        </View>

        <LinearGradient colors={["rgba(31, 97, 255, 0.43)", "rgba(93, 32, 222, 0.34)", "rgba(5, 33, 86, 0.9)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Image source={heroImage} contentFit="contain" style={styles.heroArt} accessible={false} />
          <View style={styles.livePill}><View style={styles.liveDot} /><Text selectable style={styles.liveText}>LIVE RECRUITMENT DATA</Text></View>
          <Text selectable style={styles.heroTitle}>Recruitment{`\n`}command center.</Text>
          <Text selectable style={styles.heroDescription}>See every candidate, interview and decision in one secure view.</Text>
          <View style={styles.heroBottom}><View><Text selectable style={styles.heroStatLabel}>TOTAL CANDIDATES</Text><Text selectable style={styles.heroStatValue}>{number(totals.total)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh dashboard" onPress={load} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>{loading ? <ActivityIndicator size="small" color="#EAF4FF" /> : <><Text style={styles.refreshIcon}>↻</Text><Text selectable style={styles.refreshText}>Refresh</Text></>}</Pressable></View>
        </LinearGradient>

        <View style={styles.navActions}>
          <NavAction active icon="▦" label="Dashboard" onPress={load} />
          <NavAction icon="◉" label="Candidates" onPress={() => router.push("/admin-candidates")} />
          <NavAction icon="＋" label="Invite" onPress={() => router.push("/admin-create-candidate")} />
          <NavAction icon="⚙" label="Settings" onPress={() => router.push("/admin-settings")} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Open candidate registry and PDF export" onPress={() => router.push("/admin-candidate-registry")} style={({ pressed }) => ({ borderRadius: 17, borderWidth: 1, borderColor: "rgba(127, 165, 255, 0.38)", backgroundColor: "rgba(31, 62, 140, 0.42)", paddingHorizontal: 15, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.78 : 1 })}><View><Text selectable style={{ color: "#EAF1FF", fontWeight: "900", fontSize: 15 }}>Candidate Registry</Text><Text selectable style={{ color: "#AFC3E8", fontSize: 12, marginTop: 3 }}>Hierarchy table, email delivery state and PDF export</Text></View><Text style={{ color: "#9FC3FF", fontSize: 20 }}>›</Text></Pressable>

        <PortalError message={error} />

        <View style={styles.sectionHeader}><View><Text selectable style={styles.sectionTitle}>Recruitment snapshot</Text><Text selectable style={styles.sectionSubtitle}>Live candidate status across your pipeline</Text></View><Text selectable style={styles.updatedText}>{data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}</Text></View>
        <View style={styles.metricGrid}>{metricDefinitions.map((item) => <MetricCard key={item.key} item={item} value={totals[item.key]} width={metricWidth} onPress={() => openCandidates(item.status)} />)}</View>

        <View style={styles.sectionHeader}><View><Text selectable style={styles.sectionTitle}>Interview pipeline</Text><Text selectable style={styles.sectionSubtitle}>Where candidates are right now</Text></View><Text selectable style={styles.sectionTag}>LIVE</Text></View>
        <View style={styles.glassCard}><Pipeline totals={totals} onPress={openCandidates} /><Pressable accessibilityRole="button" accessibilityLabel="View all candidates" onPress={() => openCandidates()} style={({ pressed }) => [styles.pipelineFoot, pressed && styles.pressed]}><Text selectable style={styles.pipelineFootLabel}>Interview completion · View candidates</Text><Text selectable style={styles.pipelineFootValue}>{analytics.completionRate || 0}%</Text></Pressable></View>

        <View style={styles.sectionHeader}><View><Text selectable style={styles.sectionTitle}>Completed interviews</Text><Text selectable style={styles.sectionSubtitle}>Actual completions in the last 7 days</Text></View><Text selectable style={styles.sectionTag}>7 DAYS</Text></View>
        <View style={styles.glassCard}><ActivityChart days={analytics.last7Days} /><View style={styles.analyticsGrid}><Insight icon="✦" label="Average AI score" value={analytics.averageScore !== null && analytics.averageScore !== undefined ? `${analytics.averageScore}/100` : "—"} colors={["#477CFF", "#7953ED"]} onPress={() => openCandidates()} /><Insight icon="◷" label="Average duration" value={duration(analytics.averageDurationSeconds)} colors={["#59DCC6", "#1F9DAA"]} onPress={() => openCandidates()} /><Insight icon="✓" label="Completed" value={number(analytics.completedInterviews)} colors={["#57D895", "#239765"]} onPress={() => openCandidates("INTERVIEW_COMPLETED")} /></View></View>

        <Pressable accessibilityRole="button" accessibilityLabel="Review candidates and interview evidence" onPress={() => openCandidates()} style={({ pressed }) => [styles.assistantCard, pressed && styles.pressed]}><LinearGradient colors={["rgba(27, 67, 142, 0.58)", "rgba(83, 32, 176, 0.43)"]} style={StyleSheet.absoluteFill} />
          <Image source={heroImage} contentFit="contain" style={styles.assistantArt} accessible={false} />
          <View style={styles.assistantCopy}><Text selectable style={styles.assistantEyebrow}>AI INTERVIEW ASSISTANT</Text><Text selectable style={styles.assistantTitle}>Review evidence with confidence.</Text><Text selectable style={styles.assistantDescription}>Scores, transcripts and integrity evidence are available for every completed interview.</Text><View style={styles.assistantButton}><Text selectable style={styles.assistantButtonText}>Review candidates</Text><Text style={styles.assistantArrow}>→</Text></View></View>
        </Pressable>

        <View style={styles.sectionHeader}><View><Text selectable style={styles.sectionTitle}>Recent completed interviews</Text><Text selectable style={styles.sectionSubtitle}>Latest AI-scored candidate sessions</Text></View><Pressable accessibilityRole="button" accessibilityLabel="View all candidates" onPress={() => router.push("/admin-candidates")}><Text selectable style={styles.viewAll}>View all →</Text></Pressable></View>
        <View style={styles.recentCard}>{data?.recentInterviews?.length ? data.recentInterviews.map((item) => <RecentInterview key={item.id} item={item} />) : <View style={styles.emptyRecent}><Text selectable style={styles.emptyIcon}>◌</Text><Text selectable style={styles.emptyTitle}>No completed interviews yet</Text><Text selectable style={styles.emptyText}>Candidates will appear here when their AI interview is complete.</Text><Pressable accessibilityRole="button" onPress={() => router.push("/admin-create-candidate")} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text selectable style={styles.emptyButtonText}>Send an invitation</Text></Pressable></View>}</View>

        <Text selectable style={styles.footer}>© {new Date().getFullYear()} Aparaitech Software · Secure administrator workspace</Text>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: portal.background, overflow: "hidden" },
  content: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 30, gap: 18 },
  topGlow: { position: "absolute", top: 170, right: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(62, 105, 255, 0.19)", boxShadow: "0 0 90px rgba(48, 96, 255, 0.2)" },
  bottomGlow: { position: "absolute", bottom: -40, left: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(154, 47, 238, 0.13)", boxShadow: "0 0 100px rgba(154, 47, 238, 0.18)" },
  topBar: { minHeight: 45, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, minWidth: 0 },
  brandMark: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(61, 105, 255, 0.35)" },
  brandMarkText: { color: "#F6F9FF", fontWeight: "900", fontSize: 18 },
  brandName: { color: "#EFF5FF", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  brandRole: { color: "#8EA5DF", fontSize: 8, fontWeight: "800", letterSpacing: 1.3, marginTop: 1 },
  exitButton: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(156, 181, 235, 0.28)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(6, 25, 60, 0.64)" },
  exitText: { color: "#CAD9F5", fontSize: 12, fontWeight: "800" },
  exitArrow: { color: "#9FBDF1", fontSize: 15 },
  hero: { minHeight: 272, borderWidth: 1, borderColor: "rgba(116, 153, 244, 0.37)", overflow: "hidden", borderRadius: 24, borderCurve: "continuous", padding: 20, justifyContent: "space-between", boxShadow: "0 18px 40px rgba(0, 0, 0, 0.25)" },
  heroArt: { position: "absolute", right: -46, top: 6, height: 215, width: 238, opacity: 0.72 },
  livePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(7, 23, 62, 0.62)", borderWidth: 1, borderColor: "rgba(132, 187, 255, 0.25)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#61EDAC", boxShadow: "0 0 10px rgba(97, 237, 172, 0.92)" },
  liveText: { color: "#BFD3FB", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  heroTitle: { width: "72%", color: "#FBFCFF", fontSize: 30, lineHeight: 36, letterSpacing: -0.8, fontWeight: "900", marginTop: 4 },
  heroDescription: { width: "66%", color: "#B6C7E8", fontSize: 13, lineHeight: 19, marginTop: -2 },
  heroBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 },
  heroStatLabel: { color: "#A6BDE5", fontSize: 9, letterSpacing: 0.7, fontWeight: "800" },
  heroStatValue: { color: "#FFFFFF", fontSize: 32, lineHeight: 37, fontWeight: "900", fontVariant: ["tabular-nums"] },
  refreshButton: { minHeight: 39, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(9, 33, 81, 0.75)", borderWidth: 1, borderColor: "rgba(116, 176, 255, 0.38)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  refreshIcon: { color: "#BBD9FF", fontSize: 18 },
  refreshText: { color: "#C8DCFD", fontSize: 12, fontWeight: "800" },
  navActions: { flexDirection: "row", backgroundColor: "rgba(6, 25, 58, 0.79)", borderRadius: 18, padding: 5, borderWidth: 1, borderColor: "rgba(118, 154, 214, 0.2)", gap: 3 },
  navAction: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 51, borderRadius: 13, paddingHorizontal: 2 },
  navActionActive: { backgroundColor: "rgba(57, 91, 239, 0.75)", boxShadow: "0 5px 15px rgba(58, 85, 244, 0.33)" },
  navActionIcon: { color: "#95A9CE", fontSize: 15, lineHeight: 17 },
  navActionText: { color: "#9EAFCD", fontSize: 10, fontWeight: "800" },
  navActionTextActive: { color: "#F6F9FF" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 2 },
  sectionTitle: { color: "#F2F6FF", fontSize: 19, lineHeight: 23, fontWeight: "900", letterSpacing: -0.3 },
  sectionSubtitle: { color: "#91A3C3", fontSize: 12, lineHeight: 18, marginTop: 2 },
  sectionTag: { color: "#96B9F5", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "rgba(58, 116, 242, 0.15)" },
  updatedText: { color: "#6F83A8", fontSize: 10, textAlign: "right", maxWidth: 88 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  metricCard: { minHeight: 116, borderRadius: 18, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(107, 145, 211, 0.22)", backgroundColor: "rgba(7, 25, 59, 0.86)", padding: 13, gap: 10, overflow: "hidden", boxShadow: "0 10px 25px rgba(0, 0, 0, 0.17)" },
  metricIcon: { alignSelf: "flex-start", width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metricIconText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  metricLabel: { color: "#EAF1FF", fontSize: 12, fontWeight: "800" },
  metricValue: { color: "#FFFFFF", fontSize: 24, lineHeight: 27, fontWeight: "900", fontVariant: ["tabular-nums"], marginTop: 1 },
  metricHint: { color: "#8296B9", fontSize: 10, marginTop: 1 },
  glassCard: { borderRadius: 21, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(111, 149, 211, 0.24)", backgroundColor: "rgba(7, 26, 60, 0.86)", overflow: "hidden", padding: 16, gap: 15, boxShadow: "0 13px 30px rgba(0, 0, 0, 0.2)" },
  pipelineRows: { gap: 13 },
  pipelineRow: { gap: 6 },
  pipelineTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  pipelineDot: { width: 7, height: 7, borderRadius: 4 },
  pipelineLabel: { flex: 1, color: "#C1D0E9", fontSize: 12, fontWeight: "700" },
  pipelineCount: { color: "#F2F7FF", fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
  pipelineTrack: { height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(111, 142, 197, 0.17)" },
  pipelineFill: { height: "100%", borderRadius: 4 },
  pipelineFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderColor: "rgba(118, 151, 211, 0.18)", paddingTop: 13 },
  pipelineFootLabel: { color: "#91A5C9", fontSize: 12, fontWeight: "700" },
  pipelineFootValue: { color: "#76E7B5", fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  chart: { height: 162, position: "relative", justifyContent: "flex-end" },
  chartGrid: { position: "absolute", top: 15, left: 0, right: 0, bottom: 28, justifyContent: "space-between" },
  gridLine: { height: 1, backgroundColor: "rgba(126, 157, 209, 0.15)" },
  barRow: { height: 144, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 5 },
  barItem: { flex: 1, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  activityBar: { width: "74%", maxWidth: 25, borderRadius: 8, borderCurve: "continuous", minHeight: 7, boxShadow: "0 4px 14px rgba(66, 126, 255, 0.28)" },
  barValue: { color: "#BFD1F4", fontSize: 10, fontWeight: "800", minHeight: 12 },
  barLabel: { color: "#8195B8", fontSize: 10, fontWeight: "700", marginTop: 1 },
  analyticsGrid: { paddingTop: 1, flexDirection: "row", gap: 7 },
  insight: { flex: 1, minWidth: 0, borderRadius: 13, padding: 9, gap: 6, backgroundColor: "rgba(96, 130, 196, 0.11)" },
  insightIcon: { width: 23, height: 23, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  insightIconText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  insightLabel: { color: "#8498BE", fontSize: 9, fontWeight: "700" },
  insightValue: { color: "#F1F6FF", fontSize: 15, lineHeight: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  assistantCard: { minHeight: 190, borderWidth: 1, borderColor: "rgba(122, 151, 240, 0.31)", borderRadius: 22, borderCurve: "continuous", overflow: "hidden", padding: 19, boxShadow: "0 16px 34px rgba(0, 0, 0, 0.22)" },
  assistantArt: { position: "absolute", right: -43, bottom: -20, width: 220, height: 190, opacity: 0.58 },
  assistantCopy: { width: "68%", gap: 8 },
  assistantEyebrow: { color: "#B58CFF", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  assistantTitle: { color: "#F7F9FF", fontSize: 20, lineHeight: 24, fontWeight: "900", letterSpacing: -0.25 },
  assistantDescription: { color: "#B2C1DD", fontSize: 12, lineHeight: 17 },
  assistantButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(166, 185, 244, 0.45)", minHeight: 36, borderRadius: 10, paddingHorizontal: 10, marginTop: 3, backgroundColor: "rgba(6, 22, 56, 0.4)" },
  assistantButtonText: { color: "#DCE8FF", fontSize: 11, fontWeight: "800" },
  assistantArrow: { color: "#AFC8FF", fontSize: 15 },
  recentCard: { borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(111, 149, 211, 0.24)", backgroundColor: "rgba(7, 26, 60, 0.86)", overflow: "hidden", boxShadow: "0 13px 30px rgba(0, 0, 0, 0.2)" },
  recentItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: "rgba(117, 149, 207, 0.16)" },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  recentCopy: { flex: 1, minWidth: 0, gap: 3 },
  recentName: { color: "#EFF4FF", fontSize: 14, fontWeight: "900" },
  recentMeta: { color: "#8498B9", fontSize: 10, lineHeight: 15 },
  recentScore: { alignItems: "flex-end", gap: 4 },
  scoreValue: { color: "#F7FAFF", fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
  recommendation: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  recommendationText: { fontSize: 9, fontWeight: "900" },
  emptyRecent: { minHeight: 185, padding: 24, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyIcon: { color: "#7294D4", fontSize: 28 },
  emptyTitle: { color: "#EAF1FF", fontSize: 16, fontWeight: "900" },
  emptyText: { color: "#8CA1C5", textAlign: "center", fontSize: 12, lineHeight: 18, maxWidth: 260 },
  emptyButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, marginTop: 4, backgroundColor: "rgba(63, 97, 232, 0.64)", borderWidth: 1, borderColor: "rgba(121, 157, 255, 0.5)" },
  emptyButtonText: { color: "#EAF1FF", fontSize: 11, fontWeight: "900" },
  viewAll: { color: "#9DBDFF", fontSize: 12, fontWeight: "900", paddingVertical: 6 },
  footer: { color: "#7185AB", fontSize: 10, lineHeight: 16, textAlign: "center", paddingTop: 2 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] }
});
