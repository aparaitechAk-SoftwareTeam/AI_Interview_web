import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { Platform } from "react-native";

const transientCodes = new Set([
  "aborted",
  "audio-capture",
  "busy",
  "network",
  "network-timeout",
  "no-speech",
  "speech-timeout"
]);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const speechRecognition = {
  listening: false,
  desiredListening: false,
  starting: false,
  locale: "en-IN",
  permissionGranted: false,
  retryCount: 0,
  suppressAbortUntil: 0,

  isAvailable: () => Boolean(ExpoSpeechRecognitionModule.isRecognitionAvailable?.()),

  attach({ onPartial, onFinal, onError, onStart, onEnd, onRecovering }) {
    this.dispose();
    this.callbacks = { onPartial, onFinal, onError, onStart, onEnd, onRecovering };
    this.listeners = [
      ExpoSpeechRecognitionModule.addListener("start", () => {
        this.listening = true;
        this.starting = false;
        this.retryCount = 0;
        this.clearWatchdog();
        this.callbacks?.onStart?.();
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => {
        this.listening = false;
        this.starting = false;
        this.clearWatchdog();
        this.callbacks?.onEnd?.({ recovering: this.desiredListening });
        if (this.desiredListening) this.scheduleRestart();
      }),
      ExpoSpeechRecognitionModule.addListener("result", (event) => {
        const transcript = event.results?.[0]?.transcript || "";
        if (transcript) this.callbacks?.onPartial?.(transcript);
        if (event.isFinal && transcript.trim()) this.callbacks?.onFinal?.(transcript);
      }),
      ExpoSpeechRecognitionModule.addListener("error", (event) => {
        const code = event.error || "unknown";
        const deliberatelyAborted = code === "aborted" && Date.now() < this.suppressAbortUntil;
        this.listening = false;
        this.starting = false;
        this.clearWatchdog();
        if (deliberatelyAborted) return;
        const transient = transientCodes.has(code);
        const recovering = transient && this.desiredListening;
        this.callbacks?.onError?.({
          code,
          message: event.message || "Speech recognition was interrupted.",
          transient,
          recovering
        });
        if (recovering) this.scheduleRestart();
        else if (!transient) this.desiredListening = false;
      })
    ];
  },

  async requestPermissions() {
    if (this.permissionGranted) return { granted: true };
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) throw new Error("Microphone and speech recognition permission is required for voice answers.");
    this.permissionGranted = true;
    return result;
  },

  clearRestart() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  },

  clearWatchdog() {
    if (this.startWatchdog) clearTimeout(this.startWatchdog);
    this.startWatchdog = null;
  },

  scheduleRestart(delay) {
    if (!this.desiredListening || this.restartTimer) return;
    this.retryCount += 1;
    const retryDelay = delay ?? Math.min(5000, 450 * 2 ** Math.min(this.retryCount - 1, 4));
    this.callbacks?.onRecovering?.({ attempt: this.retryCount, delayMs: retryDelay });
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start(this.locale, { recovering: true }).catch((error) => {
        this.callbacks?.onError?.({ code: "restart-failed", message: error.message, transient: true, recovering: true });
        this.scheduleRestart();
      });
    }, retryDelay);
  },

  async start(locale = "en-IN", { recovering = false } = {}) {
    this.desiredListening = true;
    this.locale = locale;
    if (this.listening || this.starting) return;
    this.clearRestart();
    if (!this.isAvailable()) {
      this.desiredListening = false;
      throw new Error("Voice input is unavailable on this device. You can type your answer instead.");
    }
    await this.requestPermissions();
    this.starting = true;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        // The native package documents continuous recognition as Android 13+.
        // Older Android releases still work reliably in single-utterance mode.
        continuous: Platform.OS !== "android" || Number(Platform.Version) >= 33,
        maxAlternatives: 1,
        addsPunctuation: true,
        androidIntentOptions: {
          EXTRA_MASK_OFFENSIVE_WORDS: false,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 12000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 5000,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 1500
        },
        iosTaskHint: "dictation",
        iosCategory: {
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
          mode: "measurement"
        },
        iosVoiceProcessingEnabled: true
      });
      this.startWatchdog = setTimeout(() => {
        if (!this.listening && this.desiredListening) {
          this.starting = false;
          this.scheduleRestart(500);
        }
      }, recovering ? 3000 : 4500);
    } catch (error) {
      this.starting = false;
      if (this.desiredListening && recovering) this.scheduleRestart();
      else throw error;
    }
  },

  async stop() {
    this.desiredListening = false;
    this.clearRestart();
    this.clearWatchdog();
    if (this.listening || this.starting) ExpoSpeechRecognitionModule.stop();
    this.listening = false;
    this.starting = false;
    await wait(250);
  },

  hold() {
    this.desiredListening = false;
    this.clearRestart();
    this.clearWatchdog();
  },

  async cancel() {
    this.desiredListening = false;
    this.clearRestart();
    this.clearWatchdog();
    this.suppressAbortUntil = Date.now() + 3000;
    if (this.listening || this.starting) ExpoSpeechRecognitionModule.abort();
    this.listening = false;
    this.starting = false;
    // Android releases SpeechRecognizer asynchronously. Waiting prevents the
    // next question from failing with ERROR_RECOGNIZER_BUSY.
    await wait(350);
  },

  async restart(locale = this.locale) {
    await this.cancel();
    this.desiredListening = true;
    return this.start(locale);
  },

  dispose() {
    this.desiredListening = false;
    this.clearRestart();
    this.clearWatchdog();
    if (this.listening || this.starting) {
      this.suppressAbortUntil = Date.now() + 3000;
      ExpoSpeechRecognitionModule.abort();
    }
    this.listeners?.forEach((listener) => listener.remove());
    this.listeners = [];
    this.callbacks = null;
    this.listening = false;
    this.starting = false;
  }
};
