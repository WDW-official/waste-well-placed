import { z } from "zod";
import bcrypt from "bcryptjs";
import { User } from "@/lib/models";
import { connectDB } from "@/lib/db";
import { rateLimit } from "@/lib/operations/rate-limit";
import { hashToken, requireCondition } from "@/lib/operations/security";
import { audit } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const { token, password } = z
      .object({
        token: z.string().regex(/^[a-f\d]{64}$/i),
        password: z.string().min(12).max(120),
      })
      .parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "password-reset-consume", 15);
    const passwordHash = await bcrypt.hash(password, 12);
    await db.connection.transaction(async (session) => {
      const user = await User.findOneAndUpdate(
        {
          resetTokenHash: hashToken(token),
          resetTokenExpiresAt: { $gt: new Date() },
          driverPasswordPending: { $ne: true },
        },
        {
          $set: { passwordHash },
          $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
          $inc: { sessionVersion: 1 },
        },
        { session, new: true },
      );
      requireCondition(
        user,
        "This link has expired or was already used. Request a new reset link.",
        422,
      );
      await audit(
        String(user._id),
        "account.password_reset",
        String(user._id),
        {},
        session,
      );
    });
    return ok({ reset: true });
  } catch (error) {
    return errorResponse(error);
  }
}
