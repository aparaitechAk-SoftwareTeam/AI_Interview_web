import crypto from "node:crypto";
import { AdminDecision, Candidate, InterviewAnswer, InterviewQuestion, InterviewRecording, Resume } from "../models/index.js";
import { CandidateStatus } from "@aparaitech/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { canonicalResumeMimeType, validateResumeFile } from "../services/resume/file-validation.js";
import { parseResume } from "../services/resume/resume-parser.js";
import { storage } from "../services/storage/index.js";
import { assertCandidateId } from "../middleware/candidate-scope.js";

const publicStatus = (candidate) => ({ id: candidate.id, fullName: candidate.fullName, position: candidate.position, status: candidate.status, updatedAt: candidate.updatedAt });

export const status = asyncHandler(async (req, res) => res.json({ candidate: publicStatus(req.candidate) }));

export const profile = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findById(req.candidate._id)
    .populate("invitationId", "code expiresAt active emailDelivery")
    .populate("resumeId", "originalName parseStatus structuredData processedAt")
    .populate("currentInterviewId");
  if (!candidate) throw new ApiError(404, "CANDIDATE_NOT_FOUND", "Candidate profile was not found.");
  const interview = candidate.currentInterviewId;
  const [questions, answers, recording, decision] = interview ? await Promise.all([
    InterviewQuestion.find({ interviewId: interview._id }).sort({ sequence: 1 }).lean(),
    InterviewAnswer.find({ interviewId: interview._id }).select("questionId transcript transcriptConfidence source evaluation submittedAt").lean(),
    InterviewRecording.findOne({ interviewId: interview._id, candidateId: candidate._id }).lean(),
    AdminDecision.findOne({ interviewId: interview._id, candidateId: candidate._id }).select("decision candidateFeedback decisionAt").lean()
  ]) : [[], [], null, null];
  const answersByQuestion = new Map(answers.map((answer) => [String(answer.questionId), answer]));
  res.json({
    candidate: { id: candidate.id, fullName: candidate.fullName, email: candidate.email, phone: candidate.phone, college: candidate.college, qualification: candidate.qualification, position: candidate.position, status: candidate.status, createdAt: candidate.createdAt, updatedAt: candidate.updatedAt },
    invitation: candidate.invitationId ? { code: candidate.invitationId.code, expiresAt: candidate.invitationId.expiresAt, active: candidate.invitationId.active } : null,
    resume: candidate.resumeId ? { id: candidate.resumeId.id, originalName: candidate.resumeId.originalName, parseStatus: candidate.resumeId.parseStatus, structuredData: candidate.resumeId.structuredData, processedAt: candidate.resumeId.processedAt } : null,
    interview: interview ? { id: interview.id, status: interview.status, startedAt: interview.startedAt, completedAt: interview.completedAt, durationSeconds: interview.durationSeconds, scores: interview.scores, finalAssessment: interview.finalAssessment, aiRecommendation: interview.aiRecommendation, integrity: interview.integrity } : null,
    questionAnswers: questions.map((question) => ({ question: { id: String(question._id), sequence: question.sequence, category: question.category, difficulty: question.difficulty, text: question.questionText }, answer: answersByQuestion.get(String(question._id)) || null })),
    recording: recording ? { status: recording.status, mimeType: recording.mimeType, fileSize: recording.fileSize, durationSeconds: recording.durationSeconds, finalizedAt: recording.finalizedAt, retentionUntil: recording.retentionUntil } : null,
    decision: decision ? { decision: decision.decision, candidateFeedback: decision.candidateFeedback || "", decisionAt: decision.decisionAt } : null
  });
});

export const streamOwnRecording = asyncHandler(async (req, res) => {
  const recording = await InterviewRecording.findOne({ interviewId: req.params.interviewId, candidateId: req.candidate._id }).select("+storageKey");
  if (!recording || recording.status !== "READY" || !recording.storageKey || !(await storage.exists(recording.storageKey))) throw new ApiError(404, "RECORDING_NOT_FOUND", "Your interview recording is not available yet.");
  const { size } = await storage.stat(recording.storageKey); const range = req.headers.range;
  res.setHeader("Content-Type", recording.mimeType || "video/mp4"); res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Cache-Control", "private, no-store");
  if (!range) { res.setHeader("Content-Length", size); (await storage.createReadStream(recording.storageKey)).pipe(res); return; }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) { res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return; }
  const start = match[1] ? Number(match[1]) : 0; const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) { res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return; }
  res.status(206); res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`); res.setHeader("Content-Length", end - start + 1); (await storage.createReadStream(recording.storageKey, { start, end })).pipe(res);
});

export const uploadResume = asyncHandler(async (req, res) => {
  assertCandidateId(req, req.params.candidateId);
  const format = validateResumeFile(req.file);
  const mimeType = canonicalResumeMimeType(req.file.mimetype);
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
  const key = `resumes/${req.candidate.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  await storage.putBuffer(key, req.file.buffer);
  const resume = await Resume.create({ candidateId: req.candidate.id, originalName: safeName, storageKey: key, mimeType, fileSize: req.file.size, sha256: checksum, sourceType: format === "image" ? "IMAGE_OCR" : "DOCUMENT" });
  try {
    const parsed = await parseResume({ storageKey: key, format, mimeType });
    resume.parseStatus = "PARSED"; resume.extractedText = parsed.extractedText; resume.structuredData = parsed.structuredData; resume.ocrConfidence = parsed.ocrConfidence; if (parsed.ocrConfidence !== undefined) resume.sourceType = "IMAGE_OCR"; resume.processedAt = new Date(); await resume.save();
  } catch (error) {
    resume.parseStatus = "FAILED"; resume.parseError = error instanceof ApiError ? error.message : "Resume could not be parsed. Upload a readable PDF, DOC, DOCX, or a clear resume photo."; await resume.save();
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, "RESUME_PARSE_FAILED", resume.parseError);
  }
  req.candidate.resumeId = resume._id; req.candidate.status = CandidateStatus.READY_FOR_INTERVIEW; await req.candidate.save();
  res.status(201).json({ resume: { id: resume.id, originalName: resume.originalName, parseStatus: resume.parseStatus, structuredData: resume.structuredData } });
});

export const downloadOwnResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.resumeId, candidateId: req.candidate._id }).select("+storageKey");
  if (!resume) throw new ApiError(404, "RESUME_NOT_FOUND", "Resume was not found.");
  if (!(await storage.exists(resume.storageKey))) throw new ApiError(404, "FILE_NOT_FOUND", "Resume file is unavailable.");
  res.setHeader("Content-Type", resume.mimeType); res.setHeader("Content-Disposition", `attachment; filename="${resume.originalName}"`); (await storage.createReadStream(resume.storageKey)).pipe(res);
});
