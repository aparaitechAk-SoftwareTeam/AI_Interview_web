import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { finalPrompt, evaluationPrompt, questionPrompt } from "./prompts.js";
import { evaluationSchema, finalAssessmentSchema, questionSchema } from "./schemas.js";
import { GeminiProvider } from "./gemini-provider.js";

function provider() {
  if (env.AI_PROVIDER !== "gemini") throw new ApiError(503, "AI_DISABLED", "AI provider is disabled. The interview cannot continue safely.");
  return new GeminiProvider();
}

export const interviewAi = {
  generateQuestion(context) {
    return provider().generateJson({ prompt: questionPrompt(context), schema: questionSchema, label: "Question generation" });
  },
  evaluateAnswer(context) {
    return provider().generateJson({ prompt: evaluationPrompt(context), schema: evaluationSchema, label: "Answer evaluation" });
  },
  finalAssessment(context) {
    return provider().generateJson({ prompt: finalPrompt(context), schema: finalAssessmentSchema, label: "Final assessment" });
  }
};
