import type { ClientSession } from "mongoose";
import { Audit, User } from "@/lib/models";
import { Notification } from "./models";
import { sendEmail, emailSafe } from "@/lib/notifications";
export async function audit(
  actorId: string,
  action: string,
  entityId: string,
  detail: Record<string, unknown> = {},
  session?: ClientSession,
) {
  await Audit.create(
    [{ actorId, action, entity: "operations", entityId, detail }],
    { session },
  );
}
export async function notify(
  input: {
    key: string;
    event: string;
    reference: string;
    subject: string;
    message: string;
    href: string;
    recipientId?: string;
    email?: string;
  },
  session?: ClientSession,
) {
  if (input.recipientId && !input.email) {
    const recipient = await User.findById(input.recipientId)
      .select("email")
      .session(session ?? null)
      .lean();
    input = { ...input, email: recipient?.email };
  }
  await Notification.updateOne(
    { key: input.key },
    { $setOnInsert: input },
    { upsert: true, session },
  );
}
export async function notifyStaff(
  key: string,
  event: string,
  reference: string,
  message: string,
  href: string,
  session?: ClientSession,
) {
  const recipients = await User.find({
    role: { $in: ["admin", "superadmin", "dispatcher"] },
  })
    .select("email")
    .session(session ?? null)
    .lean();
  for (const recipient of recipients)
    await notify(
      {
        key: `${key}:${recipient._id}`,
        event,
        reference,
        subject: `Waste Well Placed: ${event.replaceAll("_", " ")}`,
        message,
        href,
        recipientId: String(recipient._id),
        email: recipient.email,
      },
      session,
    );
}
export async function deliverNotifications(limit = 30) {
  let delivered = 0;
  for (let index = 0; index < limit; index++) {
    const now = new Date();
    const item = await Notification.findOneAndUpdate(
      {
        email: { $exists: true, $ne: "" },
        attempts: { $lt: 6 },
        $or: [
          {
            status: { $in: ["pending", "failed"] },
            nextAttemptAt: { $lte: now },
          },
          {
            status: "sending",
            lockedAt: { $lt: new Date(Date.now() - 300_000) },
          },
        ],
      },
      { $set: { status: "sending", lockedAt: now }, $inc: { attempts: 1 } },
      { new: true, sort: { createdAt: 1 } },
    );
    if (!item) break;
    const root = process.env.NEXT_PUBLIC_SITE_URL;
    let success = false;
    try {
      success = await sendEmail(
        item.email!,
        item.subject ?? "Waste Well Placed update",
        `<p>${emailSafe(item.message ?? "")}</p>${root && item.href?.startsWith("/") ? `<p><a href="${emailSafe(root + item.href)}">View update</a></p>` : ""}`,
      );
    } catch {
      /* Persist the failed delivery for retry. */
    }
    await Notification.updateOne(
      { _id: item._id, status: "sending", lockedAt: now },
      {
        $set: {
          status: success ? "sent" : "failed",
          ...(success
            ? { sentAt: new Date() }
            : {
                nextAttemptAt: new Date(
                  Date.now() + Math.min(3600_000, 60_000 * 2 ** item.attempts),
                ),
              }),
        },
      },
    );
    if (success) delivered++;
  }
  return delivered;
}
