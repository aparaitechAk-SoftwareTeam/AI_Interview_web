import { useState } from "react";
import { Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../api/client";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { colors } from "../theme/colors";

const imageMimeByExtension = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };
function extension(value = "") { return value.split(".").pop()?.toLowerCase(); }
function photoAsset(asset) {
  const name = asset.fileName || `resume-photo-${Date.now()}.${extension(asset.uri) || "jpg"}`;
  return { uri: asset.uri, name, mimeType: asset.mimeType || imageMimeByExtension[extension(name)] || "image/jpeg", size: asset.fileSize || 0, file: asset.file, source: "photo" };
}

export default function ResumeUploadScreen() {
  const { candidateId, candidateName } = useLocalSearchParams();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const chooseDocument = async () => {
    setError("");
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], copyToCacheDirectory: true, multiple: false });
    if (!result.canceled) setAsset({ ...result.assets[0], source: "document" });
  };
  const choosePhoto = async () => {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError("Photo library permission is needed to select a resume photo.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.92, allowsEditing: false, exif: false });
    if (!result.canceled) setAsset(photoAsset(result.assets[0]));
  };
  const takePhoto = async () => {
    setError("");
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError("Camera permission is needed to photograph your resume.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.92, allowsEditing: false, exif: false });
    if (!result.canceled) setAsset(photoAsset(result.assets[0]));
  };
  const upload = async () => { setLoading(true); setError(""); try { await api.uploadResume(candidateId, asset); router.replace({ pathname: "/system-check", params: { candidateId, candidateName } }); } catch (reason) { setError(reason.message); } finally { setLoading(false); } };
  const isPhoto = asset?.source === "photo";

  return <Screen>
    <View style={{ gap: 5 }}><Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>Resume for {candidateName || "candidate"}</Text><Text selectable style={{ color: colors.muted, lineHeight: 21 }}>Upload a PDF/DOC/DOCX, or take a clear photo of the resume. AI securely reads photographed and scanned resumes.</Text></View>
    <Card style={{ gap: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(68, 103, 255, 0.23)", borderWidth: 1, borderColor: "rgba(119, 158, 255, 0.35)" }}><Text style={{ color: "#C6D9FF", fontSize: 21 }}>{isPhoto ? "◉" : "▤"}</Text></View><View style={{ flex: 1 }}><Text selectable style={{ color: colors.text, fontWeight: "900" }}>{asset ? asset.name : "No resume selected"}</Text><Text selectable style={{ color: colors.muted, marginTop: 3 }}>{asset ? `${Math.ceil((asset.size || 0) / 1024)} KB · ${isPhoto ? "Photo OCR" : asset.mimeType || "document"}` : "Choose a document or a clear photo"}</Text></View></View>
      <View style={{ flexDirection: "row", gap: 9 }}><View style={{ flex: 1 }}><Button title="Choose file" variant="secondary" onPress={chooseDocument} /></View><View style={{ flex: 1 }}><Button title="Choose photo" variant="secondary" onPress={choosePhoto} /></View></View>
      <Button title="Take resume photo" variant="secondary" onPress={takePhoto} />
      <Button title={isPhoto ? "Read photo with AI" : "Upload and process"} onPress={upload} loading={loading} disabled={!asset} />
    </Card>
    <Card style={{ backgroundColor: "rgba(46, 68, 142, 0.28)", borderColor: "rgba(99, 145, 255, 0.34)", gap: 8 }}><Text selectable style={{ color: "#DCE7FF", fontWeight: "900" }}>For best photo results</Text><Text selectable style={{ color: "#AFBFE0", fontSize: 13, lineHeight: 20 }}>Place every line in frame, use bright even light, avoid glare and shadows, and photograph each page separately. AI extracts only visible resume text; it never invents missing details.</Text></Card>
    <ErrorBanner message={error} />
    <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Files are signature-validated before storage. Resume images are processed only to prepare your interview and remain access-controlled.</Text>
  </Screen>;
}
