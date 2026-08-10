import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../api/client";
import { adminSession } from "../services/admin-session";
import { Screen } from "../components/screen";
import { Field } from "../components/field";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { StatusPill } from "../components/status-pill";
import { colors } from "../theme/colors";

const statusLabels = {
  INVITED: "Invited",
  READY_FOR_INTERVIEW: "Resume verified",
  INTERVIEW_IN_PROGRESS: "Interview live",
  INTERVIEW_COMPLETED: "Completed",
  UNDER_REVIEW: "Under review",
  SELECTED: "Selected",
  REJECTED: "Rejected"
};

function initials(name) { return (name || "Candidate").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

export default function AdminCandidatesScreen() {
  const { status: statusParam } = useLocalSearchParams();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const activeStatus = typeof statusParam === "string" && statusLabels[statusParam] ? statusParam : "";
  const filterTitle = activeStatus ? statusLabels[activeStatus] : "All candidates";

  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const token = await adminSession.get();
      if (!token) return router.replace("/admin-login");
      const queryParts = [];
      if (search.trim()) queryParts.push(`q=${encodeURIComponent(search.trim())}`);
      if (activeStatus) queryParts.push(`status=${encodeURIComponent(activeStatus)}`);
      const data = await api.adminCandidates(token, queryParts.join("&"));
      setItems(data.candidates);
      setError("");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => { load(""); }, [load]);
  const itemSubtitle = useMemo(() => activeStatus ? `${filterTitle} candidates from your live dashboard` : "Search every secure candidate record", [activeStatus, filterTitle]);

  return <Screen>
    <View style={{ gap: 4 }}><Text selectable style={{ color: colors.text, fontSize: 25, fontWeight: "900" }}>{filterTitle}</Text><Text selectable style={{ color: colors.muted, lineHeight: 20 }}>{itemSubtitle}</Text></View>
    {activeStatus ? <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, borderWidth: 1, borderColor: "rgba(112, 156, 255, 0.42)", backgroundColor: "rgba(50, 89, 221, 0.18)", paddingVertical: 7, paddingLeft: 10, paddingRight: 7, borderRadius: 12 }}><Text selectable style={{ color: "#BBD1FF", fontSize: 12, fontWeight: "800" }}>Dashboard filter · {filterTitle}</Text><Pressable accessibilityRole="button" accessibilityLabel="Clear candidate filter" onPress={() => router.replace("/admin-candidates")} style={({ pressed }) => ({ width: 23, height: 23, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(129, 168, 255, 0.2)", opacity: pressed ? 0.7 : 1 })}><Text style={{ color: "#D8E5FF", fontSize: 15, lineHeight: 18 }}>×</Text></Pressable></View> : null}
    <Card style={{ gap: 14 }}><Field label="Search candidates" value={query} onChangeText={setQuery} placeholder="Name, email, phone, invitation code" returnKeyType="search" onSubmitEditing={() => load(query)} /><Button title={loading ? "Searching…" : "Search candidates"} loading={loading} onPress={() => load(query)} /></Card>
    <ErrorBanner message={error} />
    {items.map((candidate) => {
      const candidateId = String(candidate.id || candidate._id || candidate.email);
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${candidate.fullName}`} key={candidateId} onPress={() => router.push(`/admin-candidate/${candidateId}`)} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}><Card style={{ gap: 10 }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}><View style={{ flexDirection: "row", gap: 10, flex: 1, minWidth: 0 }}><View style={{ width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(76, 104, 255, 0.25)", borderWidth: 1, borderColor: "rgba(126, 157, 255, 0.34)" }}><Text selectable style={{ color: "#DDE8FF", fontWeight: "900", fontSize: 12 }}>{initials(candidate.fullName)}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text selectable numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>{candidate.fullName}</Text><Text selectable numberOfLines={1} style={{ color: colors.muted, marginTop: 2 }}>{candidate.position || "Position not set"}</Text></View></View><StatusPill tone={candidate.status === "SELECTED" ? "success" : candidate.status === "REJECTED" ? "danger" : candidate.status === "UNDER_REVIEW" ? "warning" : "info"}>{candidate.status.replaceAll("_", " ")}</StatusPill></View><View style={{ paddingLeft: 49, gap: 3 }}><Text selectable style={{ color: colors.muted, fontSize: 12 }}>{candidate.email}</Text><Text selectable style={{ color: "#B6C9EF", fontSize: 12, fontWeight: "700" }}>Score: {candidate.aiScore ?? "—"} · {candidate.aiRecommendation || "Awaiting interview"} <Text style={{ color: "#8BB7FF" }}>Open →</Text></Text></View></Card></Pressable>;
    })}
    {!loading && !items.length ? <Card style={{ minHeight: 142, alignItems: "center", justifyContent: "center", gap: 8 }}><Text selectable style={{ color: "#79A4F6", fontSize: 28 }}>◌</Text><Text selectable style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>No candidates found</Text><Text selectable style={{ color: colors.muted, textAlign: "center", lineHeight: 19 }}>Try another search, or create a secure candidate invitation.</Text><Pressable accessibilityRole="button" onPress={() => router.push("/admin-create-candidate")} style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginTop: 3, backgroundColor: "rgba(65, 91, 231, 0.6)" })}><Text selectable style={{ color: "#EAF1FF", fontSize: 12, fontWeight: "900" }}>Invite candidate →</Text></Pressable></Card> : null}
  </Screen>;
}
