import bcrypt from "bcryptjs";
import { CandidateStatus, InterviewStatus } from "@aparaitech/shared";
import { Admin, AdminDecision, Candidate, Interview, InterviewAnswer, InterviewEvent, InterviewQuestion, InterviewRecording, Invitation, Resume } from "../models/index.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { createInvitationCode } from "../utils/crypto.js";
import { writeAudit } from "../utils/audit.js";
import { calculateIntegrity } from "../utils/integrity.js";
import { storage } from "../services/storage/index.js";
import { invitationEmail } from "../services/notifications/invitation-email.js";
import { createCandidate, decision, resetInvitation, terminate } from "../validators/request.js";

const recordingChunkKey = (recordingId, index) => `recording-chunks/${recordingId}/${String(index).padStart(6, "0")}.part`;

async function newInvitation(candidateId, adminId, validityHours, singleUse = false) {
  for (let tries = 0; tries < 5; tries += 1) {
    try { return await Invitation.create({ code: createInvitationCode(), candidateId, createdBy: adminId, expiresAt: new Date(Date.now() + validityHours * 3600000), singleUse }); }
    catch (error) { if (error.code !== 11000 || tries === 4) throw error; }
  }
}
export const candidateView = (candidate) => ({
  // Mongoose documents expose `.id`; `.lean()` records do not. The admin list
  // uses lean records, so always derive a stable string ID for navigation and
  // React keys rather than emitting an undefined candidate id.
  id: String(candidate.id || candidate._id),
  fullName: candidate.fullName,
  email: candidate.email,
  phone: candidate.phone,
  college: candidate.college,
  qualification: candidate.qualification,
  position: candidate.position,
  status: candidate.status,
  createdAt: candidate.createdAt,
  updatedAt: candidate.updatedAt
});
const invitationView = (invitation) => invitation && ({
  id: String(invitation.id || invitation._id),
  code: invitation.code,
  active: invitation.active,
  expiresAt: invitation.expiresAt,
  emailDelivery: { status: invitation.emailDelivery?.status || "PENDING", sentAt: invitation.emailDelivery?.sentAt || null, lastAttemptAt: invitation.emailDelivery?.lastAttemptAt || null }
});
async function deliverInvitation(candidate, invitation) {
  invitation.emailDelivery = await invitationEmail.send({ candidate, invitation });
  await invitation.save();
  return invitationView(invitation);
}

export const create = asyncHandler(async (req, res) => {
  const payload = createCandidate.parse(req.body);
  const candidate = await Candidate.create({ ...payload, status: CandidateStatus.INVITED });
  const invitation = await newInvitation(candidate._id, req.auth.sub, payload.validityHours, payload.singleUse);
  candidate.invitationId = invitation._id; await candidate.save();
  const deliveredInvitation = await deliverInvitation(candidate, invitation);
  await writeAudit({ adminId: req.auth.sub, action: "CANDIDATE_CREATED", resourceType: "Candidate", resourceId: candidate.id, metadata: { invitationId: invitation.id, emailDelivery: deliveredInvitation.emailDelivery.status }, ip: req.ip });
  res.status(201).json({ candidate: candidateView(candidate), invitation: deliveredInvitation });
});

export const list = asyncHandler(async (req, res) => {
  const { q = "", status, position, aiRecommendation, decision: requestedDecision, page = "1", limit = "25" } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (position) filter.position = position;
  if (q) { const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); filter.$or = ["fullName", "email", "phone"].map((field) => ({ [field]: new RegExp(safe, "i") })); }
  const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));
  const [candidates, total] = await Promise.all([Candidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Math.min(100, Number(limit))).populate("invitationId", "code expiresAt active emailDelivery").populate("currentInterviewId", "scores aiRecommendation").lean(), Candidate.countDocuments(filter)]);
  const filtered = candidates.filter((candidate) => (!aiRecommendation || candidate.currentInterviewId?.aiRecommendation === aiRecommendation) && (!requestedDecision || candidate.status === ({ ACCEPT: "SELECTED", REJECT: "REJECTED", HOLD: "HOLD", REINTERVIEW: "REINTERVIEW_REQUIRED" }[requestedDecision])));
  res.json({ candidates: filtered.map((candidate) => ({ ...candidateView(candidate), invitation: invitationView(candidate.invitationId), aiScore: candidate.currentInterviewId?.scores?.overallScore, aiRecommendation: candidate.currentInterviewId?.aiRecommendation })), total, page: Number(page) });
});

