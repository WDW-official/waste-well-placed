import mongoose from "mongoose";
const g = globalThis as typeof globalThis & {
  __mongoose?: Promise<typeof mongoose>;
};
export async function connectDB() {
  if (!process.env.MONGODB_URI)
    throw new Error("MONGODB_URI is not configured");
  g.__mongoose ??= mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
  });
  return g.__mongoose;
}
