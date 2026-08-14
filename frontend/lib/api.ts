"use client";
import { session } from "./session";

export class ApiError extends Error { constructor(message: string, public status = 0, public code = "REQUEST_FAILED", public details?: unknown) { super(message); } }

async function request<T>(path: string, options: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers = new Headers(options.headers); headers.set("Accept", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/backend?path=${encodeURIComponent(path)}`, { ...options, headers });
  const type = response.headers.get("content-type") || ""; const parsed = type.includes("json") ? await response.json().catch(() => null) : null;
  if (!response.ok) throw new ApiError(parsed?.error?.message || "Request failed.", response.status, parsed?.error?.code, parsed?.error?.details);
  return parsed as T;
}

export const api = {
  verifyInvitation: (code: string) => request<any>("/api/invitations/verify", { method: "POST", body: JSON.stringify({ code }) }),
  candidateProfile: () => request<any>("/api/candidates/me/profile", { token: session.get("status") }),
  uploadResume: (candidateId: string, file: File) => { const body = new FormData(); body.append("resume", file); return request<any>(`/api/candidates/${candidateId}/resume`, { method: "POST", body, token: session.get("interview") }); },
  startInterview: () => request<any>("/api/interviews/start", { method: "POST", body: JSON.stringify({ consent: { version: "web-v1", recording: true, camera: true, microphone: true, monitoring: true } }), token: session.get("interview") }),
  currentInterview: (id: string) => request<any>(`/api/interviews/${id}/current`, { token: session.get("interview") }),
  submitAnswer: (id: string, payload: unknown, idempotencyKey: string) => request<any>(`/api/interviews/${id}/answers`, { method: "POST", body: JSON.stringify(payload), headers: { "Idempotency-Key": idempotencyKey }, token: session.get("interview") }),
  event: (id: string, payload: unknown) => request<any>(`/api/interviews/${id}/events`, { method: "POST", body: JSON.stringify(payload), token: session.get("interview") }),
  uploadChunk: async (id: string, chunk: Blob, index: number, totalChunks: number, totalBytes: number) => {
    const body = new FormData();
    body.append("chunk", chunk, `chunk-${index}.webm`);
    body.append("index", String(index));
    body.append("totalChunks", String(totalChunks));
    body.append("totalBytes", String(totalBytes));

    const path = `/api/interviews/${id}/recording/chunks`;

    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      const headers = new Headers({ Accept: "application/json" });
      const token = session.get("interview");
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const response = await fetch(`http://localhost:4000${path}`, {
        method: "POST",
        body,
        headers
      });

      const type = response.headers.get("content-type") || "";
      const parsed = type.includes("json") ? await response.json().catch(() => null) : null;

      if (!response.ok) {
        throw new ApiError(
          parsed?.error?.message || "Recording chunk upload failed.",
          response.status,
          parsed?.error?.code,
          parsed?.error?.details
        );
      }

      return parsed;
    }

    return request<any>(path, {
      method: "POST",
      body,
      token: session.get("interview")
    });
  },
  finalizeRecording: (id: string, durationSeconds: number) => request<any>(`/api/interviews/${id}/recording/finalize`, { method: "POST", body: JSON.stringify({ durationSeconds }), token: session.get("interview") }),
  adminLogin: (username: string, password: string) => request<any>("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  adminDashboard: () => request<any>("/api/admin/dashboard", { token: session.get("admin") }),
  adminCandidates: (query = "") => request<any>(`/api/admin/candidates${query ? `?${query}` : ""}`, { token: session.get("admin") }),
  adminRegistry: (query = "") => request<any>(`/api/admin/candidates/registry${query ? `?${query}` : ""}`, { token: session.get("admin") }),
  adminCandidate: (id: string) => request<any>(`/api/admin/candidates/${id}`, { token: session.get("admin") }),
  createCandidate: (payload: unknown) => request<any>("/api/admin/candidates", { method: "POST", body: JSON.stringify(payload), token: session.get("admin") }),
  resetInvitation: (candidateId: string, validityHours = 168) => request<any>(`/api/admin/candidates/${candidateId}/invitation/reset`, { method: "POST", body: JSON.stringify({ validityHours }), token: session.get("admin") }),
  decide: (interviewId: string, payload: unknown) => request<any>(`/api/admin/interviews/${interviewId}/decision`, { method: "POST", body: JSON.stringify(payload), token: session.get("admin") }),
  settings: () => request<any>("/api/admin/settings", { token: session.get("admin") }),
  updateSettings: (payload: unknown) => request<any>("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload), token: session.get("admin") }),
  scanCandidates: (file: File, position = "") => { const body = new FormData(); body.append("file", file); body.append("position", position); return request<any>("/api/admin/candidates/bulk/scan", { method: "POST", body, token: session.get("admin") }); },
  importCandidates: (payload: unknown) => request<any>("/api/admin/candidates/bulk/import", { method: "POST", body: JSON.stringify(payload), token: session.get("admin") }),
  protectedMedia: async (path: string, token: string | null) => { const response = await fetch(`/api/backend?path=${encodeURIComponent(path)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (!response.ok) throw new ApiError("Protected recording is not available yet.", response.status); return URL.createObjectURL(await response.blob()); }
};
