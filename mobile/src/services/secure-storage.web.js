// expo-secure-store intentionally has no web implementation. Keep web-preview
// sessions inside this browser tab only, rather than persisting credentials in
// localStorage. Native Android/iOS builds use encrypted SecureStore instead.
const memoryFallback = new Map();

function browserSession() {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export const secureStorage = {
  async get(key) {
    const storage = browserSession();
    if (!storage) return memoryFallback.get(key) ?? null;
    try {
      return storage.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },
  async set(key, value) {
    const storage = browserSession();
    if (!storage) {
      memoryFallback.set(key, value);
      return;
    }
    try {
      storage.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },
  async remove(key) {
    memoryFallback.delete(key);
    const storage = browserSession();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      // The in-memory fallback has already been cleared.
    }
  }
};
