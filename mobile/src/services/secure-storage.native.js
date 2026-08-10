import * as SecureStore from "expo-secure-store";

// Android and iOS use the OS-backed encrypted store for every token and
// recovery record. The web implementation lives in secure-storage.web.js.
export const secureStorage = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key)
};
