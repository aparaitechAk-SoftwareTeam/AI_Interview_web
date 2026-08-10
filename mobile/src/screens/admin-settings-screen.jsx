import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "../api/client";
import { adminSession } from "../services/admin-session";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { Field } from "../components/field";
import { colors } from "../theme/colors";

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const change = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const weight = (key, value) => setSettings((current) => ({ ...current, weights: { ...current.weights, [key]: value } }));
  useEffect(() => { (async () => { try { const token = await adminSession.get(); if (!token) return router.replace("/admin-login"); const data = await api.adminSettings(token); setSettings(data.settings); } catch (reason) { setError(reason.message); } })(); }, []);
  const save = async () => { setSaving(true); try { const token = await adminSession.get(); const numeric = { ...settings, durationMinutes: Number(settings.durationMinutes), maxQuestions: Number(settings.maxQuestions), recordingRetentionDays: Number(settings.recordingRetentionDays), weights: Object.fromEntries(Object.entries(settings.weights).map(([key, value]) => [key, Number(value)])) }; await api.updateSettings(token, numeric); setError(""); } catch (reason) { setError(reason.message); } finally { setSaving(false); } };
  if (!settings) return <Screen><Text selectable style={{ color: colors.muted }}>Loading interview settings…</Text><ErrorBanner message={error} /></Screen>;
  const weightTotal = Object.values(settings.weights).reduce((total, value) => total + Number(value || 0), 0);
  return <Screen><Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>Interview defaults</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>These values apply to new interview attempts. Existing interviews preserve their configuration for auditability.</Text><Card><Field label="Default duration (minutes)" value={String(settings.durationMinutes)} onChangeText={(value) => change("durationMinutes", value)} keyboardType="number-pad" /><Field label="Maximum questions" value={String(settings.maxQuestions)} onChangeText={(value) => change("maxQuestions", value)} keyboardType="number-pad" /><Field label="Recording retention (days)" value={String(settings.recordingRetentionDays)} onChangeText={(value) => change("recordingRetentionDays", value)} keyboardType="number-pad" /><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Switch value={settings.adaptiveDifficulty} onValueChange={(value) => change("adaptiveDifficulty", value)} /><Text selectable style={{ color: colors.text, fontWeight: "800" }}>Adaptive difficulty</Text></View></Card><Card><Text selectable style={{ color: colors.text, fontWeight: "900" }}>Evidence weights ({weightTotal}/100)</Text>{Object.entries(settings.weights).map(([key, value]) => <Field key={key} label={`${key[0].toUpperCase()}${key.slice(1)} %`} value={String(value)} onChangeText={(next) => weight(key, next)} keyboardType="number-pad" />)}</Card><ErrorBanner message={error} /><Button title="Save settings" loading={saving} disabled={weightTotal !== 100} onPress={save} /></Screen>;
}
