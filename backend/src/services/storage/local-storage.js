import fsSync from "node:fs";
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
    // A client can retry after the server has accepted a chunk but before it
    // receives the response. Rewriting this private, deterministic chunk key
    // makes that retry safe instead of failing with EEXIST.
    await fs.writeFile(target, buffer);
    return safe;
  }
  async getPath(key) { return path.join(env.UPLOAD_DIR, safeKey(key)); }
  async readBuffer(key) { return fs.readFile(await this.getPath(key)); }
  async exists(key) { return fsSync.existsSync(await this.getPath(key)); }
  async existingKeys(keys) {
    const checks = await Promise.all(keys.map(async (key) => ({ key, exists: await this.exists(key) })));
    return new Set(checks.filter((entry) => entry.exists).map((entry) => entry.key));
  }
  async stat(key) { return fs.stat(await this.getPath(key)); }
  async createReadStream(key, options) { return fsSync.createReadStream(await this.getPath(key), options); }
  async delete(key) { await fs.rm(await this.getPath(key), { force: true }); }
  async concatenate(keys, destination) {
    const safe = safeKey(destination); const target = path.join(env.UPLOAD_DIR, safe);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${Date.now()}.uploading`;
    const output = fsSync.createWriteStream(temporary, { flags: "w" });
    try {
      for (const key of keys) {
        const source = fsSync.createReadStream(await this.getPath(key));
        await new Promise((resolve, reject) => {
          const cleanup = () => { source.removeListener("error", fail); source.removeListener("end", complete); output.removeListener("error", fail); };
          const fail = (error) => { cleanup(); source.destroy(); reject(error); };
          const complete = () => { cleanup(); resolve(); };
          source.once("error", fail); output.once("error", fail);
          source.once("end", complete); source.pipe(output, { end: false });
        });
      }
      await new Promise((resolve, reject) => { output.once("error", reject); output.end(resolve); });
      await fs.rm(target, { force: true });
      await fs.rename(temporary, target);
      return safe;
    } catch (error) {
      output.destroy(); await fs.rm(temporary, { force: true }).catch(() => {}); throw error;
    }
  }
}
