import fs from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { Readable } from "node:stream";
import mongoose from "mongoose";
import { env } from "../../config/env.js";

function safeKey(key) {
  const normalized = path.posix.normalize(String(key)).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("/../")) throw new Error("Invalid storage key");
  return normalized;
}

function bucket() {
  if (!mongoose.connection.db) throw new Error("MongoDB storage is unavailable before the database connection is ready.");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "privateFiles", chunkSizeBytes: 1024 * 1024 });
}

async function newestFile(key) {
  return bucket().find({ filename: safeKey(key) }).sort({ uploadDate: -1 }).limit(1).next();
}

async function deleteAll(key) {
  const files = await bucket().find({ filename: safeKey(key) }).toArray();
  await Promise.all(files.map((file) => bucket().delete(file._id).catch(() => {})));
}

async function writeReadable(key, readable, metadata = {}) {
  const safe = safeKey(key);
  await deleteAll(safe);
  const output = bucket().openUploadStream(safe, { metadata });
  readable.pipe(output);
  await Promise.race([
    once(output, "finish"),
    once(output, "error").then(([error]) => Promise.reject(error))
  ]);
  return safe;
}

export class GridFsStorageProvider {
  async putBuffer(key, buffer, metadata) { return writeReadable(key, Readable.from(buffer), metadata); }
  async readBuffer(key) {
    const file = await newestFile(key);
    if (!file) throw Object.assign(new Error("Stored file was not found."), { code: "ENOENT" });
    const chunks = [];
    for await (const chunk of bucket().openDownloadStream(file._id)) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  async exists(key) { return Boolean(await newestFile(key)); }
  async existingKeys(keys) {
    const normalized = keys.map(safeKey);
    if (!normalized.length) return new Set();
    const files = await bucket().find({ filename: { $in: normalized } }).project({ filename: 1 }).toArray();
    return new Set(files.map((file) => file.filename));
  }
  async stat(key) {
    const file = await newestFile(key);
    if (!file) throw Object.assign(new Error("Stored file was not found."), { code: "ENOENT" });
    return { size: Number(file.length), contentType: file.metadata?.contentType };
  }
  async createReadStream(key, { start = 0, end } = {}) {
    const file = await newestFile(key);
    if (!file) throw Object.assign(new Error("Stored file was not found."), { code: "ENOENT" });
    return bucket().openDownloadStream(file._id, { start, ...(Number.isInteger(end) ? { end: end + 1 } : {}) });
  }
  async delete(key) { await deleteAll(key); }
  async concatenate(keys, destination, metadata) {
    const safeDestination = safeKey(destination);
    await deleteAll(safeDestination);
    const output = bucket().openUploadStream(safeDestination, { metadata });
    try {
      for (const key of keys) {
        const file = await newestFile(key);
        if (!file) throw Object.assign(new Error(`Stored chunk is unavailable: ${safeKey(key)}`), { code: "ENOENT" });
        const source = bucket().openDownloadStream(file._id);
        for await (const chunk of source) if (!output.write(chunk)) await once(output, "drain");
      }
      output.end();
      await Promise.race([once(output, "finish"), once(output, "error").then(([error]) => Promise.reject(error))]);
      return safeDestination;
    } catch (error) {
      output.destroy(error);
      await deleteAll(safeDestination).catch(() => {});
      throw error;
    }
  }
  async getPath(key) {
    const safe = safeKey(key);
    const target = path.join(env.UPLOAD_DIR, ".gridfs-cache", safe);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await this.readBuffer(safe));
    return target;
  }
}
