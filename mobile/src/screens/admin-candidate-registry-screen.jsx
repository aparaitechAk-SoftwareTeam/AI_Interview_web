import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "../api/client";
import { adminSession } from "../services/admin-session";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { StatusPill } from "../components/status-pill";
import { colors } from "../theme/colors";
import { exportCandidateRegistryPdf } from "../services/candidate-registry-pdf";

const stages = [
  { key: "INVITED", label: "Invited", color: "#7095FF" },
  { key: "RESUME_PENDING", label: "Resume", color: "#4ECFE0" },
  { key: "INTERVIEW_IN_PROGRESS", label: "Interview", color: "#B675FF" },
  { key: "UNDER_REVIEW", label: "Review", color: "#FFC35B" },
  { key: "SELECTED", label: "Selected", color: "#55DA9A" },
  { key: "REJECTED", label: "Rejected", color: "#FF8495" }
];
function statusTone(value) { if (value === "SELECTED") return "success"; if (value === "REJECTED") return "danger"; if (["UNDER_REVIEW", "INTERVIEW_COMPLETED", "REINTERVIEW_REQUIRED"].includes(value)) return "warning"; return "info"; }
function displayStatus(value) { return String(value || "PENDING").replaceAll("_", " "); }
function deliveryTone(value) { return value === "SENT" ? "success" : value === "FAILED" ? "danger" : "warning"; }
function Cell({ children, style }) { return <View style={[styles.cell, style]}>{children}</View>; }

export default function AdminCandidateRegistryScreen() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [exporting, setExporting] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const token = await adminSession.get(); if (!token) return router.replace("/admin-login"); setData(await api.adminCandidateRegistry(token)); setError(""); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const records = data?.candidates || [];
  const hierarchy = useMemo(() => stages.map((stage) => ({ ...stage, count: data?.pipeline?.[stage.key] || 0 })), [data]);
  const downloadPdf = async () => { if (!data) return; setExporting(true); try { await exportCandidateRegistryPdf(data); } catch (reason) { setError(reason.message || "Unable to create the registry PDF."); } finally { setExporting(false); } };
  return <Screen><View style={{ gap: 5 }}><Text selectable style={{ color: colors.text, fontSize: 26, fontWeight: "900" }}>Candidate Registry</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>A separate, export-ready hierarchy of every recruitment record. The existing Candidates page remains unchanged.</Text></View><Card style={{ gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}><View><Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>TOTAL RECORDS</Text><Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>{data?.total ?? "-"}</Text></View><StatusPill tone="info">LIVE REGISTRY</StatusPill></View><View style={styles.stageRow}>{hierarchy.map((stage, index) => <View key={stage.key} style={styles.stage}><View style={[styles.stageDot, { backgroundColor: stage.color }]} /><Text selectable style={styles.stageCount}>{stage.count}</Text><Text selectable style={styles.stageLabel}>{stage.label}</Text>{index < hierarchy.length - 1 ? <View style={styles.stageConnector} /> : null}</View>)}</View></Card><View style={{ gap: 10 }}><Button title={exporting ? "Preparing PDF..." : "Download registry as PDF"} variant="secondary" loading={exporting} disabled={!data || exporting} onPress={downloadPdf} /><Button title={loading ? "Refreshing registry..." : "Refresh registry"} loading={loading} onPress={load} /></View><ErrorBanner message={error} /><Card style={{ padding: 0, overflow: "hidden", gap: 0 }}><View style={styles.tableTitle}><Text selectable style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>All candidate records</Text><Text selectable style={{ color: colors.muted, fontSize: 12 }}>{records.length} shown</Text></View><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: 860 }}><View><View style={[styles.row, styles.head]}><Cell style={styles.nameColumn}><Text selectable style={styles.headText}>CANDIDATE</Text></Cell><Cell style={styles.emailColumn}><Text selectable style={styles.headText}>EMAIL / PHONE</Text></Cell><Cell style={styles.inviteColumn}><Text selectable style={styles.headText}>INVITATION ID</Text></Cell><Cell style={styles.deliveryColumn}><Text selectable style={styles.headText}>MAIL</Text></Cell><Cell style={styles.statusColumn}><Text selectable style={styles.headText}>STATUS</Text></Cell></View>{records.map((candidate) => <Pressable key={candidate.id} onPress={() => router.push(`/admin-candidate/${candidate.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: "rgba(75, 116, 248, 0.16)" }]}><Cell style={styles.nameColumn}><Text selectable numberOfLines={1} style={styles.name}>{candidate.fullName}</Text><Text selectable numberOfLines={1} style={styles.role}>{candidate.position || "Position not set"}</Text></Cell><Cell style={styles.emailColumn}><Text selectable numberOfLines={1} style={styles.email}>{candidate.email}</Text><Text selectable style={styles.role}>{candidate.phone || "-"}</Text></Cell><Cell style={styles.inviteColumn}><Text selectable style={styles.code}>{candidate.invitation?.code || "-"}</Text><Text selectable style={styles.role}>{candidate.invitation?.expiresAt ? `Expires ${new Date(candidate.invitation.expiresAt).toLocaleDateString()}` : "No active invitation"}</Text></Cell><Cell style={styles.deliveryColumn}><StatusPill tone={deliveryTone(candidate.invitation?.emailDelivery?.status)}>{candidate.invitation?.emailDelivery?.status || "PENDING"}</StatusPill></Cell><Cell style={styles.statusColumn}><StatusPill tone={statusTone(candidate.status)}>{displayStatus(candidate.status)}</StatusPill></Cell></Pressable>)}</View></ScrollView></Card>{!loading && !records.length ? <Card><Text selectable style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>No candidate records yet</Text><Text selectable style={{ color: colors.muted, lineHeight: 20 }}>Create a candidate from the existing Invite page. Their record and email delivery state will appear here.</Text></Card> : null}</Screen>;
}

const styles = StyleSheet.create({
  stageRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }, stage: { flex: 1, minWidth: 0, alignItems: "center", position: "relative", gap: 4 }, stageDot: { width: 10, height: 10, borderRadius: 5 }, stageCount: { color: colors.text, fontSize: 18, fontWeight: "900" }, stageLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textAlign: "center" }, stageConnector: { position: "absolute", height: 1, backgroundColor: colors.line, width: "50%", right: "-25%", top: 5 }, tableTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }, row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(120, 155, 214, 0.18)", minHeight: 72, backgroundColor: "rgba(5, 20, 49, 0.36)" }, head: { minHeight: 42, backgroundColor: "rgba(59, 82, 177, 0.27)", alignItems: "center" }, cell: { justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderRightWidth: 1, borderRightColor: "rgba(120, 155, 214, 0.13)" }, nameColumn: { width: 180 }, emailColumn: { width: 235 }, inviteColumn: { width: 180 }, deliveryColumn: { width: 120 }, statusColumn: { width: 145 }, headText: { color: "#B8CDF4", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }, name: { color: colors.text, fontWeight: "900", fontSize: 14 }, role: { color: colors.muted, fontSize: 11, marginTop: 3 }, email: { color: "#C9DBFA", fontSize: 12 }, code: { color: colors.brand, fontSize: 12, fontWeight: "900", letterSpacing: 0.3 }
});
