import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "../src/lib/db";
import { User } from "../src/lib/models";

config({ path: ".env.local" });
config();

async function main() {
  const email = z.string().trim().email().parse(process.env.SEED_ADMIN_EMAIL);
  const name = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .parse(process.env.SEED_ADMIN_NAME ?? "Operations administrator");
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = z
    .string()
    .min(12)
    .max(120)
    .parse(process.env.SEED_ADMIN_PASSWORD ?? randomBytes(24).toString("base64url"));

  // Creating an account must not seed sample services or alter database indexes.
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await connectDB();
  if (await User.exists({ email: email.toLowerCase() })) {
    throw new Error("ACCOUNT_EXISTS");
  }
  await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
  });
  console.log(`Admin account created: ${email.toLowerCase()}`);
  if (generated) console.log(`Generated password: ${password}`);
  console.log("Sign in at /login to access /admin.");
}

main()
  .catch((error: unknown) => {
    if (error instanceof z.ZodError) {
      console.error(
        "Provide a valid SEED_ADMIN_EMAIL and optional SEED_ADMIN_NAME. If supplied, SEED_ADMIN_PASSWORD must contain 12–120 characters.",
      );
    } else if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      console.error("An account already uses that email. No changes were made.");
    } else {
      console.error("Admin setup failed. Check the database connection and try again.");
    }
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
