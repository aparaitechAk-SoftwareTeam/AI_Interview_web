import { setAudioModeAsync } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { api } from "../api/client";

const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;
const MAX_ATTEMPTS = 5;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function uploadMissingChunks({ interviewId, source, chunkSize, received, onProgress }) {
  const totalChunks = Math.ceil(source.size / chunkSize);
  let uploaded = received.size;
  onProgress?.({ uploaded, total: totalChunks, percent: Math.round((uploaded / totalChunks) * 100) });
  const handle = source.open();
  try {
    for (let index = 0, offset = 0; index < totalChunks; index += 1, offset += chunkSize) {
      if (received.has(index)) continue;
      const chunkFile = new File(Paths.cache, `aparaitech-${interviewId}-${index}.mp4`);
      // Do not use File.slice()/Blob here. Several Android/Hermes builds reject
      // Blobs created from ArrayBufferView before the request reaches the API.
      // FileHandle reads and File.upload stay entirely on Expo's native path.
      handle.offset = offset;
      const bytes = handle.readBytes(Math.min(chunkSize, source.size - offset));
      chunkFile.create({ overwrite: true });
      chunkFile.write(bytes);
      try {
        let lastError;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          try {
            await api.uploadRecordingChunk(interviewId, chunkFile, index, { totalChunks, totalBytes: source.size });
            lastError = null; break;
          } catch (error) { lastError = error; await wait(Math.min(8000, 750 * 2 ** attempt)); }
        }
        if (lastError) throw lastError;
        received.add(index); uploaded += 1;
        onProgress?.({ uploaded, total: totalChunks, percent: Math.round((uploaded / totalChunks) * 100) });
      } finally { if (chunkFile.exists) chunkFile.delete(); }
    }
  } finally {
    handle.close();
  }
}

export const recordingService = {
  supportsPersistentRecovery: true,
  async start(cameraRef, { onStarted } = {}) {
    if (!cameraRef.current) throw new Error("The interview camera is not ready yet.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: "doNotMix", shouldPlayInBackground: false });
    const recording = cameraRef.current.recordAsync({ maxDuration: 2 * 60 * 60 });
    onStarted?.();
    return recording;
  },
  async stop(cameraRef) { await cameraRef.current?.stopRecording(); },
  async preserve(media, interviewId) {
    const uri = typeof media === "string" ? media : media?.uri;
    if (!uri) return media;
    const source = new File(uri);
    if (!source.exists) throw new Error("The local interview recording is unavailable. Keep the app open and retry.");
    const target = new File(Paths.document, `aparaitech-interview-${interviewId}.mp4`);
    if (source.uri !== target.uri) await source.copy(target, { overwrite: true });
    return { ...(typeof media === "object" ? media : {}), uri: target.uri };
  },
  async removePersisted(media) {
    const uri = typeof media === "string" ? media : media?.uri;
    if (!uri) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  },
  async uploadInChunks(interviewId, media, durationSeconds, { chunkSize = DEFAULT_CHUNK_SIZE, onProgress } = {}) {
    const uri = typeof media === "string" ? media : media?.uri;
    if (!uri) throw new Error("No protected interview recording is available to upload.");
    const source = new File(uri);
    if (!source.exists || source.size <= 0) throw new Error("The interview recording is empty or unavailable.");
    for (let recoveryPass = 0; recoveryPass < 2; recoveryPass += 1) {
      const status = await api.recordingStatus(interviewId).catch(() => ({ recording: { receivedIndexes: [] } }));
      if (status.recording?.status === "READY") return status;
      const received = new Set(status.recording?.receivedIndexes || []);
      await uploadMissingChunks({ interviewId, source, chunkSize, received, onProgress });
      try { return await api.finalizeRecording(interviewId, durationSeconds); }
      catch (error) { if (error.code !== "RECORDING_CHUNKS_MISSING" || recoveryPass === 1) throw error; }
    }
    throw new Error("The recording upload could not be finalized.");
  }
};
