import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { api } from "../api/client";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { StatusPill } from "../components/status-pill";
import { colors } from "../theme/colors";

const message = { SELECTED: "Congratulations. Aparaitech has selected you to proceed.", REJECTED: "Thank you for your time. Aparaitech has completed its review.", HOLD: "Your application is still under review.", REINTERVIEW_REQUIRED: "Aparaitech has requested another interview attempt.", INTERVIEW_COMPLETED: "Your interview is complete and awaiting review." };
export default function CandidateStatusScreen() { const [data, setData] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const load = async () => { setLoading(true); try { setData(await api.candidateStatus()); setError(""); } catch (reason) { setError(reason.message); } finally { setLoading(false); } }; useEffect(() => { load(); }, []); return <Screen><Text selectable style={{ color: colors.text, fontSize: 25, fontWeight: "900" }}>Application status</Text><ErrorBanner message={error} />{data ? <Card><StatusPill>{data.candidate.status.replaceAll("_", " ")}</StatusPill><Text selectable style={{ color: colors.text, fontSize: 21, fontWeight: "900" }}>{data.candidate.fullName}</Text><Text selectable style={{ color: colors.muted }}>{data.candidate.position || "Aparaitech applicant"}</Text><Text selectable style={{ color: colors.muted, lineHeight: 22 }}>{message[data.candidate.status] || "Your application is progressing securely."}</Text></Card> : null}<Button title={loading ? "Loading status" : "Refresh status"} loading={loading} onPress={load} /><Button title="Return to welcome" variant="secondary" onPress={() => router.replace("/")} /></Screen>; }