export const registry = asyncHandler(async (req, res) => {
  const { q = "", status } = req.query; const filter = {};
  if (status) filter.status = status;
  if (q) { const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); filter.$or = ["fullName", "email", "phone", "position"].map((field) => ({ [field]: new RegExp(safe, "i") })); }
  const [candidates, grouped] = await Promise.all([
    Candidate.find(filter).sort({ createdAt: -1 }).limit(500).populate("invitationId", "code expiresAt active emailDelivery").populate("currentInterviewId", "scores aiRecommendation").lean(),
    Candidate.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
  ]);
  const pipeline = Object.fromEntries(grouped.map((entry) => [entry._id, entry.count]));
  res.json({ generatedAt: new Date().toISOString(), total: candidates.length, pipeline, candidates: candidates.map((candidate) => ({ ...candidateView(candidate), invitation: invitationView(candidate.invitationId), aiScore: candidate.currentInterviewId?.scores?.overallScore, aiRecommendation: candidate.currentInterviewId?.aiRecommendation })) });
});

export const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const activityStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  const completedMatch = { status: InterviewStatus.COMPLETED };
  const [total, buckets, liveInterviews, latest, metrics, activity] = await Promise.all([
    Candidate.countDocuments(),
    Candidate.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Candidate.countDocuments({ status: CandidateStatus.INTERVIEW_IN_PROGRESS }),
    Interview.find(completedMatch).sort({ completedAt: -1 }).limit(5).populate("candidateId", "fullName position status").lean(),
    Interview.aggregate([
      { $match: completedMatch },
      { $group: { _id: null, completedInterviews: { $sum: 1 }, averageScore: { $avg: "$scores.overallScore" }, averageDurationSeconds: { $avg: "$durationSeconds" } } }
    ]),
    Interview.aggregate([
      { $match: { ...completedMatch, completedAt: { $gte: activityStart, $lte: now } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: "UTC" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  const byStatus = Object.fromEntries(buckets.map((item) => [item._id, item.count]));
  const aggregate = metrics[0] || {};
  const completedInterviews = aggregate.completedInterviews || 0;
  const activityByDay = new Map(activity.map((item) => [item._id, item.count]));
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(activityStart);
    date.setUTCDate(activityStart.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, completed: activityByDay.get(key) || 0 };
  });

  res.json({
    totals: {
      total,
      invited: byStatus.INVITED || 0,
      resumeUploaded: byStatus.READY_FOR_INTERVIEW || 0,
      liveInterviews,
      interviewsCompleted: byStatus.INTERVIEW_COMPLETED || 0,
      underReview: byStatus.UNDER_REVIEW || 0,
      selected: byStatus.SELECTED || 0,
      rejected: byStatus.REJECTED || 0
    },
    analytics: {
      completedInterviews,
      averageScore: Number.isFinite(aggregate.averageScore) ? Math.round(aggregate.averageScore) : null,
      averageDurationSeconds: Number.isFinite(aggregate.averageDurationSeconds) ? Math.round(aggregate.averageDurationSeconds) : null,
      completionRate: total ? Math.round((completedInterviews / total) * 100) : 0,
      last7Days
    },
    recentInterviews: latest.map((item) => ({
      id: item._id,
      candidate: item.candidateId ? { id: item.candidateId._id, fullName: item.candidateId.fullName, position: item.candidateId.position, status: item.candidateId.status } : null,
      overallScore: item.scores?.overallScore,
      aiRecommendation: item.aiRecommendation,
      completedAt: item.completedAt
    })),
    generatedAt: now.toISOString()
  });
});

export const detail = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findById(req.params.candidateId).populate("invitationId", "code expiresAt active revokedAt").populate("resumeId", "originalName parseStatus structuredData processedAt").populate("currentInterviewId");
  if (!candidate) throw new ApiError(404, "CANDIDATE_NOT_FOUND", "Candidate was not found.");
  const interview = candidate.currentInterviewId;
  const [questions, answers, events, recording, adminDecision] = interview ? await Promise.all([InterviewQuestion.find({ interviewId: interview._id }).sort({ sequence: 1 }).lean(), InterviewAnswer.find({ interviewId: interview._id }).lean(), InterviewEvent.find({ interviewId: interview._id }).sort({ timestamp: 1 }).lean(), InterviewRecording.findOne({ interviewId: interview._id }).lean(), AdminDecision.findOne({ interviewId: interview._id }).populate("adminId", "fullName email").lean()]) : [[], [], [], null, null];
  const answerByQuestion = new Map(answers.map((item) => [String(item.questionId), item]));
  await writeAudit({ adminId: req.auth.sub, action: "CANDIDATE_VIEWED", resourceType: "Candidate", resourceId: candidate.id, ip: req.ip });
  res.json({ candidate: candidateView(candidate), invitation: invitationView(candidate.invitationId), resume: candidate.resumeId, interview: interview ? { ...interview.toObject(), integrity: calculateIntegrity(events) } : null, questionAnswers: questions.map((question) => ({ question, answer: answerByQuestion.get(String(question._id)) || null })), events, recording: recording ? { status: recording.status, mimeType: recording.mimeType, durationSeconds: recording.durationSeconds, fileSize: recording.fileSize, chunkCount: recording.chunks?.length || 0, expectedChunks: recording.expectedChunks || 0, expectedBytes: recording.expectedBytes || 0, lastError: recording.lastError || null, finalizedAt: recording.finalizedAt || null, retentionUntil: recording.retentionUntil, updatedAt: recording.updatedAt } : null, adminDecision });
});

