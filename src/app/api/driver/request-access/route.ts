import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { DriverApplication } from "@/lib/operations/models";
import { queueDriverAccess } from "@/lib/operations/driver-access";
import { hashToken } from "@/lib/operations/security";
import { rateLimit } from "@/lib/operations/rate-limit";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const { email } = z
      .object({ email: z.string().trim().email().max(254).toLowerCase() })
      .parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "driver-request-access", 10);
    await rateLimit(req, `driver-request-access:${hashToken(email)}`, 3);
    await db.connection.transaction(async (session) => {
      const account = await User.findOne({
        email,
        role: "driver",
        driverPasswordPending: true,
      }).session(session);
      if (!account) return;
      const application = await DriverApplication.findOne({
        userId: account._id,
      }).session(session);
      if (!application) return;
      await queueDriverAccess(
        String(account._id),
        account.email,
        application.status === "active" ? "password_setup" : "application",
        session,
      );
    });
    return ok({
      message:
        "If an application is waiting for access, a secure link will be emailed to you.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
