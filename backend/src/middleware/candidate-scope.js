import { Candidate } from "../models/index.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const verifyCandidateSession = asyncHandler(async (req, _res, next) => {
  const candidate = await Candidate.findById(req.auth.candidateId);
  if (!candidate || candidate.sessionVersion !== req.auth.sessionVersion) throw new ApiError(401, "SESSION_REVOKED", "This candidate session is no longer valid.");
  req.candidate = candidate;
  next();
});

export function assertCandidateId(req, id) {
  if (String(req.candidate._id) !== String(id)) throw new ApiError(403, "CANDIDATE_SCOPE_VIOLATION", "You cannot access another candidate's data.");
}
