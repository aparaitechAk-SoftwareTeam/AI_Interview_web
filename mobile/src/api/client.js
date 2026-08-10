import Constants from "expo-constants";
import { File } from "expo-file-system";
import { secureStorage } from "../services/secure-storage";

const INTERVIEW_TOKEN = "aparaitech.interview-token";
const STATUS_TOKEN = "aparaitech.status-token";
const REQUEST_TIMEOUT_MS = 75_000;

export class ApiError extends Error {
  constructor(message, status = 0, code = "NETWORK_ERROR", details) { super(message); this.status = status; this.code = code; this.details = details; }
}
export function apiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL || Constants.expoConfig?.extra?.apiBaseUrl;
  if (!value || value.includes("${") || !/^https?:\/\//.test(value)) throw new ApiError("Set EXPO_PUBLIC_API_BASE_URL in mobile/.env to your API's reachable HTTPS or LAN URL.", 0, "API_URL_MISSING");
  return value.replace(/\/$/, "");
}
export async function setTokens(tokens) { await Promise.all([secureStorage.set(INTERVIEW_TOKEN, tokens.interviewToken), secureStorage.set(STATUS_TOKEN, tokens.statusToken)]); }
export async function clearTokens() { await Promise.all([secureStorage.remove(INTERVIEW_TOKEN), secureStorage.remove(STATUS_TOKEN)]); }
export const getInterviewToken = () => secureStorage.get(INTERVIEW_TOKEN);
export const getStatusToken = () => secureStorage.get(STATUS_TOKEN);

async function request(path, { method = "GET", body, token = null, headers = {}, signal } = {}) {
  // Render's free tier can take more than 50 seconds to wake after inactivity.
  // Keep the request alive long enough for the first API call from a device.
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const combinedSignal = signal || controller.signal;
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, { method, headers: { Accept: "application/json", ...(body instanceof FormData ? {} : body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: combinedSignal });
    const parsed = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(parsed?.error?.message || "Request failed.", response.status, parsed?.error?.code || "REQUEST_FAILED", parsed?.error?.details);
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") throw new ApiError("The request timed out. Your progress is safe; retry when connected.", 0, "TIMEOUT");
    throw new ApiError("Unable to reach the server. Your progress is saved on this device.", 0, "NETWORK_ERROR");
  } finally { clearTimeout(timeout); }
}

const interviewRequest = async (path, options = {}) => request(path, { ...options, token: await getInterviewToken() });
const statusRequest = async (path, options = {}) => request(path, { ...options, token: await getStatusToken() });

export const api = {
  health: () => request("/health"),
  verifyInvitation: async (code) => { const result = await request("/api/invitations/verify", { method: "POST", body: { code } }); await setTokens(result.tokens); return result; },
  candidateStatus: () => statusRequest("/api/candidates/status"),
  uploadResume: (candidateId, asset) => {
    const data = new FormData();
    if (asset.file) {
      // Browsers provide a native File object through DocumentPicker.
      data.append("resume", asset.file, asset.name || asset.file.name);
    } else {
      // On Android/iOS, Expo's File object is required for reliable multipart
      // uploads. The legacy { uri, name, type } object can make native fetch
      // reject the request before it reaches the server.
      data.append("resume", new File(asset.uri), asset.name || "resume.pdf");
    }
    return interviewRequest(`/api/candidates/${candidateId}/resume`, { method: "POST", body: data });
  },
  startInterview: (consent) => interviewRequest("/api/interviews/start", { method: "POST", body: { consent } }),
  currentInterview: (id) => interviewRequest(`/api/interviews/${id}/current`),
  submitAnswer: (id, answer, idempotencyKey) => interviewRequest(`/api/interviews/${id}/answers`, { method: "POST", body: answer, headers: { "Idempotency-Key": idempotencyKey } }),
  event: (id, event) => interviewRequest(`/api/interviews/${id}/events`, { method: "POST", body: event }),
  completeInterview: (id) => interviewRequest(`/api/interviews/${id}/complete`, { method: "POST" }),
  uploadRecordingChunk: async (id, blob, index, suffix = "mp4") => {
    const data = new FormData();
    if (typeof Blob !== "undefined" && blob instanceof Blob) data.append("chunk", blob, `chunk-${index}.${suffix}`);
    else data.append("chunk", new File(blob.uri), `chunk-${index}.${suffix}`);
    data.append("index", String(index));
    return interviewRequest(`/api/interviews/${id}/recording/chunks`, { method: "POST", body: data });
  },
  finalizeRecording: (id, durationSeconds) => interviewRequest(`/api/interviews/${id}/recording/finalize`, { method: "POST", body: { durationSeconds } }),
  adminLogin: (username, password) => request("/api/admin/login", { method: "POST", body: { username, password } }),
  adminDashboard: (token) => request("/api/admin/dashboard", { token }),
  adminSettings: (token) => request("/api/admin/settings", { token }),
  updateSettings: (token, payload) => request("/api/admin/settings", { method: "PUT", body: payload, token }),
  adminCandidates: (token, query = "") => request(`/api/admin/candidates${query ? `?${query}` : ""}`, { token }),
  adminCandidateRegistry: (token, query = "") => request(`/api/admin/candidates/registry${query ? `?${query}` : ""}`, { token }),
  adminCandidate: (token, id) => request(`/api/admin/candidates/${id}`, { token }),
  createCandidate: (token, payload) => request("/api/admin/candidates", { method: "POST", body: payload, token }),
  decide: (token, interviewId, payload) => request(`/api/admin/interviews/${interviewId}/decision`, { method: "POST", body: payload, token }),
  resetInvitation: (token, candidateId, payload) => request(`/api/admin/candidates/${candidateId}/invitation/reset`, { method: "POST", body: payload, token }),
  terminate: (token, interviewId, reason) => request(`/api/admin/interviews/${interviewId}/terminate`, { method: "POST", body: { reason }, token }),
  deleteRecording: (token, interviewId) => request(`/api/admin/interviews/${interviewId}/recording`, { method: "DELETE", token })
};
