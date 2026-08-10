import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verify } from "../controllers/invitation-controller.js";

export const invitationRoutes = Router();
invitationRoutes.post("/verify", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: { code: "INVITATION_RATE_LIMITED", message: "Too many invitation attempts. Please wait before retrying." } } }), verify);
