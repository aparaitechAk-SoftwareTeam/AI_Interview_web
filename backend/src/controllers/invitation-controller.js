import { Candidate, Invitation } from "../models/index.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { issueCandidateTokens } from "../middleware/auth.js";
import { normalizeInvitation } from "../utils/crypto.js";
import { invitationVerify } from "../validators/request.js";
import { CandidateStatus } from "@aparaitech/shared";

const view = (candidate) => ({ id: candidate.id, fullName: candidate.fullName, email: candidate.email, phone: candidate.phone, position: candidate.position, status: candidate.status, resumeUploaded: Boolean(candidate.resumeId) });

export const verify = asyncHandler(async (req, res) => {
  const { code } = invitationVerify.parse(req.body);
  const invitation = await Invitation.findOne({ code: normalizeInvitation(code) });
  if (!invitation) throw new ApiError(404, "INVALID_INVITATION", "This invitation code is not valid.");
  const now = new Date();
  if (invitation.lockUntil && invitation.lockUntil > now) throw new ApiError(429, "INVITATION_LOCKED", "This invitation is temporarily locked. Please try again later.");
  if (!invitation.active || invitation.revokedAt) throw new ApiError(403, "INVITATION_REVOKED", "This invitation has been revoked. Contact the administrator.");
  if (invitation.expiresAt <= now) throw new ApiError(410, "INVITATION_EXPIRED", "This invitation has expired. Contact the administrator.");
  const candidate = await Candidate.findById(invitation.candidateId);
  if (!candidate) throw new ApiError(404, "INVALID_INVITATION", "This invitation code is not valid.");
  if (invitation.singleUse && invitation.usedAt) throw new ApiError(409, "INVITATION_ALREADY_USED", "This invitation has already been used. Contact the administrator if you need access again.");
  if (candidate.status === CandidateStatus.INVITED) { candidate.status = CandidateStatus.RESUME_PENDING; await candidate.save(); }
  invitation.lastVerifiedAt = now; invitation.failedAttempts = 0; if (invitation.singleUse) invitation.usedAt = now; await invitation.save();
  const tokens = issueCandidateTokens(candidate, invitation);
  res.json({ candidate: view(candidate), invitation: { expiresAt: invitation.expiresAt, reattemptCount: invitation.reattemptCount }, tokens, interviewAccess: candidate.status !== CandidateStatus.INTERVIEW_COMPLETED && candidate.status !== CandidateStatus.SELECTED && candidate.status !== CandidateStatus.REJECTED });
});
