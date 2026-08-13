import { Text, View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { apiBaseUrl } from "../api/client";
import { colors } from "../theme/colors";

export function RecordingPlayer({ interviewId, token }) {
  const player = useVideoPlayer({ uri: `${apiBaseUrl()}/api/admin/interviews/${interviewId}/recording`, headers: { Authorization: `Bearer ${token}` } }, (instance) => { instance.loop = false; });
  const playback = useEvent(player, "statusChange", { status: player.status });
  return <View style={{ gap: 8 }}><Text selectable style={{ color: colors.text, fontWeight: "800" }}>Protected interview video + audio</Text>{playback.status === "loading" || playback.status === "idle" ? <Text selectable style={{ color: colors.muted }}>Loading authenticated recording...</Text> : null}{playback.status === "error" ? <Text selectable style={{ color: colors.danger, lineHeight: 19 }}>Playback could not start: {playback.error?.message || "refresh this candidate profile and retry."}</Text> : null}<VideoView player={player} style={{ width: "100%", height: 220, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" }} nativeControls contentFit="contain" /></View>;
}
