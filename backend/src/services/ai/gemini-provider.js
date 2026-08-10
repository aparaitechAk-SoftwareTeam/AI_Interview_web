import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

function extractJson(text) {
  const trimmed = String(text || "").trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function uniqueModels() {
  return [...new Set([env.AI_MODEL, ...env.AI_FALLBACK_MODELS].filter(Boolean))];
}

function shouldTryFallbackModel(error) {
  return error?.status === 429 || error?.status === 404 || /quota|rate limit|resource_exhausted|not available|model not found/i.test(String(error?.message));
}

// Gemini enforces this schema while generating. Zod remains the final
// server-side guard, but providing the schema prevents harmless variations
// such as "Medium" or "JavaScript / DOM" from crashing an active interview.
export function geminiResponseSchema(schema) {
  const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema);
  return jsonSchema;
}

export class GeminiProvider {
  constructor() {
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new ApiError(503, "AI_NOT_CONFIGURED", "AI is not configured. Contact the interview administrator.");
    this.client = new GoogleGenAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
  }

  async generateJson({ prompt, contents = prompt, schema, label, useResponseSchema = true }) {
    let lastError;
    for (const model of uniqueModels()) {
      for (let attempt = 0; attempt <= env.AI_MAX_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
        try {
          const response = await this.client.models.generateContent({
            model,
            contents,
            config: {
              responseMimeType: "application/json",
              ...(useResponseSchema ? { responseJsonSchema: geminiResponseSchema(schema) } : {}),
              abortSignal: controller.signal
            }
          });
          const parsed = schema.safeParse(extractJson(response.text));
          if (!parsed.success) throw new ApiError(502, "AI_INVALID_RESPONSE", `${label} returned an invalid structured response.`);
          return parsed.data;
        } catch (error) {
          lastError = error;
          // A quota/error on one Gemini model must not block an active interview
          // when this project/key has another compatible, real Gemini model.
          if (shouldTryFallbackModel(error)) break;
          if (attempt < env.AI_MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
        } finally {
          clearTimeout(timer);
        }
      }
    }
    if (lastError instanceof ApiError) throw lastError;
    if (lastError?.status === 429 || /quota|rate limit|resource_exhausted/i.test(String(lastError?.message))) {
      throw new ApiError(503, "AI_RATE_LIMITED", "The AI service is briefly busy. Your upload is safe; please retry in a minute.");
    }
    throw new ApiError(503, "AI_UNAVAILABLE", "The AI interview service is temporarily unavailable. Your progress is safe; please retry shortly.");
  }
}
