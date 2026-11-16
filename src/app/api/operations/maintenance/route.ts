import { connectDB } from "@/lib/db";
import { Assignment, DriverApplication } from "@/lib/operations/models";
import { hashToken, requireCondition } from "@/lib/operations/security";
import { releaseOffer } from "@/lib/operations/dispatch";
import { deliverNotifications, notify } from "@/lib/operations/events";
import { errorResponse, ok } from "@/lib/http";
export async function POST(req: Request) {
  try {
    requireCondition(
      process.env.CRON_SECRET &&
        req.headers.get("authorization") &&
        hashToken(req.headers.get("authorization")!) ===
          hashToken(`Bearer ${process.env.CRON_SECRET}`),
      "Not permitted",
      403,
    );
    await connectDB();
    const expired = await Assignment.find({
      status: "offered",
      live: true,
      expiresAt: { $lte: new Date() },
    })
      .limit(50)
      .lean();
    for (const assignment of expired)
      await releaseOffer(
        String(assignment._id),
        "timed_out",
        "scheduler",
        "Driver did not respond before the offer expired",
      );
    const drivers = await DriverApplication.find({ status: "active" }).limit(
      500,
    );
    for (const driver of drivers) {
      for (const field of [
        "licenceExpiresAt",
        "insuranceExpiresAt",
        "carrierExpiresAt",
        "motExpiresAt",
      ] as const) {
        const expiry = driver[field];
        if (expiry && expiry.getTime() < Date.now() + 30 * 86400_000) {
          await notify({
            key: `expiry:${driver._id}:${field}:${expiry.toISOString().slice(0, 10)}`,
            event: "document_expiry",
            reference: String(driver._id),
            recipientId: String(driver.userId),
            subject: "Driver document needs review",
            message: `Your ${field.replace("ExpiresAt", "")} document expires on ${expiry.toLocaleDateString("en-GB")}. Contact operations to update it.`,
            href: "/driver",
          });
          if (expiry.getTime() <= Date.now())
            await DriverApplication.updateOne(
              { _id: driver._id },
              { $set: { status: "expired", online: false } },
            );
        }
      }
    }
    await DriverApplication.updateMany(
      { online: true, availableUntilAt: { $lte: new Date() } },
      { $set: { online: false } },
    );
    return ok({
      expiredOffers: expired.length,
      delivered: await deliverNotifications(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
