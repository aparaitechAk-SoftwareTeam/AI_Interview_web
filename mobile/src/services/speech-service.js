import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export const speechRecognition = {
  isAvailable: () => Boolean(ExpoSpeechRecognitionModule.isRecognitionAvailable?.()),
  attach({ onPartial, onFinal, onError, onStart, onEnd }) {
    this.dispose();
    this.listeners = [
      ExpoSpeechRecognitionModule.addListener("start", onStart || (() => {})),
      ExpoSpeechRecognitionModule.addListener("end", onEnd || (() => {})),
      ExpoSpeechRecognitionModule.addListener("result", (event) => { const transcript = event.results?.[0]?.transcript || ""; onPartial?.(transcript); if (event.isFinal) onFinal?.(transcript); }),
      ExpoSpeechRecognitionModule.addListener("error", (event) => onError?.(event.message || event.error || "Speech recognition failed."))
    ];
  },
  async requestPermissions() { const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); if (!result.granted) throw new Error("Speech recognition permission was denied."); return result; },
  async start(locale = "en-IN") { await this.requestPermissions(); ExpoSpeechRecognitionModule.start({ lang: locale, interimResults: true, continuous: false, maxAlternatives: 1 }); },
  stop: async () => ExpoSpeechRecognitionModule.stop(), cancel: async () => ExpoSpeechRecognitionModule.abort(),
  dispose() { this.listeners?.forEach((listener) => listener.remove()); this.listeners = []; }
};
