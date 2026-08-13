import crypto from "node:crypto";
import { CandidateStatus, InterviewStatus } from "@aparaitech/shared";
import { Candidate, Interview, InterviewAnswer, InterviewEvent, InterviewQuestion, InterviewRecording, Resume } from "../models/index.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError, notFound } from "../utils/api-error.js";
import { aggregateScores } from "../utils/score.js";
import { calculateIntegrity } from "../utils/integrity.js";
import { interviewAi } from "../services/ai/interview-ai-service.js";
import { answer as answerValidator, consent as consentValidator, event as eventValidator } from "../validators/request.js";
import { storage } from "../services/storage/index.js";
import { getInterviewSettings } from "../services/interview-settings.js";

const candidateQuestion = (question) => question && ({ id: question.id, sequence: question.sequence, text: question.questionText, category: question.category, difficulty: question.difficulty, askedAt: question.askedAt });
const fingerprint = (text) => crypto.createHash("sha256").update(text.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
const isTerminal = (status) => [InterviewStatus.COMPLETED, InterviewStatus.TERMINATED].includes(status);
export const recordingFileExtension = (mimeType) => ({ "video/webm": "webm", "video/quicktime": "mov", "video/mp4": "mp4" }[mimeType] || "mp4");

async function loadScopedInterview(req) {
  const interview = await Interview.findById(req.params.interviewId);
  if (!interview) throw notFound("Interview");
  if (String(interview.candidateId) !== String(req.candidate._id)) throw new ApiError(403, "INTERVIEW_SCOPE_VIOLATION", "You cannot access this interview.");
  return interview;
}

async function contextFor(interview) {
  const [candidate, resume, questions, answers] = await Promise.all([
    Candidate.findById(interview.candidateId), Resume.findById(interview.resumeId),
    InterviewQuestion.find({ interviewId: interview._id }).sort({ sequence: 1 }), InterviewAnswer.find({ interviewId: interview._id })
  ]);
  if (!candidate || !resume || resume.parseStatus !== "PARSED") throw new ApiError(409, "INTERVIEW_NOT_READY", "A parsed resume is required before the interview can continue.");
  const answerByQuestion = new Map(answers.map((entry) => [String(entry.questionId), entry]));
  return { candidate, resume, questions, answers, priorAnswers: questions.filter((q) => answerByQuestion.has(String(q._id))).map((question) => ({ question, answer: answerByQuestion.get(String(question._id)) })) };
}

async function createNextQuestion(interview) {
  const context = await contextFor(interview);
  const sequence = context.questions.length + 1;
  if (sequence > interview.configuration.maxQuestions || (interview.startedAt && Date.now() - interview.startedAt.getTime() >= interview.configuration.durationMinutes * 60000)) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const generated = await interviewAi.generateQuestion({ ...context, interview, priorQuestions: context.questions });
    const promptFingerprint = fingerprint(generated.question);
    if (context.questions.some((question) => question.promptFingerprint === promptFingerprint)) continue;
    const previous = generated.followUpOfSequence ? context.questions.find((question) => question.sequence === generated.followUpOfSequence) : null;
    const question = await InterviewQuestion.create({ interviewId: interview._id, candidateId: interview.candidateId, sequence, category: generated.category, difficulty: generated.difficulty, questionText: generated.question, generatedFrom: ["resume", "prior_answers", "difficulty"], relatedResumeSection: generated.relatedResumeSection, expectedConcepts: generated.expectedConcepts, rationale: generated.rationale, followUpOf: previous?._id, promptFingerprint });
    interview.currentQuestionIndex = sequence; interview.state.difficulty = generated.difficulty; interview.state.topicHistory = [...new Set([...interview.state.topicHistory, generated.category])].slice(-20); interview.state.lastSyncedAt = new Date(); await interview.save();
    return question;
  }
  throw new ApiError(502, "AI_DUPLICATE_QUESTION", "The AI could not create a distinct next question. Please retry; your progress is safe.");
}

