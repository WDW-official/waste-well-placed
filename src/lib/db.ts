import mongoose from "mongoose";
import { mongodbLookup } from "./mongodb-lookup";
const g = globalThis as typeof globalThis & {
  __mongoose?: Promise<typeof mongoose>;
};
export async function connectDB() {
  if (!process.env.MONGODB_URI)
    throw new Error("MONGODB_URI is not configured");
  g.__mongoose ??= mongoose
    .connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      lookup: mongodbLookup,
    })
    .catch((error) => {
      // Serverless instances can survive a failed connection attempt.
      // Let the next request retry instead of retaining a rejected promise.
      g.__mongoose = undefined;
      throw error;
    });
  return g.__mongoose;
}
