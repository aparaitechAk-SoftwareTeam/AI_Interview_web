import { z } from "zod";
import { DECISIONS, EVENT_TYPES } from "../constants/enums.js";

export const adminLogin = z.object({ username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/), password: z.string().min(1).max(200) }).strict();
export const createCandidate = z.object({
  fullName: z.string().trim().min(2).max(120), email: z.string().email(), phone: z.string().trim().min(7).max(30),
  college: z.string().trim().max(160).optional(), qualification: z.string().trim().max(160).optional(), position: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(), validityHours: z.coerce.number().int().min(1).max(24 * 90).default(168), singleUse: z.boolean().default(false)
}).strict();
export const invitationVerify = z.object({ code: z.string().trim().min(6).max(24) }).strict();
export const consent = z.object({ version: z.string().trim().min(1).max(30), recording: z.literal(true), camera: z.literal(true), microphone: z.literal(true), monitoring: z.literal(true) }).strict();
export const answer = z.object({ questionId: z.string().regex(/^[a-f\d]{24}$/i), transcript: z.string().trim().min(1).max(12000), transcriptConfidence: z.number().min(0).max(1).optional(), source: z.enum(["SPEECH", "MANUAL"]).default("SPEECH") }).strict();
export const event = z.object({ type: z.enum(EVENT_TYPES), timestamp: z.coerce.date().optional(), durationMs: z.coerce.number().min(0).max(60 * 60 * 1000).optional(), confidence: z.number().min(0).max(1).optional(), metadata: z.record(z.string(), z.unknown()).default({}) }).strict();
export const decision = z.object({ decision: z.enum(DECISIONS), comment: z.string().trim().max(2000).optional(), candidateFeedback: z.string().trim().max(1500).optional() }).strict();
export const resetInvitation = z.object({ validityHours: z.coerce.number().int().min(1).max(24 * 90).default(168) }).strict();
export const terminate = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export const interviewSettings = z.object({
  durationMinutes: z.coerce.number().int().min(5).max(60), maxQuestions: z.coerce.number().int().min(5).max(30), adaptiveDifficulty: z.boolean().default(true), recordingRetentionDays: z.coerce.number().int().min(1).max(365),
  weights: z.object({ technical: z.coerce.number().min(0).max(100), aptitude: z.coerce.number().min(0).max(100), resume: z.coerce.number().min(0).max(100), communication: z.coerce.number().min(0).max(100), behavioral: z.coerce.number().min(0).max(100) }).refine((weights) => Object.values(weights).reduce((total, value) => total + value, 0) === 100, "Category weights must equal 100.")
}).strict();
