import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login } from "../controllers/auth-controller.js";

export const authRoutes = Router();
authRoutes.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false, message: { error: { code: "LOGIN_RATE_LIMITED", message: "Too many login attempts. Please wait before retrying." } } }), login);
