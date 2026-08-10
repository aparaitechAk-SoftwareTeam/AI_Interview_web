import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../api/client";
import { PortalButton, PortalCard, PortalError, PortalField, PortalIcon, SecurePortal, portal } from "../components/secure-portal";

function TrustLine({ symbol, title, detail }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><Text style={{ color: "#7BB7FF", fontSize: 18 }}>{symbol}</Text><View style={{ flex: 1 }}><Text selectable style={{ color: "#EAF1FF", fontWeight: "800", fontSize: 13 }}>{title}</Text><Text selectable style={{ color: portal.quiet, fontSize: 12, marginTop: 2 }}>{detail}</Text></View></View>;
}

export default function CandidateAccessScreen() {
  const { code: suppliedCode } = useLocalSearchParams();
  const [code, setCode] = useState(typeof suppliedCode === "string" ? suppliedCode : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const verify = async () => { setLoading(true); setError(""); try { setResult(await api.verifyInvitation(code)); } catch (reason) { setError(reason.message); } finally { setLoading(false); } };
  const nextStep = result?.candidate?.resumeUploaded ? "/system-check" : "/resume-upload";

  return <SecurePortal routeTitle="Candidate access" eyebrow="SECURE CANDIDATE PORTAL" heading="Your interview starts with trust." description="Enter the private invitation code shared by Aparaitech to unlock your secure interview workspace.">
    <PortalCard>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}><PortalIcon symbol="◯" /><View style={{ flex: 1, gap: 4 }}><Text selectable style={{ color: portal.heading, fontSize: 20, fontWeight: "900" }}>Invitation verification</Text><Text selectable style={{ color: portal.body, fontSize: 13, lineHeight: 19 }}>Your code is checked privately before any interview permissions are requested.</Text></View></View>
      <PortalField label="Invitation code" icon="◇" accessibilityLabel="Invitation code" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="APAI-7F29-KQ81" />
      <PortalError message={error} />
      <PortalButton title="Verify invitation" accessibilityLabel="Verify invitation" onPress={verify} loading={loading} disabled={code.trim().length < 6} />
      <View style={{ height: 1, backgroundColor: "rgba(130, 160, 211, 0.18)" }} />
      <TrustLine symbol="◇" title="Private validation" detail="Invitation attempts are rate-limited and protected." />
      <TrustLine symbol="▣" title="Consent first" detail="Camera and microphone stay off until you explicitly agree." />
    </PortalCard>

    {result ? <PortalCard accent="violet">
      <Text selectable style={{ color: "#8DBEFF", fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>INVITATION VERIFIED</Text>
      <Text selectable style={{ color: portal.heading, fontSize: 22, fontWeight: "900" }}>{result.candidate.fullName}</Text>
      <Text selectable style={{ color: portal.body, lineHeight: 20 }}>{result.candidate.position || "Aparaitech candidate"}</Text>
      <PortalButton title={result.interviewAccess ? (result.candidate.resumeUploaded ? "Continue to system check" : "Upload your resume") : "View application status"} variant="violet" onPress={() => result.interviewAccess ? router.push({ pathname: nextStep, params: { candidateId: result.candidate.id, candidateName: result.candidate.fullName } }) : router.push("/candidate-status")} />
    </PortalCard> : null}
  </SecurePortal>;
}