export const reset = asyncHandler(async (req, res) => {
  const { validityHours } = resetInvitation.parse(req.body);
  const candidate = await Candidate.findById(req.params.candidateId).populate("invitationId");
  if (!candidate) throw new ApiError(404, "CANDIDATE_NOT_FOUND", "Candidate was not found.");
  if (candidate.invitationId) { candidate.invitationId.active = false; candidate.invitationId.revokedAt = new Date(); await candidate.invitationId.save(); }
  const invitation = await newInvitation(candidate._id, req.auth.sub, validityHours);
  candidate.invitationId = invitation._id; candidate.sessionVersion += 1; candidate.status = candidate.resumeId ? CandidateStatus.READY_FOR_INTERVIEW : CandidateStatus.RESUME_PENDING; candidate.currentInterviewId = undefined; await candidate.save();
  const deliveredInvitation = await deliverInvitation(candidate, invitation);
  await writeAudit({ adminId: req.auth.sub, action: "INVITATION_RESET", resourceType: "Candidate", resourceId: candidate.id, metadata: { invitationId: invitation.id, emailDelivery: deliveredInvitation.emailDelivery.status }, ip: req.ip });
  res.json({ invitation: deliveredInvitation, candidate: candidateView(candidate) });
});

export const terminateInterview = asyncHandler(async (req, res) => {
  const { reason } = terminate.parse(req.body); const interview = await Interview.findById(req.params.interviewId);
  if (!interview) throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
  interview.status = "TERMINATED"; interview.terminatedAt = new Date(); interview.terminatedBy = req.auth.sub; interview.terminationReason = reason; await interview.save();
  await Candidate.findByIdAndUpdate(interview.candidateId, { status: CandidateStatus.HOLD });
  await InterviewEvent.create({ interviewId: interview._id, candidateId: interview.candidateId, type: "ADMIN_TERMINATED", metadata: { reason, adminId: req.auth.sub } });
  await writeAudit({ adminId: req.auth.sub, action: "INTERVIEW_TERMINATED", resourceType: "Interview", resourceId: interview.id, metadata: { reason }, ip: req.ip });
  res.json({ interview: { id: interview.id, status: interview.status } });
});

