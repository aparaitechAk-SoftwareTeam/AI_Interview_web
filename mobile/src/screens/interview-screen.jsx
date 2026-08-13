import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { CameraView } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
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
  const palette = tone === "warning"
    ? { backgroundColor: "rgba(118, 76, 17, 0.34)", borderColor: "rgba(255, 194, 91, 0.6)", color: "#FFE0A0" }
    : { backgroundColor: "rgba(30, 70, 126, 0.34)", borderColor: "rgba(104, 160, 255, 0.55)", color: "#CDE2FF" };
  return <View style={{ backgroundColor: palette.backgroundColor, borderColor: palette.borderColor, borderWidth: 1, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: palette.color, lineHeight: 20 }}>{message}</Text></View>;
}

const recordingLabels = {
  WAITING_CAMERA: { text: "CAMERA STARTING", tone: "warning" },
  STARTING: { text: "RECORDING STARTING", tone: "warning" },
  ACTIVE: { text: "VIDEO + AUDIO RECORDING", tone: "success" },
  UPLOADING: { text: "SECURE UPLOAD", tone: "warning" },
  READY: { text: "RECORDING SAVED", tone: "success" },
  ERROR: { text: "RECORDING NEEDS ATTENTION", tone: "danger" }
};

export default function InterviewScreen() {
  useKeepAwake("aparaitech-protected-interview");
  const params = useLocalSearchParams();
  const interviewId = String(params.id);
  const candidateName = String(params.candidateName || "Candidate");
  const recoveryUploadOnly = params.recordingOnly === "true";
  const [machine, dispatch] = useReducer(interviewReducer, initialInterviewState);
  const [question, setQuestion] = useState(() => parseQuestion(params.firstQuestion));
  const [elapsed, setElapsed] = useState(0);
  const [manual, setManual] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [voiceHint, setVoiceHint] = useState("");
  const [micState, setMicState] = useState("WAITING");
  const [recordingState, setRecordingState] = useState(recoveryUploadOnly ? "ERROR" : "WAITING_CAMERA");
  const [recordingRetryPending, setRecordingRetryPending] = useState(recoveryUploadOnly);
  const [warnings, setWarnings] = useState([]);
  const online = useNetworkStatus();

  const cameraRef = useRef(null);
  const recordingPromise = useRef(null);
  const recordingStarted = useRef(false);
  const recordingStopping = useRef(false);
  const recordingStateRef = useRef(recordingState);
  const pendingRecording = useRef(null);
  const questionRef = useRef(question);
  const lastSpoken = useRef(null);
  const submitting = useRef(false);
  const finishing = useRef(false);
  const submitRef = useRef(null);
  const acceptingSpeech = useRef(false);
  const speechFinalTimer = useRef(null);
  const lastMicEventAt = useRef(0);
  const previousOnline = useRef(online);
  const elapsedRef = useRef(0);
  const [startedAt] = useState(() => Number.isNaN(Date.parse(String(params.startedAt))) ? Date.now() : Date.parse(String(params.startedAt)));

  const addWarning = useCallback((type, message) => {
    setWarnings((current) => [{ id: `${type}-${Date.now()}`, type, message, timestamp: new Date().toISOString() }, ...current.filter((item) => item.type !== type)].slice(0, 5));
  }, []);

  const sendEvent = useCallback(async (id, event) => {
    try { return await api.event(id, event); }
    catch (error) {
      if (error.code !== "INTERVIEW_NOT_ACTIVE") await sessionStore.enqueuePendingEvent({ interviewId: id, event });
      throw error;
    }
  }, []);

  const signalWarning = useCallback((type, message, metadata = {}) => {
    addWarning(type, message);
    sendEvent(interviewId, { type, timestamp: new Date().toISOString(), metadata: { candidateVisible: true, message, ...metadata } }).catch(() => {});
  }, [addWarning, interviewId, sendEvent]);

  const flushPendingEvents = useCallback(async () => {
    if (!online) return;
    const queued = await sessionStore.getPendingEvents();
    const delivered = [];
    for (let index = 0; index < queued.length; index += 1) {
      const item = queued[index];
      try { await api.event(item.interviewId, item.event); delivered.push(item.queueId || `${item.interviewId}:${item.event?.timestamp || "unknown"}:${item.event?.type || "event"}`); }
      catch (error) {
        if (error.code === "INTERVIEW_NOT_ACTIVE") { delivered.push(item.queueId || `${item.interviewId}:${item.event?.timestamp || "unknown"}:${item.event?.type || "event"}`); continue; }
        break;
      }
    }
    if (delivered.length) await sessionStore.removePendingEvents(delivered);
  }, [online]);

  const saveRecovery = useCallback(() => sessionStore.saveRecovery({
    interviewId,
    candidateName,
    startedAt: new Date(startedAt).toISOString(),
    savedAt: new Date().toISOString()
  }), [candidateName, interviewId, startedAt]);

  const uploadProtectedRecording = useCallback(async (media, durationSeconds) => {
    pendingRecording.current = media;
    if (media?.uri && recordingService.supportsPersistentRecovery !== false) {
      await sessionStore.savePendingRecording({ interviewId, uri: media.uri, durationSeconds });
    }
    setRecordingRetryPending(true);
    setRecordingState("UPLOADING");
    setUploadNote("Uploading encrypted video and audio. Keep the app open until 100% is confirmed.");
    setUploadProgress(0);
    await recordingService.uploadInChunks(interviewId, media, durationSeconds, {
      onProgress: ({ percent }) => setUploadProgress(percent)
    });
    setUploadProgress(100);
    setRecordingState("READY");
    await sessionStore.clearPendingRecording();
    await recordingService.removePersisted?.(media).catch(() => {});
    pendingRecording.current = null;
    await sessionStore.clearRecovery();
    setRecordingRetryPending(false);
    router.replace({ pathname: "/interview-complete", params: { uploadNote: "Interview video, audio and answers were saved securely for administrator review." } });
  }, [interviewId]);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    acceptingSpeech.current = false;
    if (speechFinalTimer.current) clearTimeout(speechFinalTimer.current);
    dispatch({ type: "PHASE", phase: InterviewState.FINISHING });
    await tts.stop();
    await speechRecognition.cancel().catch(() => {});
    try {
      recordingStopping.current = true;
      await recordingService.stop(cameraRef);
      const result = await recordingPromise.current;
      if (result?.recordingError) throw result.recordingError;
      if (!result?.uri && !result?.blob) throw new Error("The device did not return a playable interview recording.");
      const durableMedia = result?.uri && recordingService.supportsPersistentRecovery !== false
        ? await recordingService.preserve(result, interviewId)
        : result;
      await uploadProtectedRecording(durableMedia, elapsed);
    } catch (error) {
      setRecordingState("ERROR");
      setRecordingRetryPending(Boolean(pendingRecording.current));
      const message = pendingRecording.current
        ? "The recording is safe on this device, but upload is paused. Keep the app open, restore internet, and retry."
        : "Recording could not be finalized. Keep this screen open and tap Restart protected recording before leaving.";
      setUploadNote(message);
      signalWarning("RECORDING_INTERRUPTION", message, { error: error.message });
      dispatch({ type: "PHASE", phase: InterviewState.ERROR, error: error.message });
    } finally {
      recordingStopping.current = false;
      finishing.current = false;
    }
  }, [elapsed, interviewId, signalWarning, uploadProtectedRecording]);

  const syncPending = useCallback(async () => {
    const pending = await sessionStore.getPendingAnswer();
    if (!pending || pending.interviewId !== interviewId || !online) return;
    try {
      const result = await api.submitAnswer(interviewId, pending.answer, pending.idempotencyKey);
      await sessionStore.clearPendingAnswer();
      if (result.completed) await finish();
      else setQuestion(result.currentQuestion);
    } catch { /* The answer remains on-device for the next reconnect. */ }
  }, [finish, interviewId, online]);

  const submitTranscript = useCallback(async (transcript, source = "SPEECH") => {
    const current = questionRef.current;
    if (!current || submitting.current || !transcript.trim()) return;
    if (recordingStateRef.current !== "ACTIVE") {
      addWarning("RECORDING_REQUIRED", "Please wait for VIDEO + AUDIO RECORDING before submitting this answer.");
      return;
    }
    submitting.current = true;
    acceptingSpeech.current = false;
    if (speechFinalTimer.current) clearTimeout(speechFinalTimer.current);
    await speechRecognition.cancel().catch(() => {});
    setVoiceHint("");
    dispatch({ type: "PHASE", phase: InterviewState.ANALYZING });
    const idempotencyKey = `${interviewId}:${current.id}`;
    const answer = { questionId: current.id, transcript: transcript.trim(), transcriptConfidence: source === "SPEECH" ? 0.8 : undefined, source };
    await sessionStore.savePendingAnswer({ interviewId, answer, idempotencyKey });
    await saveRecovery();
    try {
      const result = await api.submitAnswer(interviewId, answer, idempotencyKey);
      await sessionStore.clearPendingAnswer();
      if (result.completed) await finish();
      else {
        setManual("");
        dispatch({ type: "TRANSCRIPT", value: "" });
        dispatch({ type: "PHASE", phase: InterviewState.GENERATING_NEXT });
        setQuestion(result.currentQuestion);
      }
    } catch (error) {
      dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: error.message });
      addWarning("ANSWER_SYNC", "Your answer is saved on this device and will sync automatically when the server reconnects.");
    } finally { submitting.current = false; }
  }, [addWarning, finish, interviewId, saveRecovery]);

  const beginListening = useCallback(async () => {
    if (recordingStateRef.current !== "ACTIVE" || !questionRef.current || finishing.current) return;
    try {
      acceptingSpeech.current = true;
      await tts.stop();
      setVoiceHint("");
      setMicState("STARTING");
      dispatch({ type: "PHASE", phase: InterviewState.LISTENING });
      await speechRecognition.start("en-IN");
    } catch (error) {
      acceptingSpeech.current = false;
      setMicState("ERROR");
      dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER });
      setVoiceHint(error.message || "Voice input is unavailable. Restart the microphone or type your answer below.");
      signalWarning("MIC_INTERRUPTION", "Microphone needs attention. Tap Restart microphone or use the typed-answer backup.", { error: error.message });
    }
  }, [signalWarning]);

  const speakQuestion = useCallback(async (nextQuestion) => {
    if (!nextQuestion || lastSpoken.current === nextQuestion.id || recordingStateRef.current !== "ACTIVE") return;
    lastSpoken.current = nextQuestion.id;
    acceptingSpeech.current = false;
    dispatch({ type: "TRANSCRIPT", value: "" });
    dispatch({ type: "PHASE", phase: InterviewState.AI_SPEAKING });
    try {
      await speechRecognition.cancel().catch(() => {});
      await tts.speak(nextQuestion.text);
      dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER });
      await beginListening();
    } catch (error) {
      dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER });
      setVoiceHint(`${error.message || "Question audio is unavailable."} You can read the question and restart the microphone.`);
    }
  }, [beginListening]);

  const startCameraRecording = useCallback(() => {
    if (recordingStarted.current || recordingRetryPending) return;
    recordingStarted.current = true;
    recordingStopping.current = false;
    setRecordingState("STARTING");
    setUploadNote("");
    recordingPromise.current = recordingService.start(cameraRef, {
      onStarted: () => {
        recordingStateRef.current = "ACTIVE";
        setRecordingState("ACTIVE");
      }
    }).then(async (media) => {
      if (!recordingStopping.current) {
        const durableMedia = media?.uri && recordingService.supportsPersistentRecovery !== false
          ? await recordingService.preserve(media, interviewId)
          : media;
        pendingRecording.current = durableMedia;
        if (durableMedia?.uri && recordingService.supportsPersistentRecovery !== false) {
          await sessionStore.savePendingRecording({ interviewId, uri: durableMedia.uri, durationSeconds: elapsedRef.current });
        }
        setRecordingState("ERROR");
        signalWarning("RECORDING_INTERRUPTION", "Camera recording stopped unexpectedly. Your captured media is protected; finish or retry the upload.");
        return durableMedia;
      }
      return media;
    }).catch((error) => {
      setRecordingState("ERROR");
      signalWarning("RECORDING_INTERRUPTION", "Camera recording could not start. Check camera and microphone permissions, then retry.", { error: error.message });
      return { recordingError: error };
    });
  }, [interviewId, recordingRetryPending, signalWarning]);

  const restartRecording = useCallback(async () => {
    recordingStarted.current = false;
    recordingPromise.current = null;
    pendingRecording.current = null;
    setRecordingState("WAITING_CAMERA");
    setUploadNote("Waiting for the camera to restart protected video and audio recording.");
    startCameraRecording();
  }, [startCameraRecording]);

  const retryRecordingUpload = useCallback(async () => {
    const media = pendingRecording.current || await sessionStore.getPendingRecording();
    if (!media?.uri && !media?.blob) {
      setUploadNote("The saved recording file is unavailable on this device. Return to the interview device and keep the app open.");
      return;
    }
    try { await uploadProtectedRecording(media, media.durationSeconds || elapsed); }
    catch (error) {
      setRecordingState("ERROR");
      setUploadNote(`Upload paused at ${uploadProgress}%. Your recording remains safe on this device. ${error.message}`);
      signalWarning("RECORDING_INTERRUPTION", "Protected recording upload is waiting for a stable connection.", { error: error.message, uploadProgress });
    }
  }, [elapsed, signalWarning, uploadProgress, uploadProtectedRecording]);

  const restartMicrophone = useCallback(async () => {
    try {
      acceptingSpeech.current = true;
      setMicState("STARTING");
      setVoiceHint("Restarting the microphone...");
      await speechRecognition.restart("en-IN");
    } catch (error) {
      acceptingSpeech.current = false;
      setMicState("ERROR");
      setVoiceHint(error.message);
      signalWarning("MIC_INTERRUPTION", "Microphone restart failed. Check permission and tap Restart microphone again.", { error: error.message });
    }
  }, [signalWarning]);

  useEffect(() => { questionRef.current = question; }, [question]);
  useEffect(() => { recordingStateRef.current = recordingState; }, [recordingState]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { submitRef.current = submitTranscript; }, [submitTranscript]);

  useEffect(() => {
    speechRecognition.attach({
      onStart: () => { setMicState("LISTENING"); setVoiceHint(""); dispatch({ type: "PHASE", phase: InterviewState.LISTENING }); },
      onPartial: (value) => { if (acceptingSpeech.current) dispatch({ type: "TRANSCRIPT", value }); },
      onFinal: (value) => {
        if (!acceptingSpeech.current || !value.trim()) return;
        speechRecognition.hold();
        dispatch({ type: "TRANSCRIPT", value });
        if (speechFinalTimer.current) clearTimeout(speechFinalTimer.current);
        speechFinalTimer.current = setTimeout(async () => {
          if (!acceptingSpeech.current || submitting.current) return;
          acceptingSpeech.current = false;
          await speechRecognition.cancel().catch(() => {});
          submitRef.current?.(value, "SPEECH");
        }, 900);
      },
      onEnd: ({ recovering }) => { setMicState(recovering ? "RECOVERING" : "WAITING"); },
      onRecovering: ({ attempt }) => { setMicState("RECOVERING"); setVoiceHint(`Microphone reconnecting automatically (attempt ${attempt})...`); },
      onError: ({ code, message, transient, recovering }) => {
        if (code === "aborted") return;
        setMicState(recovering ? "RECOVERING" : "ERROR");
        dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER });
        setVoiceHint(recovering ? "Microphone was interrupted and is reconnecting automatically..." : `${message} Tap Restart microphone or type your answer.`);
        if (Date.now() - lastMicEventAt.current > 5000) {
          lastMicEventAt.current = Date.now();
          signalWarning("MIC_INTERRUPTION", transient ? "Microphone was interrupted; automatic recovery is running." : "Microphone needs permission or device attention.", { code, message, recovering });
        }
      }
    });
    return () => {
      if (speechFinalTimer.current) clearTimeout(speechFinalTimer.current);
      speechRecognition.dispose();
    };
  }, [signalWarning]);

  useEffect(() => { if (question && recordingState === "ACTIVE") speakQuestion(question); }, [question, recordingState, speakQuestion]);
  useEffect(() => { const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000); return () => clearInterval(timer); }, [startedAt]);
  useEffect(() => { saveRecovery().catch(() => {}); }, [saveRecovery]);
  useEffect(() => monitorInterviewIntegrity(interviewId, sendEvent, {
    onBackAttempt: () => {
      addWarning("BACK_BUTTON_ATTEMPT", "Back navigation is blocked while the protected interview is active.");
      Alert.alert("Interview in progress", "This interview stays open. Use Submit & next to continue, or Finish only when you are done.");
    },
    onBackground: () => {
      addWarning("APP_BACKGROUND", "The app left the foreground. Return immediately so camera, microphone and recording can remain active.");
      saveRecovery().catch(() => {});
    },
    onRecovered: (durationMs) => {
      addWarning("SESSION_RECOVERED", "Interview session recovered. Check that VIDEO + AUDIO RECORDING and microphone indicators are active.");
      sendEvent(interviewId, { type: "SESSION_RECOVERED", timestamp: new Date().toISOString(), durationMs, metadata: { candidateVisible: true } }).catch(() => {});
      if (recordingStateRef.current === "ACTIVE") restartMicrophone();
    }
  }), [addWarning, interviewId, restartMicrophone, saveRecovery, sendEvent]);

  useEffect(() => { syncPending(); }, [syncPending]);
  useEffect(() => {
    if (!online && previousOnline.current) signalWarning("NETWORK_INTERRUPTION", "Internet connection was lost. Answers and warnings are being held safely on this device.");
    if (online && !previousOnline.current) {
      addWarning("SESSION_RECOVERED", "Internet connection restored. Saved interview data is syncing automatically.");
      sendEvent(interviewId, { type: "SESSION_RECOVERED", timestamp: new Date().toISOString(), metadata: { source: "network", candidateVisible: true } }).catch(() => {});
      flushPendingEvents().catch(() => {});
    }
    previousOnline.current = online;
  }, [addWarning, flushPendingEvents, interviewId, online, sendEvent, signalWarning]);
  useEffect(() => { if (online) flushPendingEvents().catch(() => {}); }, [flushPendingEvents, online]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await api.currentInterview(interviewId);
        if (!mounted) return;
        if (current.completed) {
          if (recoveryUploadOnly) {
            if (current.recording?.status === "READY") {
              await sessionStore.clearPendingRecording();
              await sessionStore.clearRecovery();
              router.replace({ pathname: "/interview-complete", params: { uploadNote: "Interview video, audio and answers are already saved securely for administrator review." } });
            }
            return;
          }
          await sessionStore.clearRecovery();
          router.replace("/candidate-status");
          return;
        }
        if (current.currentQuestion) setQuestion(current.currentQuestion);
      } catch { /* The saved route remains usable while Render wakes or reconnects. */ }
    })();
    return () => { mounted = false; };
  }, [interviewId, recoveryUploadOnly]);

  useEffect(() => {
    (async () => {
      const pending = await sessionStore.getPendingRecording();
      if (pending?.interviewId === interviewId) {
        pendingRecording.current = pending;
        setRecordingRetryPending(true);
        setUploadNote("A protected recording is saved on this device and ready to resume uploading.");
      }
    })();
  }, [interviewId]);

  const endNow = () => Alert.alert(
    "Finish interview?",
    "Submitted answers will be evaluated. Do not leave until the video and audio upload reaches 100%.",
    [
      { text: "Continue" },
      { text: "Finish", style: "destructive", onPress: async () => {
        try { await api.completeInterview(interviewId); await finish(); }
        catch (error) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: error.message }); }
      } }
    ]
  );
  const submitManual = async () => { await submitTranscript(manual, "MANUAL"); };
  const recordingStatus = recordingLabels[recordingState] || recordingLabels.WAITING_CAMERA;
  const answerDisabled = recordingState !== "ACTIVE" || machine.phase === InterviewState.ANALYZING;

  if (recordingRetryPending) return <Screen><View style={{ flexGrow: 1, justifyContent: "center", gap: 16 }}><InterviewRobot state={InterviewState.FINISHING} /><Card><Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>Finish protected recording upload</Text><Text selectable style={{ color: colors.muted, lineHeight: 22 }}>Your answers are complete. Keep this app open until the administrator recording is confirmed at 100%.</Text><StatusPill tone={recordingStatus.tone}>{recordingStatus.text}</StatusPill>{uploadProgress > 0 ? <Text selectable style={{ color: colors.cyan, fontSize: 20, fontWeight: "900" }}>{uploadProgress}% uploaded</Text> : null}</Card><Notice message={uploadNote} tone="warning" /><Button title={online ? "Resume protected recording upload" : "Waiting for internet connection"} loading={recordingState === "UPLOADING"} disabled={!online || recordingState === "UPLOADING"} onPress={retryRecordingUpload} /></View></Screen>;

  return <Screen style={{ paddingBottom: 64 }}><View style={{ gap: 14 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}><View style={{ flex: 1 }}><Text selectable style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{candidateName}</Text><Text selectable style={{ color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatElapsed(elapsed)} elapsed</Text></View><View style={{ alignItems: "flex-end", gap: 5 }}><StatusPill tone={online ? "success" : "warning"}>{online ? "CONNECTED" : "RECONNECTING"}</StatusPill><StatusPill tone={recordingStatus.tone}>{recordingStatus.text}</StatusPill></View></View>
    <Notice message="Video and audio recording must remain active for every answer. Keep the app in the foreground and do not lock the phone until the final upload reaches 100%." />
    <View style={{ alignItems: "center", minHeight: 174, justifyContent: "center" }}><InterviewRobot state={machine.phase} /><View style={{ position: "absolute", right: 0, top: 0, width: 112, height: 152, overflow: "hidden", borderRadius: 16, borderWidth: 2, borderColor: recordingState === "ACTIVE" ? colors.success : colors.warning }}><CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" mirror mode="video" videoQuality="480p" videoBitrate={800000} onCameraReady={startCameraRecording} onMountError={(event) => { setRecordingState("ERROR"); signalWarning("CAMERA_INTERRUPTION", "Camera could not initialize. Check permission and tap Restart protected recording.", { error: event?.message }); }} /></View></View>
    {recordingState === "ERROR" ? <><Notice message={uploadNote || "Protected video and audio recording needs attention before answers can be submitted."} tone="warning" /><Button title="Restart protected recording" variant="secondary" onPress={restartRecording} /></> : null}
    <Card><Text selectable style={{ color: colors.brand, fontWeight: "900", fontSize: 12 }}>QUESTION {question?.sequence || "-"}</Text><Text selectable style={{ color: colors.text, fontSize: 19, lineHeight: 27, fontWeight: "800" }}>{question?.text || "Recovering your current interview question..."}</Text></Card>
    <Card style={{ gap: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>LIVE TRANSCRIPT</Text><StatusPill tone={micState === "LISTENING" ? "success" : micState === "ERROR" ? "danger" : "warning"}>{micState}</StatusPill></View><Text selectable style={{ color: machine.transcript ? colors.text : colors.muted, minHeight: 40, lineHeight: 21 }}>{machine.transcript || (machine.phase === InterviewState.LISTENING ? "Listening..." : "Your spoken answer will appear here.")}</Text>{machine.transcript ? <Button title="Submit spoken answer & next question" variant="secondary" loading={machine.phase === InterviewState.ANALYZING} disabled={answerDisabled} onPress={() => submitTranscript(machine.transcript, "SPEECH")} /> : null}<Button title="Restart microphone" variant="secondary" disabled={recordingState !== "ACTIVE" || machine.phase === InterviewState.ANALYZING} onPress={restartMicrophone} /></Card>
    <Notice message={voiceHint || uploadNote} tone="warning" />
    {warnings.length ? <Card><Text selectable style={{ color: colors.warning, fontWeight: "900" }}>Candidate warnings</Text>{warnings.map((item) => <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, gap: 2 }}><Text selectable style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>{item.type.replaceAll("_", " ")}</Text><Text selectable style={{ color: colors.muted, lineHeight: 19 }}>{item.message}</Text></View>)}</Card> : null}
    <ErrorBanner message={machine.error} />
    <TextInput value={manual} onChangeText={setManual} placeholder="Type your answer here if voice input is unavailable" placeholderTextColor={colors.muted} multiline scrollEnabled style={{ minHeight: 120, maxHeight: 260, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, color: colors.text, backgroundColor: colors.card, textAlignVertical: "top" }} />
    <View style={{ gap: 10 }}><Button title="Submit typed answer & next question" variant="secondary" loading={machine.phase === InterviewState.ANALYZING} disabled={!manual.trim() || answerDisabled} onPress={submitManual} /><Pressable onPress={endNow} disabled={recordingState !== "ACTIVE"} style={({ pressed }) => ({ alignItems: "center", paddingVertical: 12, opacity: recordingState !== "ACTIVE" ? 0.4 : pressed ? 0.7 : 1 })}><Text selectable style={{ color: colors.danger, fontWeight: "800" }}>Finish interview</Text></Pressable></View>
  </View></Screen>;
}
