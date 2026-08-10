import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

function safeKey(key) {
  const normalized = path.posix.normalize(String(key)).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("/../")) throw new Error("Invalid storage key");
  return normalized;
}

export class LocalStorageProvider {
  async putBuffer(key, buffer) {
    const safe = safeKey(key); const target = path.join(env.UPLOAD_DIR, safe);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: "wx" });
    return safe;
  }
  async getPath(key) { return path.join(env.UPLOAD_DIR, safeKey(key)); }
  async readBuffer(key) { return fs.readFile(await this.getPath(key)); }
  async delete(key) { await fs.rm(await this.getPath(key), { force: true }); }
  async concatenate(keys, destination) {
    const buffers = await Promise.all(keys.map((key) => this.readBuffer(key)));
    return this.putBuffer(destination, Buffer.concat(buffers));
  }
}

export const storage = new LocalStorageProvider();