export const decide = asyncHandler(async (req, res) => {
  const payload = decision.parse(req.body); const interview = await Interview.findById(req.params.interviewId);
  if (!interview) throw new ApiError(404, "INTERVIEW_NOT_FOUND", "Interview was not found.");
  if (interview.status !== "COMPLETED") throw new ApiError(409, "INTERVIEW_NOT_COMPLETE", "Only completed interviews can be decided.");
  const current = await AdminDecision.findOne({ interviewId: interview._id });
  const data = { aiRecommendation: interview.aiRecommendation, decision: payload.decision, adminId: req.auth.sub, comment: payload.comment, candidateFeedback: payload.candidateFeedback, decisionAt: new Date() };
  const finalDecision = current ? await AdminDecision.findByIdAndUpdate(current._id, data, { new: true, runValidators: true }) : await AdminDecision.create({ interviewId: interview._id, candidateId: interview.candidateId, ...data });
  const statusMap = { ACCEPT: CandidateStatus.SELECTED, REJECT: CandidateStatus.REJECTED, HOLD: CandidateStatus.HOLD, REINTERVIEW: CandidateStatus.REINTERVIEW_REQUIRED };
  await Candidate.findByIdAndUpdate(interview.candidateId, { status: statusMap[payload.decision] }); interview.adminDecisionId = finalDecision._id; await interview.save();
  await writeAudit({ adminId: req.auth.sub, action: "ADMIN_DECISION_UPDATED", resourceType: "Interview", resourceId: interview.id, metadata: { decision: payload.decision }, ip: req.ip });
  res.json({ decision: finalDecision });
});

export const streamRecording = asyncHandler(async (req, res) => {
  const recording = await InterviewRecording.findOne({ interviewId: req.params.interviewId }).select("+storageKey");
  if (!recording || recording.status !== "READY" || !recording.storageKey) throw new ApiError(404, "RECORDING_NOT_FOUND", "Recording is not available.");
  if (!(await storage.exists(recording.storageKey))) throw new ApiError(404, "RECORDING_NOT_FOUND", "Recording is not available.");
  await writeAudit({ adminId: req.auth.sub, action: "RECORDING_VIEWED", resourceType: "InterviewRecording", resourceId: recording.id, ip: req.ip });
  const { size } = await storage.stat(recording.storageKey); const range = req.headers.range;
  res.setHeader("Content-Type", recording.mimeType || "video/mp4"); res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Cache-Control", "private, no-store");
  if (!range) { res.setHeader("Content-Length", size); (await storage.createReadStream(recording.storageKey)).pipe(res); return; }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) { res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return; }
  const start = match[1] ? Number(match[1]) : 0; const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) { res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return; }
  res.status(206); res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`); res.setHeader("Content-Length", end - start + 1); (await storage.createReadStream(recording.storageKey, { start, end })).pipe(res);
});

export const deleteRecording = asyncHandler(async (req, res) => {
  const recording = await InterviewRecording.findOne({ interviewId: req.params.interviewId }).select("+storageKey");
  if (!recording || recording.status === "DELETED") throw new ApiError(404, "RECORDING_NOT_FOUND", "Recording is not available.");
  if (recording.storageKey) await storage.delete(recording.storageKey);
  await Promise.all((recording.chunks || []).map((chunk) => storage.delete(recordingChunkKey(recording.id, chunk.index)).catch(() => {})));
  recording.status = "DELETED"; recording.deletedAt = new Date(); recording.deleteReason = "Deleted by authorized admin"; recording.storageKey = undefined; await recording.save();
  await writeAudit({ adminId: req.auth.sub, action: "RECORDING_DELETED", resourceType: "InterviewRecording", resourceId: recording.id, ip: req.ip });
  res.status(204).end();
});
