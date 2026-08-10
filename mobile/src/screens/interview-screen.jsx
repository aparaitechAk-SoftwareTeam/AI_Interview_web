import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { CameraView } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../api/client";
import { Screen } from "../components/screen";
import { Card } from "../components/card";
import { Button } from "../components/button";
import { ErrorBanner } from "../components/error-banner";
import { InterviewRobot } from "../components/robot";
import { StatusPill } from "../components/status-pill";
import { colors } from "../theme/colors";
import { interviewReducer, initialInterviewState } from "../store/interview-reducer";
import { InterviewState } from "@aparaitech/shared";
import { speechRecognition } from "../services/speech-service";
import { tts } from "../services/tts-service";
import { recordingService } from "../services/recording-service";
import { monitorInterviewIntegrity } from "../services/integrity-service";
import { sessionStore } from "../services/session-store";
import { useNetworkStatus } from "../hooks/use-network-status";

function formatElapsed(seconds) { return new Date(seconds * 1000).toISOString().slice(11, 19); }
function parseQuestion(value) { try { return value ? JSON.parse(value) : null; } catch { return null; } }
function Notice({ message, tone = "info" }) {
  if (!message) return null;
  const palette = tone === "warning" ? { backgroundColor: "rgba(118, 76, 17, 0.34)", borderColor: "rgba(255, 194, 91, 0.6)", color: "#FFE0A0" } : { backgroundColor: "rgba(30, 70, 126, 0.34)", borderColor: "rgba(104, 160, 255, 0.55)", color: "#CDE2FF" };
  return <View style={{ backgroundColor: palette.backgroundColor, borderColor: palette.borderColor, borderWidth: 1, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: palette.color, lineHeight: 20 }}>{message}</Text></View>;
}

