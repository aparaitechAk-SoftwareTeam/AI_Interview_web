import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { AudioModule } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { SystemCheckRow } from "../components/system-check-row";
import { ErrorBanner } from "../components/error-banner";
import { colors } from "../theme/colors";
import { speechRecognition } from "../services/speech-service";
import { tts } from "../services/tts-service";

export default function SystemCheckScreen() {
  const { candidateId, candidateName } = useLocalSearchParams();
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [microphone, setMicrophone] = useState(false);
  const [webCameraReady, setWebCameraReady] = useState(false);
  const [webSpeechReady, setWebSpeechReady] = useState(false);
  const [voiceTested, setVoiceTested] = useState(false);
  const [error, setError] = useState("");
  const isWeb = Platform.OS === "web";

  const requestWebMedia = async () => {
    const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia;
    if (!getUserMedia) throw new Error("This browser does not support camera or microphone access. Use the latest Chrome or Edge on desktop.");
    const stream = await globalThis.navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setWebCameraReady(true);
    setMicrophone(true);
    try {
      const available = speechRecognition.isAvailable();
      if (available) await speechRecognition.requestPermissions();
      setWebSpeechReady(available);
    } catch {
      // Voice input is optional on browsers because candidates can type an answer.
      setWebSpeechReady(false);
    }
  };

  const requestAll = async () => {
    setError("");
    try {
      if (isWeb) {
        await requestWebMedia();
        return;
      }
      const camera = cameraPermission?.granted ? cameraPermission : await requestCamera();
      const audio = await AudioModule.requestRecordingPermissionsAsync();
      const speech = await speechRecognition.requestPermissions();
      setMicrophone(Boolean(audio.granted && speech.granted));
      if (!camera.granted || !audio.granted || !speech.granted) setError("Camera, microphone, and speech permissions are required to continue. Enable them in system settings if previously denied.");
    } catch (reason) {
      setError(reason.message || "Unable to request device permissions.");
    }
  };
  const cameraReady = isWeb ? webCameraReady : Boolean(cameraPermission?.granted);
  const ready = Boolean(cameraReady && microphone);

  const testVoice = async () => {
    setError("");
    try {
      await tts.speak("Your Aparaitech interview voice is ready. Please confirm that you can hear this message.");
      setVoiceTested(true);
    } catch (reason) {
      setError(reason.message || "The browser could not play the AI voice. Check that this tab is not muted, then try again.");
    }
  };

  return <Screen>
    <View style={{ gap: 4 }}>
      <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>Device readiness</Text>
      <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>Confirm your camera and microphone before starting. A quiet, well-lit space gives the fairest result.</Text>
      {isWeb ? <Text selectable style={{ color: colors.cyan, fontSize: 12, fontWeight: "700", marginTop: 4 }}>Browser test mode · Chrome or Edge recommended</Text> : null}
    </View>
    <Card>
      {cameraReady ? <CameraView style={{ height: 190, overflow: "hidden", borderRadius: 16 }} facing="front" mirror /> : <View style={{ height: 140, borderRadius: 16, backgroundColor: colors.dark, justifyContent: "center", alignItems: "center", padding: 18 }}><Text selectable style={{ color: colors.white, textAlign: "center" }}>Camera preview appears after you allow browser permission.</Text></View>}
      <SystemCheckRow label="Camera permission" ready={cameraReady} detail={cameraReady ? "Preview is active." : "Required for the interview camera recording."} />
      <SystemCheckRow label="Microphone permission" ready={microphone} detail={microphone ? "Ready for spoken answers and browser recording." : "Required for spoken answers."} />
      {isWeb ? <SystemCheckRow label="Speech recognition" ready={webSpeechReady} detail={webSpeechReady ? "Browser voice input is available after AI speech finishes." : "Optional on this browser. Typed answers remain available."} /> : null}
      <SystemCheckRow label="Resume processing" ready detail="Your uploaded resume is available to the interview engine." />
      <SystemCheckRow label="Attention signals" ready={false} detail="App interruption signals are active. Face/gaze landmarks require the optional native vision module and are not asserted by this build." />
    </Card>
    {isWeb ? <Button title={voiceTested ? "AI voice checked" : "Test AI voice"} variant="secondary" onPress={testVoice} /> : null}
    <ErrorBanner message={error} />
    <Button title={ready ? "Continue to consent" : isWeb ? "Allow browser camera & microphone" : "Grant required permissions"} onPress={ready ? () => router.push({ pathname: "/interview-consent", params: { candidateId, candidateName } }) : requestAll} />
  </Screen>;
}
