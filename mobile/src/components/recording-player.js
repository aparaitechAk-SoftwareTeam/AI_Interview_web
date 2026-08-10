import { Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { apiBaseUrl } from "../api/client";
import { colors } from "../theme/colors";

export function RecordingPlayer({ interviewId, token }) {
  const player = useVideoPlayer({ uri: `${apiBaseUrl()}/api/admin/interviews/${interviewId}/recording`, headers: { Authorization: `Bearer ${token}` } }, (instance) => { instance.loop = false; });
  return <View style={{ gap: 8 }}><Text selectable style={{ color: colors.text, fontWeight: "800" }}>Protected interview recording</Text><VideoView player={player} style={{ width: "100%", height: 220, borderRadius: 14, overflow: "hidden" }} nativeControls contentFit="contain" /></View>;
}
