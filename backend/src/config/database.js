import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required to run the API");
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB, serverSelectionTimeoutMS: 10000 });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
