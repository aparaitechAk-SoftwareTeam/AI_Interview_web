import { secureStorage } from "./secure-storage";
const KEY = "aparaitech.admin-token";
export const adminSession = { get: () => secureStorage.get(KEY), set: (token) => secureStorage.set(KEY, token), clear: () => secureStorage.remove(KEY) };
