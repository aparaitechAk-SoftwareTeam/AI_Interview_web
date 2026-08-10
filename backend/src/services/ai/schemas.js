import { z } from "zod";
import { DIFFICULTIES, QUESTION_CATEGORIES, RECOMMENDATIONS } from "../../constants/enums.js";

const score = z.number().finite().min(0).max(100);
export const questionSchema = z.object({
  question: z.string().min(8).max(1200),
  category: z.enum(QUESTION_CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  rationale: z.string().min(3).max(500),
  expectedConcepts: z.array(z.string().min(1).max(120)).min(1).max(8),
  relatedResumeSection: z.string().max(120).optional(),
  followUp: z.boolean(),
  followUpOfSequence: z.number().int().positive().optional()
}).strict();

export const evaluationSchema = z.object({
  relevance: score,
  accuracy: score,
  completeness: score,
  communication: score,
  confidence: score,
  overall: score,
  strongPoints: z.array(z.string().max(300)).max(6),
  missingConcepts: z.array(z.string().max(300)).max(6),
  needsFollowUp: z.boolean(),
  followUpReason: z.string().max(400),
  resumeClaimConfidence: score,
  resumeClaimStatus: z.enum(["CONSISTENT", "UNCERTAIN", "POSSIBLE_MISMATCH"]),
  evidence: z.array(z.object({ claim: z.string().max(300), evidence: z.string().max(500) })).max(6)
}).strict();

export const finalAssessmentSchema = z.object({
  strengths: z.array(z.string().max(350)).max(8),
  weaknesses: z.array(z.string().max(350)).max(8),
  interviewSummary: z.string().min(20).max(1800),
  recommendedDecision: z.enum(RECOMMENDATIONS),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  recommendedNextStep: z.string().min(3).max(350),
  evidence: z.array(z.object({ area: z.string().max(120), questionSequence: z.number().int().positive(), explanation: z.string().max(600) })).max(20)
}).strict();

const resumeText = z.string().max(100000);
const resumeItems = z.array(z.string().min(1).max(500)).max(50);

export const visualResumeSchema = z.object({
  isResume: z.boolean(),
  readability: z.number().finite().min(0).max(100),
  extractedText: resumeText,
  candidateName: z.string().max(160),
  email: z.string().max(254),
  phone: z.string().max(80),
  skills: resumeItems,
  programmingLanguages: resumeItems,
  frameworks: resumeItems,
  tools: resumeItems,
  databases: resumeItems,
  projects: resumeItems,
  internships: resumeItems,
  workExperience: resumeItems,
  education: resumeItems,
  certifications: resumeItems,
  achievements: resumeItems,
  strengths: resumeItems,
  technologies: resumeItems
}).strict();
