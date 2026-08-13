import { env } from "../../config/env.js";
import { GridFsStorageProvider } from "./gridfs-storage.js";
import { LocalStorageProvider } from "./local-storage.js";

export const storage = env.STORAGE_PROVIDER === "gridfs" ? new GridFsStorageProvider() : new LocalStorageProvider();
