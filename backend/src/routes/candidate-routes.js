import { Router } from "express";
import { downloadOwnResume, status, uploadResume } from "../controllers/candidate-controller.js";
import { requireCandidate, requireInterviewCandidate } from "../middleware/auth.js";
import { verifyCandidateSession } from "../middleware/candidate-scope.js";
import { resumeUpload } from "../middleware/upload.js";

export const candidateRoutes = Router();
candidateRoutes.get("/status", requireCandidate, verifyCandidateSession, status);
candidateRoutes.post("/:candidateId/resume", requireInterviewCandidate, verifyCandidateSession, resumeUpload.single("resume"), uploadResume);
candidateRoutes.get("/resumes/:resumeId/download", requireInterviewCandidate, verifyCandidateSession, downloadOwnResume);
