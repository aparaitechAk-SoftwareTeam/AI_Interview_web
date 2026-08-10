import { api } from "../api/client";

let activeRecorder = null;
let activeStream = null;
let capturedChunks = [];

function recordingMimeType() {
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((candidate) => globalThis.MediaRecorder?.isTypeSupported?.(candidate)) || "";
}

function releaseStream() {
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
}

export const recordingService = {
  // Browser recordings live only in the active tab; native builds keep their recoverable file path.
  supportsPersistentRecovery: false,
  async start() {
    if (!globalThis.navigator?.mediaDevices?.getUserMedia || typeof globalThis.MediaRecorder !== "function") return null;
    activeStream = await globalThis.navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
    const mimeType = recordingMimeType();
    return new Promise((resolve, reject) => {
      const recorder = new globalThis.MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
      activeRecorder = recorder;
      capturedChunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) capturedChunks.push(event.data); };
      recorder.onerror = () => {
        releaseStream();
        activeRecorder = null;
        reject(new Error("Browser recording could not start. Check camera and microphone permissions."));
      };
      recorder.onstop = () => {
        const blob = new Blob(capturedChunks, { type: recorder.mimeType || "video/webm" });
        releaseStream();
        activeRecorder = null;
        resolve({ blob, mimeType: blob.type || "video/webm" });
      };
      recorder.start(1000);
    });
  },
  async stop() {
    if (activeRecorder && activeRecorder.state !== "inactive") activeRecorder.stop();
    else releaseStream();
  },
  async uploadInChunks(interviewId, media, durationSeconds, chunkSize = 4 * 1024 * 1024) {
    const blob = media?.blob || media;
    if (!(blob instanceof Blob) || !blob.size) return { skipped: true };
    const suffix = blob.type.includes("webm") ? "webm" : "mp4";
    for (let offset = 0, index = 0; offset < blob.size; offset += chunkSize, index += 1) {
      const chunk = blob.slice(offset, Math.min(offset + chunkSize, blob.size), blob.type);
      await api.uploadRecordingChunk(interviewId, chunk, index, suffix);
    }
    return api.finalizeRecording(interviewId, durationSeconds);
  }
};
