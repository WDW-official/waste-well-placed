import { Booking, Payment } from "./models";
import { RefundRequest } from "./workflow-models";
import { Payout } from "./operations/models";
import { connectDB } from "./db";
import { stripeClient } from "./stripe";
import { audit, notify } from "./operations/events";

export async function reconcileRefund(
  bookingId: string,
  amountMinor: number,
  full: boolean,
  providerIds: string[] = [],
) {
  const db = await connectDB();
  await db.connection.transaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) return;
    const amount = Math.max(booking.refundsMinor ?? 0, amountMinor);
    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          refundsMinor: amount,
          ...(full ? { paymentStatus: "refunded" } : {}),
        },
        $inc: { version: 1 },
      },
      { session },
    );
    if (providerIds.length)
      await RefundRequest.updateMany(
        {
          bookingId,
          providerRef: { $in: providerIds },
          status: { $in: ["submitted", "sending"] },
        },
        { $set: { status: "confirmed" } },
        { session },
      );
    await Payout.updateMany(
      { bookingId, status: { $ne: "paid" } },
      {
        $set: {
          status: "held",
          holdReason: "Customer refund requires financial review",
        },
      },
      { session },
    );
  });
}
export async function processRefunds(limit = 5) {
  if (!process.env.STRIPE_SECRET_KEY) return 0;
  let processed = 0;
  const stripe = stripeClient();
  const db = await connectDB();
  await RefundRequest.updateMany(
    {
      attempts: { $gte: 6 },
      status: { $in: ["queued", "sending", "submitted"] },
    },
    {
      $set: {
        status: "review",
        failure:
          "Provider processing needs manual reconciliation before any further refund.",
      },
    },
  );
  for (let index = 0; index < limit; index++) {
    const now = new Date();
    const item = await RefundRequest.findOneAndUpdate(
      {
        attempts: { $lt: 6 },
        nextAttemptAt: { $lte: now },
        $or: [
          { status: { $in: ["queued", "submitted"] } },
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
    try {
      const payment = await Payment.findOne({
        bookingId: item.bookingId,
        status: "paid",
      });
      if (!payment?.providerIntentId)
        throw new Error("Verified payment reference is not available");
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.providerIntentId,
          amount: item.amountMinor,
          metadata: { refundRequestId: String(item._id) },
        },
        { idempotencyKey: `wwp_refund_${item._id}` },
      );
      await RefundRequest.updateOne(
        { _id: item._id, status: "sending", lockedAt: now },
        {
          $set: {
            status: "submitted",
            providerRef: refund.id,
            nextAttemptAt: new Date(Date.now() + 60_000),
          },
        },
      );
      const chargeId =
        typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId);
        const ids =
          charge.refunds?.data
            .filter((row) => row.status === "succeeded")
            .map((row) => row.id) ?? [];
        await reconcileRefund(
          String(item.bookingId),
          charge.amount_refunded,
          charge.refunded,
          ids,
        );
      }
      await db.connection.transaction(async (session) => {
        await audit(
          String(item.requestedBy),
          "booking.refund_submitted",
          String(item.bookingId),
          { refundRequestId: String(item._id), amountMinor: item.amountMinor },
          session,
        );
        const booking = await Booking.findById(item.bookingId).session(session);
        if (booking)
          await notify(
            {
              key: `refund:${item._id}:submitted`,
              event: "refund_submitted",
              reference: booking.reference ?? String(item.bookingId),
              recipientId: String(booking.userId),
              subject: "Your refund has been submitted",
              message:
                "Our payment provider has received the approved refund. Your bank determines when it appears in your account.",
              href: `/account/bookings/${item.bookingId}`,
            },
            session,
          );
      });
      processed++;
    } catch (error) {
      const terminal =
        error &&
        typeof error === "object" &&
        "type" in error &&
        error.type === "StripeInvalidRequestError";
      await RefundRequest.updateOne(
        { _id: item._id },
        {
          $set: {
            status: terminal
              ? "failed"
              : item.attempts >= 6
                ? "review"
                : "queued",
            failure: terminal
              ? "The provider rejected this refund. Finance must review it."
              : "Provider processing is unavailable; a retry is scheduled.",
            nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** item.attempts),
          },
        },
      );
    }
  }
  return processed;
}
