import fs from "node:fs";
import path from "node:path";
import { createWorker, PSM } from "tesseract.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const cachePath = path.join(env.UPLOAD_DIR, ".ocr-cache");

export function localOcrResult(text, confidence) {
  const extractedText = String(text || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (extractedText.length < 12) {
    throw new ApiError(422, "RESUME_IMAGE_UNREADABLE", "We could not read a complete resume from that photo. Retake it in bright light with every line visible, or upload a PDF.");
  }
  return { extractedText: extractedText.slice(0, 100000), ocrConfidence: Math.max(0, Math.min(100, Math.round(Number(confidence) || 0))) };
}

// This path deliberately does not call a paid AI API. It is the reliable
// fallback for a clear JPG/PNG resume photo when the configured AI provider is
// rate-limited, and caches its English OCR language data on the server.
export async function extractLocalImageText(buffer) {
  fs.mkdirSync(cachePath, { recursive: true });
  let worker;
  try {
    worker = await createWorker("eng", 1, {
      cachePath,
      logger: () => {},
      errorHandler: () => {}
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(buffer);
    return localOcrResult(data.text, data.confidence);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "LOCAL_OCR_UNAVAILABLE", "Resume photo processing is unavailable right now. Please retry shortly or upload a PDF.");
  } finally {
    await worker?.terminate().catch(() => {});
  }
}
