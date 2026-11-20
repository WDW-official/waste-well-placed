import type { ClientSession } from "mongoose";
import { User } from "@/lib/models";
import { notify } from "./events";
import { hashToken, newToken, requireCondition } from "./security";

export async function queueDriverAccess(
  userId: string,
  email: string,
  purpose: "application" | "password_setup",
  session: ClientSession,
) {
  const token = newToken();
  const changed = await User.updateOne(
    { _id: userId, role: "driver", driverPasswordPending: true },
    {
      $set: {
        driverAccessTokenHash: hashToken(token),
        driverAccessExpiresAt: new Date(Date.now() + 48 * 3600_000),
        driverAccessPurpose: purpose,
      },
    },
    { session },
  );
  requireCondition(
    changed.matchedCount,
    "Application access is unavailable",
    409,
  );
  await notify(
    {
      key: `driver-access:${hashToken(token)}`,
      event:
        purpose === "password_setup"
          ? "driver_password_setup"
          : "driver_application_access",
      reference: userId,
      recipientId: userId,
      email,
      subject:
        purpose === "password_setup"
          ? "Your driver application is approved — set your password"
          : "Continue your driver application",
      message:
        purpose === "password_setup"
          ? "Your driver application has been approved. Use the secure link to choose your password. The link expires in 48 hours and can be used once."
          : "Use the secure link to return to your driver application without a password. The link expires in 48 hours and can be used once.",
      href: `/driver/access?token=${token}&purpose=${purpose}`,
    },
    session,
  );
}
