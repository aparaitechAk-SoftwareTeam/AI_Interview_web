import { Router } from "express";
import { create, dashboard, decide, deleteRecording, detail, list, reset, streamRecording, terminateInterview } from "../controllers/admin-controller.js";
import { requireAdmin } from "../middleware/auth.js";
import { getSettings, updateSettings } from "../controllers/settings-controller.js";

export const adminRoutes = Router();
adminRoutes.use(requireAdmin);
adminRoutes.get("/dashboard", dashboard);
adminRoutes.get("/settings", getSettings);
adminRoutes.put("/settings", updateSettings);
adminRoutes.post("/candidates", create);
adminRoutes.get("/candidates", list);
adminRoutes.get("/candidates/:candidateId", detail);
adminRoutes.post("/candidates/:candidateId/invitation/reset", reset);
adminRoutes.post("/interviews/:interviewId/terminate", terminateInterview);
adminRoutes.post("/interviews/:interviewId/decision", decide);
adminRoutes.get("/interviews/:interviewId/recording", streamRecording);
adminRoutes.delete("/interviews/:interviewId/recording", deleteRecording);
