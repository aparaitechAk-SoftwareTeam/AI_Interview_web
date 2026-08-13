import { useMemo, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { api } from "../api/client";
import { adminSession } from "../services/admin-session";
import { openInvitationWhatsApp } from "../services/whatsapp-click-to-chat";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Field } from "../components/field";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { colors } from "../theme/colors";

const acceptedTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"];
const fileLabel = (asset) => asset?.name || asset?.fileName || "Candidate list";
const resultTone = (status) => status === "CREATED" ? colors.success : status === "FAILED" ? colors.danger : colors.warning;

export default function AdminBulkCandidatesScreen() {
  const [asset, setAsset] = useState(null); const [preview, setPreview] = useState(null); const [results, setResults] = useState(null);
  const [position, setPosition] = useState(""); const [validityHours, setValidityHours] = useState("168"); const [singleUse, setSingleUse] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [opened, setOpened] = useState(new Set());
  const validRows = useMemo(() => preview?.rows?.filter((row) => row.valid) || [], [preview]);
  const createdResults = useMemo(() => results?.results?.filter((item) => item.status === "CREATED") || [], [results]);

  const chooseFile = async () => { const selection = await DocumentPicker.getDocumentAsync({ type: acceptedTypes, copyToCacheDirectory: true }); if (!selection.canceled) { setAsset(selection.assets[0]); setPreview(null); setResults(null); setError(""); } };
  const chooseImage = async (camera = false) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError(`${camera ? "Camera" : "Photo"} permission is required.`);
    const selection = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (!selection.canceled) { const picked = selection.assets[0]; setAsset({ ...picked, name: picked.fileName || `candidate-list-${Date.now()}.jpg`, mimeType: picked.mimeType || "image/jpeg" }); setPreview(null); setResults(null); setError(""); }
  };
  const scan = async () => {
    if (!asset) return setError("Choose a file, screenshot, or photo first.");
    setLoading(true); setError("");
    try { const token = await adminSession.get(); if (!token) return router.replace("/admin-login"); setPreview((await api.scanCandidateImport(token, asset, position)).preview); }
    catch (reason) { setError(reason.message); } finally { setLoading(false); }
  };
  const importRows = async () => {
    setLoading(true); setError("");
    try { const token = await adminSession.get(); if (!token) return router.replace("/admin-login"); const rows = validRows.map(({ valid: _valid, errors: _errors, rowNumber: _rowNumber, ...row }) => row); setResults(await api.importCandidates(token, { rows, validityHours: Number(validityHours), singleUse })); }
    catch (reason) { setError(reason.message); } finally { setLoading(false); }
  };
  const openWhatsApp = async (item) => { try { await openInvitationWhatsApp({ candidate: item.candidate, invitation: item.invitation }); setOpened((current) => new Set(current).add(item.candidate.id)); } catch (reason) { setError(reason.message); } };
  const nextWhatsApp = createdResults.find((item) => !opened.has(item.candidate.id));

  return <Screen>
    <View style={{ gap: 5 }}><Text selectable style={{ color: colors.text, fontSize: 25, fontWeight: "900" }}>Bulk Smart Import</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>Scan a roster, verify every candidate, then create private invitations safely.</Text></View>
    <Card style={{ gap: 10 }}><Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>Prepare your file</Text><Text selectable style={{ color: colors.muted, lineHeight: 20 }}>Use one candidate per row. Recommended columns:</Text><Text selectable style={{ color: "#C9DAFF", fontWeight: "800", lineHeight: 21 }}>Serial No. | Full Name | Email | Mobile/WhatsApp | Position | College | Qualification</Text><Text selectable style={{ color: colors.warning, fontSize: 12, lineHeight: 18 }}>Full Name, Email and Mobile are required. Keep country code in phone numbers (example: +91 9876543210). Never place two candidates in one row. Supported: XLSX, CSV, PDF, DOC, DOCX, screenshot or clear photo.</Text></Card>
    <Field label="Default position for blank rows (optional)" value={position} onChangeText={setPosition} placeholder="e.g. Java Developer Intern" />
    <View style={{ gap: 9 }}><Button title="Choose Excel / PDF / Word file" variant="secondary" onPress={chooseFile} /><Button title="Choose roster screenshot" variant="secondary" onPress={() => chooseImage(false)} /><Button title="Take roster photo" variant="secondary" onPress={() => chooseImage(true)} /></View>
    {asset ? <Card><Text selectable style={{ color: colors.text, fontWeight: "900" }}>{fileLabel(asset)}</Text><Text selectable style={{ color: colors.muted, fontSize: 12 }}>Ready for secure preview. No candidate is created during scanning.</Text></Card> : null}
    <ErrorBanner message={error} /><Button title="Smart scan and preview" loading={loading && !preview} disabled={!asset} onPress={scan} />
    {preview ? <><Card style={{ gap: 8 }}><Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Preview: {preview.valid} ready, {preview.invalid} need correction</Text><Text selectable style={{ color: colors.muted, lineHeight: 19 }}>Only green READY rows will be imported. Invalid or duplicate rows remain excluded.</Text></Card>{preview.rows.map((row) => <Card key={`${row.rowNumber}-${row.email}-${row.phone}`} style={{ gap: 5, borderColor: row.valid ? "rgba(81,217,153,.45)" : "rgba(255,127,148,.5)" }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}><Text selectable style={{ color: colors.text, fontWeight: "900", flex: 1 }}>{row.serial}. {row.fullName || "Missing name"}</Text><Text selectable style={{ color: row.valid ? colors.success : colors.danger, fontWeight: "900", fontSize: 11 }}>{row.valid ? "READY" : "FIX FILE"}</Text></View><Text selectable style={{ color: colors.muted, fontSize: 12 }}>{row.email || "No email"} · {row.phone || "No phone"}</Text>{row.position ? <Text selectable style={{ color: "#B9CCEF", fontSize: 12 }}>{row.position}</Text> : null}{row.errors.map((message) => <Text selectable key={message} style={{ color: colors.danger, fontSize: 12 }}>• {message}</Text>)}</Card>)}<Field label="Invitation validity (hours)" value={validityHours} onChangeText={setValidityHours} keyboardType="number-pad" /><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={singleUse} onValueChange={setSingleUse} /><Text selectable style={{ color: colors.text, fontWeight: "800" }}>Single-use invitation codes</Text></View><Button title={`Confirm and email ${validRows.length} candidates`} loading={loading && !!preview} disabled={!validRows.length || !!results} onPress={importRows} /></> : null}
    {results ? <><Card style={{ gap: 7 }}><Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>Import complete</Text><Text selectable style={{ color: colors.success, fontWeight: "800" }}>{results.summary.created} candidates created</Text><Text selectable style={{ color: colors.muted }}>{results.summary.skipped} duplicates skipped · {results.summary.failed} failed</Text><Text selectable style={{ color: colors.warning, fontSize: 12, lineHeight: 18 }}>Invitation emails were attempted separately for each candidate. WhatsApp is free Click-to-Chat: open each correct chat below and manually tap Send in WhatsApp.</Text></Card>{nextWhatsApp ? <Button title={`Open next WhatsApp (${opened.size + 1}/${createdResults.length})`} onPress={() => openWhatsApp(nextWhatsApp)} /> : createdResults.length ? <Text selectable style={{ color: colors.success, fontWeight: "900", textAlign: "center" }}>All WhatsApp chats were opened for manual sending.</Text> : null}{results.results.map((item, index) => <Card key={`${item.candidate?.id || item.input?.email || index}`} style={{ gap: 6 }}><Text selectable style={{ color: colors.text, fontWeight: "900" }}>{item.candidate?.fullName || item.input?.fullName}</Text><Text selectable style={{ color: resultTone(item.status), fontWeight: "800" }}>{item.status.replaceAll("_", " ")}{item.invitation ? ` · ${item.invitation.code}` : ""}</Text>{item.invitation ? <Text selectable style={{ color: item.invitation.emailDelivery?.status === "SENT" ? colors.success : colors.warning, fontSize: 12 }}>Email: {item.invitation.emailDelivery?.status || "PENDING"}</Text> : <Text selectable style={{ color: colors.danger, fontSize: 12 }}>{item.error}</Text>}{item.status === "CREATED" ? <Pressable accessibilityRole="button" onPress={() => openWhatsApp(item)} style={({ pressed }) => ({ paddingVertical: 9, opacity: pressed ? .7 : 1 })}><Text selectable style={{ color: "#8FB8FF", fontWeight: "900" }}>{opened.has(item.candidate.id) ? "Reopen correct WhatsApp chat" : "Open this candidate's WhatsApp"}</Text></Pressable> : null}</Card>)}<Button title="Open Candidate Registry" variant="secondary" onPress={() => router.push("/admin-candidate-registry")} /></> : null}
  </Screen>;
}
