import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "../api/client";
import { adminSession } from "../services/admin-session";
import { PortalButton, PortalCard, PortalError, PortalField, PortalIcon, SecurePortal, portal } from "../components/secure-portal";

export default function AdminLoginScreen() {
  const [username, setUsername] = useState("Aparaitech.org");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const login = async () => { setLoading(true); setError(""); try { const data = await api.adminLogin(username, password); await adminSession.set(data.token); router.replace("/admin-dashboard"); } catch (reason) { setError(reason.message); } finally { setLoading(false); } };

  return <SecurePortal routeTitle="Administrator portal" eyebrow="RESTRICTED ADMIN PORTAL" heading="Authorized recruitment control." description="Administrative actions are authenticated, recorded and preserved in the immutable audit trail." accent="violet">
    <PortalCard accent="violet">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}><PortalIcon symbol="♕" tone="violet" /><View style={{ flex: 1, gap: 4 }}><Text selectable style={{ color: portal.heading, fontSize: 20, fontWeight: "900" }}>Administrator sign in</Text><Text selectable style={{ color: portal.body, fontSize: 13, lineHeight: 19 }}>Use your approved Aparaitech credentials. Access is logged for audit review.</Text></View></View>
      <PortalField label="Username" icon="◯" accessibilityLabel="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="Administrator username" />
      <PortalField label="Password" icon="◇" accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" />
      <PortalError message={error} />
      <PortalButton title="Sign in securely" accessibilityLabel="Sign in securely" variant="violet" onPress={login} loading={loading} disabled={!username.trim() || !password} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2 }}><Text style={{ color: "#B578FF", fontSize: 16 }}>◇</Text><Text selectable style={{ color: portal.quiet, fontSize: 12, flex: 1, lineHeight: 17 }}>Administrator sessions expire automatically and cannot access candidate media without server authorization.</Text></View>
    </PortalCard>
  </SecurePortal>;
}
