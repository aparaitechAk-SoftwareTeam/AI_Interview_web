import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { normalizeInvitation } from "../src/utils/crypto.js";
import { calculateIntegrity } from "../src/utils/integrity.js";
import { aggregateScores } from "../src/utils/score.js";
import { validateResumeFile } from "../src/services/resume/file-validation.js";
import { parseImageResume, structureResume } from "../src/services/resume/resume-parser.js";
import { GeminiProvider, geminiResponseSchema } from "../src/services/ai/gemini-provider.js";
import { candidateView } from "../src/controllers/admin-controller.js";
import { recordingFileExtension } from "../src/controllers/interview-controller.js";
import { localOcrResult } from "../src/services/resume/local-image-ocr.js";
import { evaluationSchema, questionSchema } from "../src/services/ai/schemas.js";
import { adminLogin } from "../src/validators/request.js";
import { ApiError } from "../src/utils/api-error.js";

describe("security and resilience primitives", () => {
  it("normalizes invitation codes without accepting sequential identifiers", () => {
    expect(normalizeInvitation("apai7f29kq81")).toBe("APAI-7F29-KQ81");
  });
  it("rejects executable content masquerading as a PDF", () => {
    expect(() => validateResumeFile({ originalname: "resume.pdf", mimetype: "application/pdf", buffer: Buffer.from("MZ executable") })).toThrow(/content does not match/i);
  });
  it("accepts a signed PDF header only when extension and MIME agree", () => {
    expect(validateResumeFile({ originalname: "resume.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7\nresume") })).toBe("pdf");
  });
  it("accepts a camera-photo resume only when JPEG bytes and extension agree", () => {
    expect(validateResumeFile({ originalname: "resume-photo.jpg", mimetype: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) })).toBe("image");
    expect(() => validateResumeFile({ originalname: "resume.jpg", mimetype: "image/jpeg", buffer: Buffer.from("MZ executable") })).toThrow(/content does not match/i);
  });
  it("parses resume skills that contain regular-expression characters", () => {
    const parsed = structureResume("Skills: C++, Node.js, React");
    expect(parsed.skills).toEqual(expect.arrayContaining(["C++", "Node.js", "React"]));
  });
  it("rejects malformed AI output rather than allowing it to crash an interview", () => {
    expect(questionSchema.safeParse({ question: "ok", category: "TECHNICAL" }).success).toBe(false);
    expect(evaluationSchema.safeParse({ relevance: 101 }).success).toBe(false);
  });
  it("passes the strict response enum contract to Gemini", () => {
    const schema = geminiResponseSchema(questionSchema);
    expect(schema.properties.category.enum).toContain("TECHNICAL");
    expect(schema.properties.difficulty.enum).toEqual(["EASY", "MEDIUM", "HARD"]);
    expect(schema.required).toContain("followUp");
  });
  it("changes to a compatible Gemini fallback model after a quota response", async () => {
    const provider = new GeminiProvider();
    const calls = [];
    provider.client = { models: { generateContent: async ({ model }) => {
      calls.push(model);
      if (calls.length === 1) {
        const error = new Error("RESOURCE_EXHAUSTED");
        error.status = 429;
        throw error;
      }
      return { text: JSON.stringify({ question: "Explain a JavaScript closure in your own words.", category: "TECHNICAL", difficulty: "EASY", rationale: "Checks JavaScript fundamentals.", expectedConcepts: ["scope"], followUp: false }) };
    } } };
    const result = await provider.generateJson({ prompt: "test", schema: questionSchema, label: "Question" });
    expect(result.category).toBe("TECHNICAL");
    expect(calls.length).toBe(2);
    expect(calls[0]).not.toBe(calls[1]);
  });
  it("keeps a stable candidate ID when an admin list uses lean records", () => {
    expect(candidateView({ _id: "candidate-123", fullName: "Candidate", status: "INVITED" }).id).toBe("candidate-123");
  });
  it("accepts a username-based administrator login without treating it as an email", () => {
    expect(adminLogin.safeParse({ username: "Aparaitech.org", password: "valid-password" }).success).toBe(true);
    expect(adminLogin.safeParse({ username: "not a username", password: "valid-password" }).success).toBe(false);
  });
  it("keeps browser WebM recordings with the correct storage extension", () => {
    expect(recordingFileExtension("video/webm")).toBe("webm");
    expect(recordingFileExtension("video/mp4")).toBe("mp4");
  });
  it("normalizes usable local OCR text without depending on an AI quota", () => {
    expect(localOcrResult("Vivek Jagtap\nSkills: React, Node.js", 81)).toEqual({ extractedText: "Vivek Jagtap\nSkills: React, Node.js", ocrConfidence: 81 });
    expect(() => localOcrResult("too short", 90)).toThrow(/could not read/i);
  });
  it("falls back to local OCR when the AI photo parser is rate-limited", async () => {
    const parsed = await parseImageResume(
      { buffer: Buffer.from("photo"), mimeType: "image/jpeg" },
      {
        visualExtractor: async () => { throw new ApiError(503, "AI_RATE_LIMITED", "busy"); },
        localExtractor: async () => ({ extractedText: "Vivek Jagtap\nSkills: React, Node.js", ocrConfidence: 88 })
      }
    );
    expect(parsed.ocrConfidence).toBe(88);
    expect(parsed.structuredData.skills).toEqual(expect.arrayContaining(["React", "Node.js"]));
  });
  it("keeps integrity review separate from answer score", () => {
    const integrity = calculateIntegrity([{ type: "APP_BACKGROUND", durationMs: 1000 }, { type: "MULTIPLE_FACES", durationMs: 31000 }]);
    expect(integrity.score).toBeLessThan(100); expect(integrity.label).not.toBeUndefined();
  });
  it("aggregates evidence by configured category weighting", () => {
    const scores = aggregateScores([{ question: { category: "TECHNICAL" }, answer: { evaluation: { accuracy: 80, overall: 80, communication: 72, resumeClaimConfidence: 75 } } }, { question: { category: "COMMUNICATION" }, answer: { evaluation: { accuracy: 0, overall: 77, communication: 77, resumeClaimConfidence: 0 } } }], { technical: 35, aptitude: 20, resume: 20, communication: 15, behavioral: 10 });
    expect(scores.technicalScore).toBe(80); expect(scores.communicationScore).toBe(77); expect(scores.overallScore).toBeGreaterThan(0);
  });
  it("does not expose protected admin API without a JWT", async () => {
    const response = await request(app).get("/api/admin/dashboard");
    expect(response.status).toBe(401); expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });
  it("reports health without exposing environment secrets", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200); expect(JSON.stringify(response.body)).not.toContain("JWT_SECRET"); expect(JSON.stringify(response.body)).not.toContain("MONGODB");
  });
});
