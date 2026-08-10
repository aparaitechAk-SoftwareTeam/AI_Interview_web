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

export default function InterviewScreen() {
  const params = useLocalSearchParams(); const interviewId = String(params.id); const [machine, dispatch] = useReducer(interviewReducer, initialInterviewState); const [question, setQuestion] = useState(() => parseQuestion(params.firstQuestion)); const [elapsed, setElapsed] = useState(0); const [manual, setManual] = useState(""); const [uploadNote, setUploadNote] = useState(""); const online = useNetworkStatus();
  const cameraRef = useRef(null); const recordingPromise = useRef(null); const recordingStarted = useRef(false); const pendingWebRecording = useRef(null); const questionRef = useRef(question); const lastSpoken = useRef(null); const submitting = useRef(false); const submitRef = useRef(null);
  const [recordingRetryPending, setRecordingRetryPending] = useState(false);
  const [startedAt] = useState(() => Number.isNaN(Date.parse(String(params.startedAt))) ? Date.now() : Date.parse(String(params.startedAt)));

  const sendEvent = useCallback((id, event) => api.event(id, event), []);
  const finish = useCallback(async (result) => {
    dispatch({ type: "PHASE", phase: InterviewState.FINISHING }); await tts.stop(); await speechRecognition.cancel().catch(() => {});
    let finalUploadNote = "";
    try {
      await recordingService.stop(cameraRef); const media = await recordingPromise.current;
      if (media?.uri || media?.blob) {
        try {
          await recordingService.uploadInChunks(interviewId, media, elapsed);
          await sessionStore.clearPendingRecording();
        } catch {
          if (media?.uri && recordingService.supportsPersistentRecovery !== false) {
            await sessionStore.savePendingRecording({ interviewId, uri: media.uri, durationSeconds: elapsed });
            finalUploadNote = "Interview completed. Recording upload will resume when the connection returns.";
          } else {
            pendingWebRecording.current = media;
            finalUploadNote = "Your answers are complete, but the browser recording upload needs a stable connection. Keep this tab open and retry the upload before continuing.";
            setUploadNote(finalUploadNote);
            setRecordingRetryPending(true);
            dispatch({ type: "PHASE", phase: InterviewState.COMPLETED });
            return;
          }
        }
      }
    } catch {
      finalUploadNote = "Interview completed. Camera recording could not be finalized on this device.";
    }
    setUploadNote(finalUploadNote);
    dispatch({ type: "PHASE", phase: InterviewState.COMPLETED }); router.replace({ pathname: "/interview-complete", params: { uploadNote: finalUploadNote } });
  }, [elapsed, interviewId]);

  const syncPending = useCallback(async () => {
    const pending = await sessionStore.getPendingAnswer();
    if (!pending || pending.interviewId !== interviewId || !online) return;
    try { const result = await api.submitAnswer(interviewId, pending.answer, pending.idempotencyKey); await sessionStore.clearPendingAnswer(); if (result.completed) await finish(result); else setQuestion(result.currentQuestion); } catch { /* retained for the next reconnect */ }
  }, [finish, interviewId, online]);

  const submitTranscript = useCallback(async (transcript, source = "SPEECH") => {
    const current = questionRef.current; if (!current || submitting.current || !transcript.trim()) return;
    submitting.current = true; dispatch({ type: "PHASE", phase: InterviewState.ANALYZING }); const idempotencyKey = `${interviewId}:${current.id}`; const answer = { questionId: current.id, transcript: transcript.trim(), transcriptConfidence: source === "SPEECH" ? 0.8 : undefined, source };
    await sessionStore.savePendingAnswer({ interviewId, answer, idempotencyKey }); await sessionStore.saveRecovery({ interviewId, currentQuestionId: current.id, savedAt: new Date().toISOString() });
    try { const result = await api.submitAnswer(interviewId, answer, idempotencyKey); await sessionStore.clearPendingAnswer(); if (result.completed) await finish(result); else { setManual(""); dispatch({ type: "TRANSCRIPT", value: "" }); dispatch({ type: "PHASE", phase: InterviewState.GENERATING_NEXT }); setQuestion(result.currentQuestion); } }
    catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.ERROR, error: reason.message }); }
    finally { submitting.current = false; }
  }, [finish, interviewId]);
  useEffect(() => { questionRef.current = question; }, [question]);
  useEffect(() => { submitRef.current = submitTranscript; }, [submitTranscript]);

  const beginListening = useCallback(async () => {
    try { await tts.stop(); dispatch({ type: "PHASE", phase: InterviewState.LISTENING }); await speechRecognition.start("en-IN"); }
    catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: `${reason.message} You can type your answer below.` }); }
  }, []);
  const speakQuestion = useCallback(async (nextQuestion) => {
    if (!nextQuestion || lastSpoken.current === nextQuestion.id) return; lastSpoken.current = nextQuestion.id; dispatch({ type: "TRANSCRIPT", value: "" }); dispatch({ type: "PHASE", phase: InterviewState.AI_SPEAKING });
    try { await speechRecognition.cancel().catch(() => {}); await tts.speak(nextQuestion.text); dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER }); await beginListening(); }
    catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: `${reason.message} Please read the question and type an answer if audio is unavailable.` }); }
  }, [beginListening]);

  useEffect(() => { speechRecognition.attach({ onStart: () => dispatch({ type: "PHASE", phase: InterviewState.LISTENING }), onPartial: (value) => dispatch({ type: "TRANSCRIPT", value }), onFinal: (value) => { dispatch({ type: "TRANSCRIPT", value }); submitRef.current?.(value); }, onError: (message) => dispatch({ type: "PHASE", phase: InterviewState.WAITING_FOR_ANSWER, error: `${message} You can type your answer below.` }) }); return () => speechRecognition.dispose(); }, []);
  useEffect(() => { if (question) speakQuestion(question); }, [question, speakQuestion]);
  useEffect(() => { const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000); return () => clearInterval(timer); }, [startedAt]);
  useEffect(() => monitorInterviewIntegrity(interviewId, sendEvent, () => Alert.alert("Interview interruption", "Leaving may be logged as an interview interruption. Continue the interview when you are ready.")), [interviewId, sendEvent]);
  useEffect(() => { syncPending(); }, [syncPending]);
  useEffect(() => { (async () => { const pending = await sessionStore.getPendingRecording(); if (pending?.interviewId === interviewId && online) { try { await recordingService.uploadInChunks(interviewId, pending.uri, pending.durationSeconds); await sessionStore.clearPendingRecording(); setUploadNote("A previous recording upload was recovered."); } catch { /* retry later */ } } })(); }, [interviewId, online]);

  const onCameraReady = () => { if (!recordingStarted.current) { recordingStarted.current = true; recordingPromise.current = recordingService.start(cameraRef).catch(() => null); } };
  const retryRecordingUpload = async () => {
    const media = pendingWebRecording.current;
    if (!media) return;
    setUploadNote("Retrying browser recording upload…");
    try {
      await recordingService.uploadInChunks(interviewId, media, elapsed);
      pendingWebRecording.current = null;
      setRecordingRetryPending(false);
      router.replace({ pathname: "/interview-complete", params: { uploadNote: "Browser recording uploaded successfully." } });
    } catch {
      setUploadNote("Recording upload still needs a stable connection. Keep this tab open and try again.");
    }
  };
  const continueWithoutRecording = () => {
    pendingWebRecording.current = null;
    setRecordingRetryPending(false);
    router.replace({ pathname: "/interview-complete", params: { uploadNote: "Interview completed without a saved browser recording." } });
  };
  const endNow = async () => { Alert.alert("Finish interview?", "The interview will be evaluated using answers already submitted.", [{ text: "Continue" }, { text: "Finish", style: "destructive", onPress: async () => { try { const result = await api.completeInterview(interviewId); await finish(result); } catch (reason) { dispatch({ type: "PHASE", phase: InterviewState.ERROR, error: reason.message }); } } }]); };
  const submitManual = async () => { await speechRecognition.stop().catch(() => {}); await submitTranscript(manual, "MANUAL"); };
  const tone = online ? "success" : "warning";
  if (recordingRetryPending) return <Screen><View style={{ flex: 1, justifyContent: "center", gap: 16, padding: 18 }}><InterviewRobot state={InterviewState.FINISHING} /><Card><Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>Finish recording upload</Text><Text selectable style={{ color: colors.muted, lineHeight: 22 }}>Your interview answers are safely completed. The browser keeps the recording data in this open tab while you retry.</Text></Card><ErrorBanner message={uploadNote} /><Button title="Retry recording upload" loading={!online} disabled={!online} onPress={retryRecordingUpload} /><Button title="Continue without recording" variant="secondary" onPress={continueWithoutRecording} /></View></Screen>;
  return <Screen scroll={false}><View style={{ flex: 1, padding: 18, gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text selectable style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{params.candidateName || "Candidate"}</Text><Text selectable style={{ color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatElapsed(elapsed)} elapsed</Text></View><View style={{ alignItems: "flex-end", gap: 5 }}><StatusPill tone={tone}>{online ? "CONNECTED" : "RECONNECTING"}</StatusPill><Text selectable style={{ color: colors.danger, fontWeight: "800", fontSize: 12 }}>● REC</Text></View></View><View style={{ flex: 1, justifyContent: "space-between", gap: 14 }}><View style={{ alignItems: "center", gap: 8 }}><InterviewRobot state={machine.phase} /><View style={{ position: "absolute", right: 0, top: 0, width: 112, height: 152, overflow: "hidden", borderRadius: 16, borderWidth: 2, borderColor: colors.white }}><CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" mirror mode="video" onCameraReady={onCameraReady} /></View></View><Card><Text selectable style={{ color: colors.brand, fontWeight: "900", fontSize: 12 }}>QUESTION {question?.sequence || "—"}</Text><Text selectable style={{ color: colors.text, fontSize: 19, lineHeight: 27, fontWeight: "800" }}>{question?.text || "Recovering your current interview question…"}</Text></Card><Card style={{ gap: 8 }}><Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>LIVE TRANSCRIPT</Text><Text selectable style={{ color: machine.transcript ? colors.text : colors.muted, minHeight: 40, lineHeight: 21 }}>{machine.transcript || (machine.phase === InterviewState.LISTENING ? "Listening…" : "Your answer will appear here.")}</Text></Card><ErrorBanner message={machine.error || uploadNote} /><TextInput value={manual} onChangeText={setManual} placeholder="If speech recognition fails, type your answer here" placeholderTextColor={colors.muted} multiline style={{ minHeight: 68, maxHeight: 130, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, color: colors.text, backgroundColor: colors.card, textAlignVertical: "top" }} /><View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button title="Send typed answer" variant="secondary" disabled={!manual.trim() || machine.phase === InterviewState.ANALYZING} onPress={submitManual} /></View><Pressable onPress={endNow} style={{ justifyContent: "center", paddingHorizontal: 10 }}><Text selectable style={{ color: colors.danger, fontWeight: "800" }}>End</Text></Pressable></View></View></View></Screen>;
}
