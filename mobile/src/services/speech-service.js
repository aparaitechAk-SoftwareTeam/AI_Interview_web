import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

const transientCodes = new Set(["aborted", "no-speech", "speech-timeout", "busy"]);

export const speechRecognition = {
  listening: false,
  suppressAbortUntil: 0,
  isAvailable: () => Boolean(ExpoSpeechRecognitionModule.isRecognitionAvailable?.()),
  attach({ onPartial, onFinal, onError, onStart, onEnd }) {
    this.dispose();
    this.listeners = [
      ExpoSpeechRecognitionModule.addListener("start", () => { this.listening = true; onStart?.(); }),
      ExpoSpeechRecognitionModule.addListener("end", () => { this.listening = false; onEnd?.(); }),
      ExpoSpeechRecognitionModule.addListener("result", (event) => { const transcript = event.results?.[0]?.transcript || ""; onPartial?.(transcript); if (event.isFinal) onFinal?.(transcript); }),
      ExpoSpeechRecognitionModule.addListener("error", (event) => {
        const code = event.error || "unknown";
        // The native library emits this event every time the app deliberately
        // aborts recognition while switching questions or submitting text.
        if (code === "aborted" && Date.now() < this.suppressAbortUntil) return;
        this.listening = false;
        onError?.({ code, message: event.message || "Speech recognition failed.", transient: transientCodes.has(code) });
      })
    ];
  },
  async requestPermissions() { const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); if (!result.granted) throw new Error("Speech recognition permission was denied."); return result; },
  async start(locale = "en-IN") {
    if (this.listening) return;
    if (!this.isAvailable()) throw new Error("Voice input is unavailable on this device. You can type your answer instead.");
    await this.requestPermissions();
    ExpoSpeechRecognitionModule.start({ lang: locale, interimResults: true, continuous: true, maxAlternatives: 1, androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 12000 } });
  },
  stop: async () => { this.listening = false; ExpoSpeechRecognitionModule.stop(); },
  cancel: async () => { this.listening = false; this.suppressAbortUntil = Date.now() + 3000; ExpoSpeechRecognitionModule.abort(); },
  dispose() { this.listeners?.forEach((listener) => listener.remove()); this.listeners = []; this.listening = false; }
};
