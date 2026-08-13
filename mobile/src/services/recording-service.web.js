import { api } from "../api/client";

let activeRecorder = null;
let activeStream = null;
let capturedChunks = [];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function recordingMimeType() {
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((candidate) => globalThis.MediaRecorder?.isTypeSupported?.(candidate)) || "";
}
function releaseStream() { activeStream?.getTracks().forEach((track) => track.stop()); activeStream = null; }

export const recordingService = {
  supportsPersistentRecovery: false,
  async start(_cameraRef, { onStarted } = {}) {
    if (!globalThis.navigator?.mediaDevices?.getUserMedia || typeof globalThis.MediaRecorder !== "function") throw new Error("This browser cannot record video and audio. Use the latest Chrome or Edge.");
    activeStream = await globalThis.navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true } });
    const mimeType = recordingMimeType();
    return new Promise((resolve, reject) => {
      const recorder = new globalThis.MediaRecorder(activeStream, mimeType ? { mimeType, videoBitsPerSecond: 800000, audioBitsPerSecond: 64000 } : undefined);
      activeRecorder = recorder; capturedChunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) capturedChunks.push(event.data); };
      recorder.onerror = () => { releaseStream(); activeRecorder = null; reject(new Error("Browser recording stopped unexpectedly. Check camera and microphone permissions.")); };
      recorder.onstop = () => { const blob = new Blob(capturedChunks, { type: recorder.mimeType || "video/webm" }); releaseStream(); activeRecorder = null; resolve({ blob, mimeType: blob.type || "video/webm" }); };
      recorder.start(1000);
      onStarted?.();
    });
  },
  async stop() { if (activeRecorder && activeRecorder.state !== "inactive") activeRecorder.stop(); else releaseStream(); },
  async uploadInChunks(interviewId, media, durationSeconds, { chunkSize = 2 * 1024 * 1024, onProgress } = {}) {
    const blob = media?.blob || media;
    if (!(blob instanceof Blob) || !blob.size) throw new Error("The browser recording is empty or unavailable.");
    const suffix = blob.type.includes("webm") ? "webm" : "mp4"; const totalChunks = Math.ceil(blob.size / chunkSize);
    for (let pass = 0; pass < 2; pass += 1) {
      const status = await api.recordingStatus(interviewId).catch(() => ({ recording: { receivedIndexes: [] } }));
      if (status.recording?.status === "READY") return status;
      const received = new Set(status.recording?.receivedIndexes || []); let uploaded = received.size;
      onProgress?.({ uploaded, total: totalChunks, percent: Math.round((uploaded / totalChunks) * 100) });
      for (let index = 0, offset = 0; index < totalChunks; index += 1, offset += chunkSize) {
        if (received.has(index)) continue;
        const chunk = blob.slice(offset, Math.min(offset + chunkSize, blob.size), blob.type); let lastError;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try { await api.uploadRecordingChunk(interviewId, chunk, index, { suffix, totalChunks, totalBytes: blob.size }); lastError = null; break; }
          catch (error) { lastError = error; await wait(Math.min(8000, 750 * 2 ** attempt)); }
        }
        if (lastError) throw lastError;
        received.add(index); uploaded += 1; onProgress?.({ uploaded, total: totalChunks, percent: Math.round((uploaded / totalChunks) * 100) });
      }
      try { return await api.finalizeRecording(interviewId, durationSeconds); }
      catch (error) { if (error.code !== "RECORDING_CHUNKS_MISSING" || pass === 1) throw error; }
    }
  }
};
