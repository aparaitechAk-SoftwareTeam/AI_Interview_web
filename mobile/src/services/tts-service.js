import * as Speech from "expo-speech";

export const tts = {
  stop: () => Speech.stop(),
  speak: (text, language = "en-IN") => new Promise((resolve, reject) => Speech.speak(text, { language, rate: 0.9, onDone: resolve, onStopped: resolve, onError: reject }))
};
