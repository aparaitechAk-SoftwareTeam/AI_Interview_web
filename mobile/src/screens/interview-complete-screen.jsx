import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { colors } from "../theme/colors";

export default function InterviewCompleteScreen() { const { uploadNote } = useLocalSearchParams(); return <Screen style={{ flexGrow: 1, justifyContent: "center" }}><Card style={{ alignItems: "center", paddingVertical: 36 }}><View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#D1FADF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.success, fontSize: 30, fontWeight: "900" }}>✓</Text></View><Text selectable style={{ color: colors.text, fontSize: 25, fontWeight: "900", textAlign: "center" }}>Interview completed</Text><Text selectable style={{ color: colors.muted, lineHeight: 22, textAlign: "center" }}>Thank you. Your responses and supporting evidence have been sent for authorized recruiter review. Internal scores are not shown here.</Text>{uploadNote ? <Text selectable style={{ color: colors.warning, lineHeight: 20, textAlign: "center" }}>{uploadNote}</Text> : null}<Button title="Check application status" onPress={() => router.replace("/candidate-status")} /></Card></Screen>; }
