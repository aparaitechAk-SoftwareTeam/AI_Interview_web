import { api } from "../api/client";
import { File, Paths } from "expo-file-system";

export const recordingService = {
  async start(cameraRef) { if (!cameraRef.current) return null; return cameraRef.current.recordAsync({ maxDuration: 3600 }); },
  async stop(cameraRef) { cameraRef.current?.stopRecording(); },
  async uploadInChunks(interviewId, media, durationSeconds, chunkSize = 4 * 1024 * 1024) {
    const uri = typeof media === "string" ? media : media?.uri;
    if (!uri) return { skipped: true };
    const bytes = await new File(uri).bytes();
    for (let offset = 0, index = 0; offset < bytes.length; offset += chunkSize, index += 1) {
      const chunkFile = new File(Paths.cache, `aparaitech-${interviewId}-${index}.mp4`);
      chunkFile.create({ overwrite: true }); chunkFile.write(bytes.slice(offset, Math.min(offset + chunkSize, bytes.length)));
      try { await api.uploadRecordingChunk(interviewId, { uri: chunkFile.uri, type: "video/mp4" }, index); } finally { chunkFile.delete(); }
    }
    return api.finalizeRecording(interviewId, durationSeconds);
  }
};
