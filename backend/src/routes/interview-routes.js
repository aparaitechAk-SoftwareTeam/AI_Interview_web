import { Router } from "express";
import { current, finalizeRecording, forceComplete, logEvent, recordingStatus, start, submitAnswer, uploadRecordingChunk } from "../controllers/interview-controller.js";
import { requireInterviewCandidate } from "../middleware/auth.js";
import { verifyCandidateSession } from "../middleware/candidate-scope.js";
import { chunkUpload } from "../middleware/upload.js";

export const interviewRoutes = Router();
interviewRoutes.use(requireInterviewCandidate, verifyCandidateSession);
interviewRoutes.post("/start", start);
interviewRoutes.get("/:interviewId/current", current);
interviewRoutes.post("/:interviewId/answers", submitAnswer);
interviewRoutes.post("/:interviewId/events", logEvent);
interviewRoutes.post("/:interviewId/complete", forceComplete);
interviewRoutes.post("/:interviewId/recording/chunks", chunkUpload.single("chunk"), uploadRecordingChunk);
interviewRoutes.get("/:interviewId/recording/status", recordingStatus);
interviewRoutes.post("/:interviewId/recording/finalize", finalizeRecording);
