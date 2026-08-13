import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB: z.string().trim().min(1).max(64).default("ai_mock_interviews"),
  MONGODB_DNS_SERVERS: z.string().default(""),
  JWT_SECRET: z.string().min(32).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().default("aparaitech-interview-api"),
  JWT_AUDIENCE: z.string().default("aparaitech-mobile"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_PROVIDER: z.enum(["gemini", "disabled"]).default("gemini"),
  AI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  AI_FALLBACK_MODELS: z.string().default("gemini-3.1-flash-lite,gemini-flash-lite-latest"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  STORAGE_PROVIDER: z.enum(["local", "gridfs"]).optional(),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
  CORS_ORIGINS: z.string().default("http://localhost:8081,exp://127.0.0.1:8081"),
  ADMIN_USERNAME: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  SMTP_ENABLED: z.enum(["true", "false"]).default("false"),
  SMTP_HOST: z.string().trim().min(1).max(255).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().trim().min(1).max(255).optional(),
  SMTP_PASSWORD: z.string().min(1).max(500).optional(),
  MAIL_PROVIDER: z.enum(["disabled", "smtp", "brevo"]).default("disabled"),
  BREVO_API_KEY: z.string().min(1).max(500).optional(),
  MAIL_FROM: z.string().trim().min(3).max(320).optional(),
  MAIL_FROM_NAME: z.string().trim().min(1).max(70).default("Aparaitech Recruitment"),
  MAIL_REPLY_TO: z.string().email().optional(),
  CANDIDATE_PORTAL_URL: z.string().url().optional(),
  SUPPORT_EMAIL: z.string().email().optional(),
  SEED_DEMO: z.enum(["true", "false"]).default("false")
});

const result = schema.safeParse(process.env);
if (!result.success) throw new Error(`Invalid environment: ${result.error.issues.map((x) => x.message).join(", ")}`);
const values = result.data;
if (values.NODE_ENV === "production" && !values.JWT_SECRET && !values.AUTH_SECRET) throw new Error("JWT_SECRET or AUTH_SECRET is required in production.");
const smtpRequested = values.MAIL_PROVIDER === "smtp" || values.SMTP_ENABLED === "true";
if (smtpRequested && (!values.SMTP_HOST || !values.SMTP_USER || !values.SMTP_PASSWORD || !values.MAIL_FROM)) throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and MAIL_FROM are required when SMTP mail is enabled.");
if (values.MAIL_PROVIDER === "brevo" && (!values.BREVO_API_KEY || !values.MAIL_FROM)) throw new Error("BREVO_API_KEY and MAIL_FROM are required when MAIL_PROVIDER=brevo.");

export const env = Object.freeze({
  ...values,
  JWT_SECRET: values.JWT_SECRET || values.AUTH_SECRET || "development-only-secret-change-before-production-000000",
  STORAGE_PROVIDER: values.STORAGE_PROVIDER || (values.NODE_ENV === "production" ? "gridfs" : "local"),
  UPLOAD_DIR: path.resolve(process.cwd(), values.UPLOAD_DIR),
  MONGODB_DNS_SERVERS: values.MONGODB_DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean),
  CORS_ORIGINS: values.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  AI_FALLBACK_MODELS: values.AI_FALLBACK_MODELS.split(",").map((model) => model.trim()).filter(Boolean),
  SMTP_ENABLED: values.SMTP_ENABLED === "true",
  SMTP_SECURE: values.SMTP_SECURE === "true"
});
