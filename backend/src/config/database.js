import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./env.js";

export async function connectDatabase() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required to run the API");
  if (env.MONGODB_DNS_SERVERS.length) dns.setServers(env.MONGODB_DNS_SERVERS);
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB, serverSelectionTimeoutMS: 10000 });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
