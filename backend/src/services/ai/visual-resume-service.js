import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { visualResumePrompt } from "./prompts.js";
import { visualResumeSchema } from "./schemas.js";
import { GeminiProvider } from "./gemini-provider.js";

function provider() {
  if (env.AI_PROVIDER !== "gemini") throw new ApiError(503, "AI_DISABLED", "AI resume extraction is temporarily unavailable. Please upload a text-based PDF or retry later.");
  return new GeminiProvider();
}

export async function extractVisualResume({ buffer, mimeType }) {
  const result = await provider().generateJson({
    contents: [
      { inlineData: { mimeType, data: buffer.toString("base64") } },
      { text: visualResumePrompt() }
    ],
    schema: visualResumeSchema,
    label: "Resume photo extraction",
    // The visual schema is intentionally broad (full transcript plus many
    // evidence fields). Gemini accepts the image input reliably with JSON mode,
    // while the same strict Zod schema below remains the server-side contract.
    useResponseSchema: false
  });

  if (!result.isResume || result.readability < 25 || result.extractedText.trim().length < 12) {
    throw new ApiError(422, "RESUME_IMAGE_UNREADABLE", "We could not read a complete resume from that photo. Retake it in bright light with every line visible, or upload a PDF.");
  }

  const { isResume, readability, extractedText, ...structuredData } = result;
  return { extractedText: extractedText.slice(0, 100000), structuredData, ocrConfidence: readability };
}
