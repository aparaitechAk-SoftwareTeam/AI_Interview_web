import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

function readToken(req) {
  const value = req.get("authorization");
  if (!value?.startsWith("Bearer ")) throw new ApiError(401, "AUTH_REQUIRED", "Sign in is required.");
  return value.slice(7);
}
function decode(req) {
  try { return jwt.verify(readToken(req), env.JWT_SECRET, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(401, "INVALID_SESSION", "Your session has expired. Please sign in again."); }
}
export function requireAdmin(req, _res, next) {
  try { const auth = decode(req); if (auth.role !== "ADMIN") throw new ApiError(403, "ADMIN_ONLY", "Administrator access is required."); req.auth = auth; next(); } catch (error) { next(error); }
}
export function requireCandidate(req, _res, next) {
  try { const auth = decode(req); if (auth.role !== "CANDIDATE") throw new ApiError(403, "CANDIDATE_ONLY", "Candidate access is required."); req.auth = auth; next(); } catch (error) { next(error); }
}
export function requireInterviewCandidate(req, _res, next) {
  try { const auth = decode(req); if (auth.role !== "CANDIDATE" || auth.scope !== "INTERVIEW") throw new ApiError(403, "INTERVIEW_SCOPE_REQUIRED", "A current interview access token is required."); req.auth = auth; next(); } catch (error) { next(error); }
}
export function issueAdminToken(admin) {
  return jwt.sign({ sub: String(admin._id), role: "ADMIN" }, env.JWT_SECRET, { expiresIn: "8h", issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
}
export function issueCandidateTokens(candidate, invitation) {
  const claims = { sub: String(candidate._id), role: "CANDIDATE", candidateId: String(candidate._id), invitationId: String(invitation._id), sessionVersion: candidate.sessionVersion };
  return {
    interviewToken: jwt.sign({ ...claims, scope: "INTERVIEW" }, env.JWT_SECRET, { expiresIn: "2h", issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }),
    statusToken: jwt.sign({ ...claims, scope: "STATUS" }, env.JWT_SECRET, { expiresIn: "30d", issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE })
  };
}
