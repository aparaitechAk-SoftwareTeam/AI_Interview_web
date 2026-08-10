import { MulterError } from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-error.js";

export function notFoundHandler(req, _res, next) { next(new ApiError(404, "ROUTE_NOT_FOUND", `No endpoint exists for ${req.method} ${req.path}.`)); }
export function errorHandler(error, _req, res, _next) {
  // express.json() raises a SyntaxError for malformed JSON before a route
  // handler is reached. Treat it as a client input error instead of exposing a
  // misleading 500 response in the mobile app.
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: { code: "INVALID_JSON", message: "The request body is not valid JSON." } });
  if (error instanceof ZodError) return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Some fields need attention.", details: error.issues.map((x) => ({ field: x.path.join("."), message: x.message })) } });
  if (error instanceof MulterError) return res.status(400).json({ error: { code: "UPLOAD_ERROR", message: error.code === "LIMIT_FILE_SIZE" ? "The file is too large." : "The upload could not be processed." } });
  if (error?.code === 11000) return res.status(409).json({ error: { code: "DUPLICATE_RECORD", message: "This operation was already recorded." } });
  const safe = error instanceof ApiError;
  if (!safe && process.env.NODE_ENV !== "test") console.error("Request failure", { name: error?.name, message: error?.message });
  return res.status(safe ? error.status : 500).json({ error: { code: safe ? error.code : "INTERNAL_ERROR", message: safe ? error.message : "Something went wrong. Please try again." , ...(safe && error.details ? { details: error.details } : {}) } });
}
