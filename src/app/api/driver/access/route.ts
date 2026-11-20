import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { DriverApplication } from "@/lib/operations/models";
import { hashToken, requireCondition } from "@/lib/operations/security";
import { rateLimit } from "@/lib/operations/rate-limit";
import { audit } from "@/lib/operations/events";
import { createSession } from "@/lib/auth";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = z
      .discriminatedUnion("purpose", [
        z.object({
          purpose: z.literal("application"),
          token: z.string().regex(/^[a-f\d]{64}$/i),
        }),
        z.object({
          purpose: z.literal("password_setup"),
          token: z.string().regex(/^[a-f\d]{64}$/i),
          password: z.string().min(12).max(120),
        }),
      ])
      .parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "driver-access", 15);
    const passwordHash =
      data.purpose === "password_setup"
        ? await bcrypt.hash(data.password, 12)
        : undefined;
    const user = await db.connection.transaction(async (session) => {
      const filter = {
        role: "driver",
        driverPasswordPending: true,
        driverAccessTokenHash: hashToken(data.token),
        driverAccessPurpose: data.purpose,
        driverAccessExpiresAt: { $gt: new Date() },
      };
      const account = await User.findOne(filter).session(session);
      requireCondition(
        account,
        "This link has expired or was already used. Request a new link.",
        422,
      );
      // Lock the application as well so activation cannot race a staff suspension.
      const application = await DriverApplication.findOneAndUpdate(
        {
          userId: account._id,
          ...(data.purpose === "password_setup"
            ? { status: "active" }
            : { status: { $ne: "active" } }),
        },
        { $inc: { version: 1 } },
        { session, new: true },
      );
      requireCondition(
        application,
        "This access link is no longer available. Request a new link.",
        422,
      );
      const updated = await User.updateOne(
        { _id: account._id, ...filter },
        {
          ...(passwordHash
            ? { $set: { passwordHash, driverPasswordPending: false } }
            : {}),
          $unset: {
            driverAccessTokenHash: 1,
            driverAccessExpiresAt: 1,
            driverAccessPurpose: 1,
          },
        },
        { session },
      );
      requireCondition(
        updated.modifiedCount,
        "This link has already been used",
        409,
      );
      await audit(
        String(account._id),
        passwordHash ? "driver.password_set" : "driver.application_accessed",
        String(account._id),
        {},
        session,
      );
      return account;
    });
    await createSession({
      id: String(user._id),
      role: "driver",
      applicationOnly: data.purpose === "application",
    });
    return ok({
      href: data.purpose === "password_setup" ? "/driver" : "/driver/apply",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
