const browserSpeech = () => globalThis.speechSynthesis;

export const tts = {
  stop: () => {
    browserSpeech()?.cancel();
  },
  speak: (text, language = "en-IN") => new Promise((resolve, reject) => {
    if (!browserSpeech() || typeof globalThis.SpeechSynthesisUtterance !== "function") {
      reject(new Error("AI voice is not available in this browser. Use the latest Chrome or Edge and make sure the tab is not muted."));
      return;
    }
    browserSpeech().cancel();
    const utterance = new globalThis.SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (["canceled", "interrupted"].includes(event.error)) resolve();
      else reject(new Error("The browser could not play the AI voice. Check the tab audio setting and try again."));
    };
    browserSpeech().speak(utterance);
  })
};