async function complete(interview) {
  if (interview.status === InterviewStatus.COMPLETED) return interview;
  const context = await contextFor(interview);
  if (!context.priorAnswers.length) throw new ApiError(409, "NO_ANSWERS", "At least one answer is required to complete the interview.");
  const events = await InterviewEvent.find({ interviewId: interview._id }).lean();
  const scores = aggregateScores(context.priorAnswers, interview.configuration.weights);
  const integrity = calculateIntegrity(events);
  interview.status = InterviewStatus.PROCESSING; await interview.save();
  const assessment = await interviewAi.finalAssessment({ candidate: context.candidate, scores, questionAnswers: context.priorAnswers, integrity });
  interview.scores = scores; interview.finalAssessment = assessment; interview.aiRecommendation = assessment.recommendedDecision; interview.integrity = integrity; interview.status = InterviewStatus.COMPLETED; interview.completedAt = new Date(); interview.durationSeconds = Math.round((interview.completedAt - interview.startedAt) / 1000); await interview.save();
  await Candidate.findByIdAndUpdate(interview.candidateId, { status: CandidateStatus.INTERVIEW_COMPLETED });
  return interview;
}

async function advance(interview) {
  const current = await InterviewQuestion.findOne({ interviewId: interview._id, sequence: interview.currentQuestionIndex });
  if (current && !(await InterviewAnswer.exists({ questionId: current._id }))) return { currentQuestion: current, completed: false };
  const next = await InterviewQuestion.findOne({ interviewId: interview._id, sequence: interview.currentQuestionIndex + 1 });
  if (next) { interview.currentQuestionIndex = next.sequence; await interview.save(); return { currentQuestion: next, completed: false }; }
  const created = await createNextQuestion(interview);
  if (created) return { currentQuestion: created, completed: false };
  const completeInterview = await complete(interview);
  return { currentQuestion: null, completed: true, interview: completeInterview };
}

export const start = asyncHandler(async (req, res) => {
  const consent = consentValidator.parse(req.body.consent);
  if (!req.candidate.resumeId || req.candidate.status === CandidateStatus.RESUME_PENDING) throw new ApiError(409, "RESUME_REQUIRED", "Upload and process your resume before starting the interview.");
  let interview = req.candidate.currentInterviewId ? await Interview.findById(req.candidate.currentInterviewId) : null;
  if (interview && isTerminal(interview.status)) throw new ApiError(409, interview.status === InterviewStatus.TERMINATED ? "INTERVIEW_TERMINATED" : "INTERVIEW_COMPLETED", "This interview attempt is no longer active.");
  if (!interview) {
    const configuration = await getInterviewSettings();
    interview = await Interview.create({ candidateId: req.candidate._id, resumeId: req.candidate.resumeId, invitationId: req.candidate.invitationId, status: InterviewStatus.IN_PROGRESS, startedAt: new Date(), configuration });
    req.candidate.currentInterviewId = interview._id; req.candidate.status = CandidateStatus.INTERVIEW_IN_PROGRESS; req.candidate.consent = { ...consent, acceptedAt: new Date() }; await req.candidate.save();
  }
  const result = await advance(interview);
  res.status(201).json({ interview: { id: interview.id, status: result.interview?.status || interview.status, startedAt: interview.startedAt, durationMinutes: interview.configuration.durationMinutes, maxQuestions: interview.configuration.maxQuestions }, currentQuestion: candidateQuestion(result.currentQuestion), completed: result.completed });
});

