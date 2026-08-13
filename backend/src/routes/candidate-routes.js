import { Router } from "express";
import { downloadOwnResume, profile, status, streamOwnRecording, uploadResume } from "../controllers/candidate-controller.js";
import { requireCandidate, requireInterviewCandidate } from "../middleware/auth.js";
import { verifyCandidateSession } from "../middleware/candidate-scope.js";
import { resumeUpload } from "../middleware/upload.js";

export const candidateRoutes = Router();
candidateRoutes.get("/status", requireCandidate, verifyCandidateSession, status);
candidateRoutes.get("/me/profile", requireCandidate, verifyCandidateSession, profile);
candidateRoutes.get("/me/interviews/:interviewId/recording", requireCandidate, verifyCandidateSession, streamOwnRecording);
candidateRoutes.post("/:candidateId/resume", requireInterviewCandidate, verifyCandidateSession, resumeUpload.single("resume"), uploadResume);
candidateRoutes.get("/resumes/:resumeId/download", requireInterviewCandidate, verifyCandidateSession, downloadOwnResume);
