import { z } from "zod";
import { User } from "@/lib/models";
import { DriverApplication } from "@/lib/operations/models";
import { connectDB } from "@/lib/db";
import { rateLimit } from "@/lib/operations/rate-limit";
import { hashToken, newToken } from "@/lib/operations/security";
import { queueDriverAccess } from "@/lib/operations/driver-access";
import { notify } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const { email } = z
      .object({ email: z.string().trim().email().max(254).toLowerCase() })
      .parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "password-reset", 10);
    await rateLimit(req, `password-reset:${hashToken(email)}`, 3);
    await db.connection.transaction(async (session) => {
      const user = await User.findOne({ email }).session(session);
      if (!user) return;
      if (user.driverPasswordPending) {
        const app = await DriverApplication.findOne({
          userId: user._id,
        }).session(session);
        if (app)
          await queueDriverAccess(
            String(user._id),
            email,
            app.status === "active" ? "password_setup" : "application",
            session,
          );
        return;
      }
      const token = newToken();
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            resetTokenHash: hashToken(token),
            resetTokenExpiresAt: new Date(Date.now() + 3600_000),
          },
        },
        { session },
      );
      await notify(
        {
          key: `password-reset:${hashToken(token)}`,
          event: "password_reset",
          reference: String(user._id),
          recipientId: String(user._id),
          email,
          subject: "Reset your Waste Well Placed password",
          message:
            "Use the secure link to choose a new password. It expires in one hour and works once. If you did not request this, you can ignore this email.",
          href: `/reset-password?token=${token}`,
        },
        session,
      );
    });
    return ok({
      message:
        "If this email is registered, a secure access or password-reset link will be emailed to you.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
