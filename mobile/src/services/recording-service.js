import { api } from "../api/client";
import { File, Paths } from "expo-file-system";

export const recordingService = {
  supportsPersistentRecovery: true,
  async start(cameraRef) { if (!cameraRef.current) return null; return cameraRef.current.recordAsync({ maxDuration: 3600 }); },
  async stop(cameraRef) { cameraRef.current?.stopRecording(); },
  async preserve(media, interviewId) {
    const uri = typeof media === "string" ? media : media?.uri;
    if (!uri) return media;
    const source = new File(uri);
    if (!source.exists) throw new Error("The local interview recording is unavailable. Your submitted answers are still safe.");
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
  async uploadInChunks(interviewId, media, durationSeconds, chunkSize = 4 * 1024 * 1024) {
    const uri = typeof media === "string" ? media : media?.uri;
    if (!uri) return { skipped: true };
    const source = new File(uri);
    if (!source.exists || source.size <= 0) throw new Error("The interview recording is empty or unavailable.");
    for (let offset = 0, index = 0; offset < source.size; offset += chunkSize, index += 1) {
      const chunkFile = new File(Paths.cache, `aparaitech-${interviewId}-${index}.mp4`);
      const bytes = new Uint8Array(await source.slice(offset, Math.min(offset + chunkSize, source.size)).arrayBuffer());
      chunkFile.create({ overwrite: true }); chunkFile.write(bytes);
      try {
        let lastError;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try { await api.uploadRecordingChunk(interviewId, { uri: chunkFile.uri }, index); lastError = null; break; }
          catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1))); }
        }
        if (lastError) throw lastError;
      } finally { if (chunkFile.exists) chunkFile.delete(); }
    }
    return api.finalizeRecording(interviewId, durationSeconds);
  }
};