export const current = asyncHandler(async (req, res) => {
  const interview = await loadScopedInterview(req);
  if (interview.status === InterviewStatus.TERMINATED) throw new ApiError(409, "INTERVIEW_TERMINATED", "This interview was terminated by the administrator.");
  if (interview.status === InterviewStatus.COMPLETED) {
    const recording = await InterviewRecording.findOne({ interviewId: interview._id });
    return res.json({ interview: { id: interview.id, status: interview.status, completedAt: interview.completedAt }, completed: true, recording: recording ? { status: recording.status, expectedChunks: recording.expectedChunks || 0, receivedChunks: recording.chunks?.length || 0, fileSize: recording.fileSize || 0, finalizedAt: recording.finalizedAt || null } : { status: "NOT_STARTED" } });
  }
  const result = await advance(interview);
  res.json({ interview: { id: interview.id, status: result.interview?.status || interview.status, startedAt: interview.startedAt, durationMinutes: interview.configuration.durationMinutes, maxQuestions: interview.configuration.maxQuestions }, currentQuestion: candidateQuestion(result.currentQuestion), completed: result.completed });
});

export const submitAnswer = asyncHandler(async (req, res) => {
  const payload = answerValidator.parse(req.body); const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length > 128) throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid idempotency key is required to submit an answer.");
  const interview = await loadScopedInterview(req);
  if (interview.status !== InterviewStatus.IN_PROGRESS && interview.status !== InterviewStatus.PROCESSING) throw new ApiError(409, "INTERVIEW_NOT_ACTIVE", "This interview is not accepting answers.");
  const question = await InterviewQuestion.findById(payload.questionId);
  if (!question || String(question.interviewId) !== String(interview._id)) throw new ApiError(409, "QUESTION_NOT_CURRENT", "This question is no longer current.");
  let existing = await InterviewAnswer.findOne({ questionId: question._id });
  if (existing && existing.idempotencyKey !== idempotencyKey) throw new ApiError(409, "ANSWER_ALREADY_SUBMITTED", "This question already has an answer.");
  // A mobile retry can reach us after the first request has already advanced
  // the interview to the next question. Return that saved result instead of
  // rejecting the same idempotency key as a stale question.
  if (existing) {
    const result = await advance(interview);
    return res.json({ answer: { id: existing.id, evaluation: existing.evaluation }, currentQuestion: candidateQuestion(result.currentQuestion), completed: result.completed, ...(result.completed ? { finalStatus: result.interview.status } : {}) });
  }
  if (question.sequence !== interview.currentQuestionIndex) throw new ApiError(409, "QUESTION_NOT_CURRENT", "This question is no longer current.");
  const { candidate, resume } = await contextFor(interview);
  const evaluation = await interviewAi.evaluateAnswer({ candidate, resume, question, transcript: payload.transcript, transcriptConfidence: payload.transcriptConfidence });
  existing = await InterviewAnswer.create({ interviewId: interview._id, questionId: question._id, candidateId: req.candidate._id, transcript: payload.transcript, transcriptConfidence: payload.transcriptConfidence, source: payload.source, evaluation, idempotencyKey });
  question.answeredAt = new Date(); await question.save();
  interview.state.strongAreas = [...new Set([...interview.state.strongAreas, ...evaluation.strongPoints])].slice(-20); interview.state.weakAreas = [...new Set([...interview.state.weakAreas, ...evaluation.missingConcepts])].slice(-20); if (evaluation.needsFollowUp) interview.state.followUpCount += 1; await interview.save();
  const result = await advance(interview);
  res.json({ answer: { id: existing.id, evaluation: existing.evaluation }, currentQuestion: candidateQuestion(result.currentQuestion), completed: result.completed, ...(result.completed ? { finalStatus: result.interview.status } : {}) });
});

export const logEvent = asyncHandler(async (req, res) => {
  const interview = await loadScopedInterview(req);
  const payload = eventValidator.parse(req.body);
  const lateEvidenceTypes = new Set(["RECORDING_INTERRUPTION", "NETWORK_INTERRUPTION", "SESSION_RECOVERED"]);
  if (isTerminal(interview.status) && !(interview.status === InterviewStatus.COMPLETED && lateEvidenceTypes.has(payload.type))) throw new ApiError(409, "INTERVIEW_NOT_ACTIVE", "This interview is no longer active.");
  const event = await InterviewEvent.create({ interviewId: interview._id, candidateId: req.candidate._id, ...payload });
  res.status(201).json({ event: { id: event.id, type: event.type, timestamp: event.timestamp } });
});