export default function InterviewScreen() {
  const params = useLocalSearchParams();
  const interviewId = String(params.id);
  const candidateName = String(params.candidateName || "Candidate");
  const [machine, dispatch] = useReducer(interviewReducer, initialInterviewState);
  const [question, setQuestion] = useState(() => parseQuestion(params.firstQuestion));
  const [elapsed, setElapsed] = useState(0);
  const [manual, setManual] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [voiceHint, setVoiceHint] = useState("");
  const [recordingRetryPending, setRecordingRetryPending] = useState(() => params.recordingOnly === "true");
  const online = useNetworkStatus();
  const cameraRef = useRef(null); const recordingPromise = useRef(null); const recordingStarted = useRef(false); const pendingRecording = useRef(null); const questionRef = useRef(question); const lastSpoken = useRef(null); const submitting = useRef(false); const submitRef = useRef(null);
  const [startedAt] = useState(() => Number.isNaN(Date.parse(String(params.startedAt))) ? Date.now() : Date.parse(String(params.startedAt)));

  const sendEvent = useCallback((id, event) => api.event(id, event), []);
  const saveRecovery = useCallback(() => sessionStore.saveRecovery({ interviewId, candidateName, startedAt: new Date(startedAt).toISOString(), savedAt: new Date().toISOString() }), [candidateName, interviewId, startedAt]);

  const finish = useCallback(async () => {
    dispatch({ type: "PHASE", phase: InterviewState.FINISHING });
    await tts.stop(); await speechRecognition.cancel().catch(() => {});
    let finalUploadNote = "";
    try {
      await recordingService.stop(cameraRef);
      const media = await recordingPromise.current;
      if (media?.uri || media?.blob) {
        const durableMedia = media?.uri && recordingService.supportsPersistentRecovery !== false ? await recordingService.preserve(media, interviewId) : media;
        try {
          await recordingService.uploadInChunks(interviewId, durableMedia, elapsed);
          await sessionStore.clearPendingRecording();
          await recordingService.removePersisted(durableMedia).catch(() => {});
        } catch {
          pendingRecording.current = durableMedia;
          if (durableMedia?.uri && recordingService.supportsPersistentRecovery !== false) await sessionStore.savePendingRecording({ interviewId, uri: durableMedia.uri, durationSeconds: elapsed });
          finalUploadNote = "Your answers are complete. Keep this screen open and retry the protected recording upload when your connection is stable.";
          setUploadNote(finalUploadNote); setRecordingRetryPending(true); dispatch({ type: "PHASE", phase: InterviewState.COMPLETED });
          return;
        }
      } else {
        finalUploadNote = "Interview completed. This device could not finalize camera recording; submitted answers are safe.";
        sendEvent(interviewId, { type: "RECORDING_INTERRUPTION", timestamp: new Date().toISOString(), metadata: { mediaUnavailable: true } }).catch(() => {});
      }
    } catch {
      finalUploadNote = "Interview completed. Camera recording could not be finalized on this device; submitted answers are safe.";
      sendEvent(interviewId, { type: "RECORDING_INTERRUPTION", timestamp: new Date().toISOString() }).catch(() => {});
    }
    await sessionStore.clearRecovery();
    setUploadNote(finalUploadNote); dispatch({ type: "PHASE", phase: InterviewState.COMPLETED });
    router.replace({ pathname: "/interview-complete", params: { uploadNote: finalUploadNote } });
  }, [elapsed, interviewId, sendEvent]);

  const syncPending = useCallback(async () => {
    const pending = await sessionStore.getPendingAnswer();
    if (!pending || pending.interviewId !== interviewId || !online) return;
    try { const result = await api.submitAnswer(interviewId, pending.answer, pending.idempotencyKey); await sessionStore.clearPendingAnswer(); if (result.completed) await finish(); else setQuestion(result.currentQuestion); } catch { /* kept for the next reconnect */ }
  }, [finish, interviewId, online]);

  const submitTranscript = useCallback(async (transcript, source = "SPEECH") => {
    const current = questionRef.current;
    if (!current || submitting.current || !transcript.trim()) return;
    submitting.current = true; setVoiceHint(""); dispatch({ type: "PHASE", phase: InterviewState.ANALYZING });
    const idempotencyKey = `${interviewId}:${current.id}`;
    const answer = { questionId: current.id, transcript: transcript.trim(), transcriptConfidence: source === "SPEECH" ? 0.8 : undefined, source };
    await sessionStore.savePendingAnswer({ interviewId, answer, idempotencyKey }); await saveRecovery();
    try {
      const result = await api.submitAnswer(interviewId, answer, idempotencyKey);
      await sessionStore.clearPendingAnswer();
      if (result.completed) await finish();
      else { setManual(""); dispatch({ type: "TRANSCRIPT", value: "" }); dispatch({ type: "PHASE", phase: InterviewState.GENERATING_NEXT }); setQuestion(result.currentQuestion); }
    } catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: reason.message }); }
    finally { submitting.current = false; }
  }, [finish, interviewId, saveRecovery]);

  const beginListening = useCallback(async () => {
    try { await tts.stop(); setVoiceHint(""); dispatch({ type: "PHASE", phase: InterviewState.LISTENING }); await speechRecognition.start("en-IN"); }
    catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER }); setVoiceHint(reason.message || "Voice input is unavailable. Type your answer below."); }
  }, []);
  const speakQuestion = useCallback(async (nextQuestion) => {
    if (!nextQuestion || lastSpoken.current === nextQuestion.id) return;
    lastSpoken.current = nextQuestion.id; dispatch({ type: "TRANSCRIPT", value: "" }); dispatch({ type: "PHASE", phase: InterviewState.AI_SPEAKING });
    try { await speechRecognition.cancel().catch(() => {}); await tts.speak(nextQuestion.text); dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER }); await beginListening(); }
    catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER }); setVoiceHint(`${reason.message || "Audio is unavailable."} You can type your answer below.`); }
  }, [beginListening]);

  useEffect(() => { questionRef.current = question; }, [question]);
  useEffect(() => { submitRef.current = submitTranscript; }, [submitTranscript]);
  useEffect(() => {
    speechRecognition.attach({
      onStart: () => dispatch({ type: "PHASE", phase: InterviewState.LISTENING }),
      onPartial: (value) => dispatch({ type: "TRANSCRIPT", value }),
      onFinal: (value) => { if (!value.trim()) return; dispatch({ type: "TRANSCRIPT", value }); speechRecognition.cancel().catch(() => {}); submitRef.current?.(value); },
      onError: ({ code, message, transient }) => {
        if (code === "aborted") return;
        dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER });
        setVoiceHint(transient ? "Voice input is ready when you are. You can also type your answer below." : `${message} You can type your answer below.`);
      }
    });
    return () => speechRecognition.dispose();
  }, []);
  useEffect(() => { if (question) speakQuestion(question); }, [question, speakQuestion]);
  useEffect(() => { const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000); return () => clearInterval(timer); }, [startedAt]);
  useEffect(() => { saveRecovery().catch(() => {}); }, [saveRecovery]);
  useEffect(() => monitorInterviewIntegrity(interviewId, sendEvent, {
    onBackAttempt: () => Alert.alert("Interview in progress", "This interview stays open. Use Submit & next to continue, or Finish only when you are done."),
    onBackground: () => saveRecovery().catch(() => {}),
    onRecovered: (durationMs) => { if (durationMs > 2000) setVoiceHint("Welcome back. Your interview is still active and your answer progress is protected."); }
  }), [interviewId, saveRecovery, sendEvent]);
  useEffect(() => { syncPending(); }, [syncPending]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await api.currentInterview(interviewId);
        if (!mounted) return;
        if (current.completed) { if (params.recordingOnly === "true") return; await sessionStore.clearRecovery(); router.replace("/candidate-status"); return; }
        if (current.currentQuestion) setQuestion(current.currentQuestion);
      } catch { /* The saved route remains usable while Render wakes or reconnects. */ }
    })();
    return () => { mounted = false; };
  }, [interviewId, params.recordingOnly]);
  useEffect(() => { (async () => { const pending = await sessionStore.getPendingRecording(); if (pending?.interviewId === interviewId && online) { pendingRecording.current = { uri: pending.uri }; setUploadNote("A protected recording upload is ready to resume."); } })(); }, [interviewId, online]);

  const onCameraReady = () => {
    if (recordingStarted.current) return;
    recordingStarted.current = true;
    recordingPromise.current = recordingService.start(cameraRef).catch((reason) => { sendEvent(interviewId, { type: "RECORDING_INTERRUPTION", timestamp: new Date().toISOString(), metadata: { message: reason.message } }).catch(() => {}); setUploadNote("Camera recording could not start. Your answers remain protected."); return null; });
  };
  const retryRecordingUpload = async () => {
    const media = pendingRecording.current || await sessionStore.getPendingRecording();
    if (!media) return;
    setUploadNote("Uploading protected recording...");
    try {
      await recordingService.uploadInChunks(interviewId, media, elapsed);
      await sessionStore.clearPendingRecording(); await recordingService.removePersisted(media).catch(() => {}); pendingRecording.current = null;
      await sessionStore.clearRecovery(); setRecordingRetryPending(false);
      router.replace({ pathname: "/interview-complete", params: { uploadNote: "Interview recording uploaded securely for recruiter review." } });
    } catch { setUploadNote("Recording upload needs a stable connection. Keep this screen open and try again."); }
  };
  const endNow = () => Alert.alert("Finish interview?", "Submitted answers will be evaluated. The protected recording will be uploaded before the interview is closed.", [{ text: "Continue" }, { text: "Finish", style: "destructive", onPress: async () => { try { await api.completeInterview(interviewId); await finish(); } catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: reason.message }); } } }]);
  const submitManual = async () => { await speechRecognition.stop().catch(() => {}); await submitTranscript(manual, "MANUAL"); };
  const tone = online ? "success" : "warning";

  if (recordingRetryPending) return <Screen><View style={{ flexGrow: 1, justifyContent: "center", gap: 16 }}><InterviewRobot state={InterviewState.FINISHING} /><Card><Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>Finish protected recording upload</Text><Text selectable style={{ color: colors.muted, lineHeight: 22 }}>Your answers are complete. Keep this app open until the recording is uploaded so it is available in the administrator profile.</Text></Card><Notice message={uploadNote} tone="warning" /><Button title="Retry protected recording upload" loading={!online} disabled={!online} onPress={retryRecordingUpload} /></View></Screen>;
  return <Screen style={{ paddingBottom: 56 }}><View style={{ gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text selectable style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{candidateName}</Text><Text selectable style={{ color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatElapsed(elapsed)} elapsed</Text></View><View style={{ alignItems: "flex-end", gap: 5 }}><StatusPill tone={tone}>{online ? "CONNECTED" : "RECONNECTING"}</StatusPill><Text selectable style={{ color: colors.danger, fontWeight: "800", fontSize: 12 }}>REC PROTECTED</Text></View></View><Notice message="Interview in progress. Answers save safely before submission. Keep this screen open while the camera recording is active." /><View style={{ alignItems: "center", minHeight: 174, justifyContent: "center" }}><InterviewRobot state={machine.phase} /><View style={{ position: "absolute", right: 0, top: 0, width: 112, height: 152, overflow: "hidden", borderRadius: 16, borderWidth: 2, borderColor: colors.white }}><CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" mirror mode="video" onCameraReady={onCameraReady} /></View></View><Card><Text selectable style={{ color: colors.brand, fontWeight: "900", fontSize: 12 }}>QUESTION {question?.sequence || "-"}</Text><Text selectable style={{ color: colors.text, fontSize: 19, lineHeight: 27, fontWeight: "800" }}>{question?.text || "Recovering your current interview question..."}</Text></Card><Card style={{ gap: 8 }}><Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>LIVE TRANSCRIPT</Text><Text selectable style={{ color: machine.transcript ? colors.text : colors.muted, minHeight: 40, lineHeight: 21 }}>{machine.transcript || (machine.phase === InterviewState.LISTENING ? "Listening..." : "Your answer will appear here.")}</Text></Card><Notice message={voiceHint || uploadNote} tone="warning" /><ErrorBanner message={machine.error} /><TextInput value={manual} onChangeText={setManual} placeholder="Type your answer here if you prefer" placeholderTextColor={colors.muted} multiline scrollEnabled style={{ minHeight: 110, maxHeight: 220, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, color: colors.text, backgroundColor: colors.card, textAlignVertical: "top" }} /><View style={{ gap: 10 }}><Button title="Submit answer & next question" variant="secondary" loading={machine.phase === InterviewState.ANALYZING} disabled={!manual.trim() || machine.phase === InterviewState.ANALYZING} onPress={submitManual} /><Pressable onPress={endNow} style={({ pressed }) => ({ alignItems: "center", paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}><Text selectable style={{ color: colors.danger, fontWeight: "800" }}>Finish interview</Text></Pressable></View></View></Screen>;
}