export const forceComplete = asyncHandler(async (req, res) => {
  const interview = await loadScopedInterview(req); const final = await complete(interview);
  res.json({ interview: { id: final.id, status: final.status, completedAt: final.completedAt } });
});

function chunkKey(recordingId, index) { return `recording-chunks/${recordingId}/${String(index).padStart(6, "0")}.part`; }
async function availableChunkIndexes(recording) {
  const entries = recording.chunks.map((chunk) => ({ index: chunk.index, key: chunkKey(recording.id, chunk.index) }));
  const existing = await storage.existingKeys(entries.map((entry) => entry.key));
  return entries.filter((entry) => existing.has(entry.key)).map((entry) => entry.index).sort((a, b) => a - b);
}

export const recordingStatus = asyncHandler(async (req, res) => {
  const interview = await loadScopedInterview(req);
  const recording = await InterviewRecording.findOne({ interviewId: interview._id });
  if (!recording) return res.json({ recording: { status: "NOT_STARTED", receivedIndexes: [], missingIndexes: [] } });
  if (recording.status === "READY") return res.json({ recording: { id: recording.id, status: recording.status, fileSize: recording.fileSize, durationSeconds: recording.durationSeconds, receivedIndexes: [], missingIndexes: [] } });
  const receivedIndexes = await availableChunkIndexes(recording);
  const received = new Set(receivedIndexes);
  const expectedChunks = recording.expectedChunks || 0;
  const missingIndexes = expectedChunks ? Array.from({ length: expectedChunks }, (_, index) => index).filter((index) => !received.has(index)) : [];
  res.json({ recording: { id: recording.id, status: recording.status, expectedChunks, expectedBytes: recording.expectedBytes, receivedIndexes, missingIndexes, lastError: recording.lastError || null } });
});

export const uploadRecordingChunk = asyncHandler(async (req, res) => {
  const interview = await loadScopedInterview(req); if (!req.file?.buffer) throw new ApiError(400, "CHUNK_REQUIRED", "A recording chunk is required.");
  if (![InterviewStatus.IN_PROGRESS, InterviewStatus.PROCESSING, InterviewStatus.COMPLETED].includes(interview.status)) throw new ApiError(409, "INTERVIEW_NOT_ACTIVE", "This interview is not accepting recording uploads.");
  const index = Number(req.body.index); if (!Number.isInteger(index) || index < 0 || index > 10000) throw new ApiError(400, "INVALID_CHUNK_INDEX", "Recording chunk index is invalid.");
  const expectedChunks = Number(req.body.totalChunks); if (!Number.isInteger(expectedChunks) || expectedChunks < 1 || expectedChunks > 10001 || index >= expectedChunks) throw new ApiError(400, "INVALID_CHUNK_COUNT", "Recording chunk count is invalid.");
  const expectedBytes = Number(req.body.totalBytes); if (!Number.isSafeInteger(expectedBytes) || expectedBytes < req.file.size || expectedBytes > 1024 * 1024 * 1024) throw new ApiError(400, "INVALID_RECORDING_SIZE", "Recording size is invalid.");
  let recording = await InterviewRecording.findOne({ interviewId: interview._id });
  const mimeType = ["video/mp4", "video/webm", "video/quicktime"].includes(req.file.mimetype) ? req.file.mimetype : "video/mp4";
  if (!recording) recording = await InterviewRecording.create({ interviewId: interview._id, candidateId: req.candidate._id, status: "UPLOADING", mimeType, expectedChunks, expectedBytes, retentionUntil: new Date(Date.now() + interview.configuration.recordingRetentionDays * 24 * 3600000) });
  if (recording.status === "DELETED") throw new ApiError(410, "RECORDING_DELETED", "This recording was removed under the administrator retention policy and cannot be uploaded again.");
  if (recording.status === "READY") return res.json({ recordingId: recording.id, index, duplicate: true, ready: true });
  if ((recording.expectedChunks && recording.expectedChunks !== expectedChunks) || (recording.expectedBytes && recording.expectedBytes !== expectedBytes)) throw new ApiError(409, "RECORDING_METADATA_CONFLICT", "The recording upload metadata changed. Retry with the original recording file.");
  recording.expectedChunks = expectedChunks; recording.expectedBytes = expectedBytes; recording.mimeType ||= mimeType;
  const existing = recording.chunks.find((chunk) => chunk.index === index); const key = chunkKey(recording.id, index);
  if (existing && await storage.exists(key)) return res.json({ recordingId: recording.id, index, duplicate: true });
  const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  await storage.putBuffer(key, req.file.buffer, { contentType: recording.mimeType, interviewId: String(interview.id), index });
  if (existing) existing.set({ size: req.file.size, sha256: checksum, receivedAt: new Date() }); else recording.chunks.push({ index, size: req.file.size, sha256: checksum, receivedAt: new Date() });
  recording.status = "UPLOADING"; recording.lastError = undefined; await recording.save();
  res.status(201).json({ recordingId: recording.id, index });
});

export const finalizeRecording = asyncHandler(async (req, res) => {
  const interview = await loadScopedInterview(req); const recording = await InterviewRecording.findOne({ interviewId: interview._id }).select("+storageKey");
  if (!recording) throw new ApiError(404, "RECORDING_NOT_FOUND", "No recording upload is in progress.");
  if (recording.status === "READY" && recording.storageKey) return res.json({ recording: { id: recording.id, status: recording.status, fileSize: recording.fileSize, duplicate: true } });
  const ordered = [...recording.chunks].sort((a, b) => a.index - b.index); const expectedChunks = recording.expectedChunks || ordered.length;
  const available = new Set(await availableChunkIndexes(recording));
  const missing = Array.from({ length: expectedChunks }, (_, index) => index).filter((index) => !available.has(index));
  if (!ordered.length || missing.length) { recording.lastError = `Missing recording chunks: ${missing.slice(0, 20).join(", ")}`; await recording.save(); throw new ApiError(409, "RECORDING_CHUNKS_MISSING", "Some recording chunks are missing. The app will retry only those chunks.", { missingIndexes: missing }); }
  const assembledBytes = ordered.reduce((total, chunk) => total + chunk.size, 0);
  if (recording.expectedBytes && assembledBytes !== recording.expectedBytes) { recording.lastError = `Recording size mismatch: received ${assembledBytes} of ${recording.expectedBytes} bytes`; await recording.save(); throw new ApiError(409, "RECORDING_SIZE_MISMATCH", "The recording upload is incomplete. Retry the protected upload from the same device."); }
  const keys = ordered.map((chunk) => chunkKey(recording.id, chunk.index)); const outputKey = `recordings/${interview.id}/${recording.id}.${recordingFileExtension(recording.mimeType)}`;
  try { await storage.concatenate(keys, outputKey, { contentType: recording.mimeType, interviewId: String(interview.id) }); }
  catch (error) { recording.lastError = String(error?.message || "Recording assembly failed").slice(0, 500); await recording.save(); throw new ApiError(503, "RECORDING_FINALIZE_FAILED", "The protected recording could not be finalized yet. Retry is safe."); }
  recording.storageKey = outputKey; recording.fileSize = assembledBytes; recording.durationSeconds = Number(req.body.durationSeconds) || 0; recording.status = "READY"; recording.finalizedAt = new Date(); recording.lastError = undefined; await recording.save(); interview.recordingId = recording._id; await interview.save();
  await Promise.all(keys.map((key) => storage.delete(key).catch(() => {})));
  res.json({ recording: { id: recording.id, status: recording.status, fileSize: recording.fileSize } });
});
