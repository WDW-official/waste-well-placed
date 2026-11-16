import { stripeClient } from "@/lib/stripe";
import { connectDB } from "@/lib/db";
import { Payment, Booking } from "@/lib/models";
import { Payout, ProviderEvent } from "@/lib/operations/models";
import { audit, notify, notifyStaff } from "@/lib/operations/events";
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return new Response("Webhook not configured", { status: 400 });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const db = await connectDB();
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const checkout = event.data.object;
      if (!checkout.metadata?.bookingId || checkout.payment_status !== "paid")
        return new Response("OK");
      const bookingId = checkout.metadata.bookingId;
      await db.connection.transaction(async (session) => {
        const payment = await Payment.findOne({
          providerRef: checkout.id,
          bookingId,
        }).session(session);
        if (
          !payment ||
          payment.amountMinor !== checkout.amount_total ||
          checkout.currency !== "gbp"
        )
          throw Error("Payment mismatch");
        const changed = await Booking.findOneAndUpdate(
          {
            _id: bookingId,
            paymentStatus: "pending",
            status: "pending_payment",
            "price.totalMinor": checkout.amount_total,
          },
          {
            $set: {
              paymentStatus: "paid",
              paidMinor: checkout.amount_total,
              status: "confirmed",
            },
            $inc: { version: 1 },
            $push: {
              events: {
                status: "confirmed",
                at: new Date(),
                note: "Stripe payment verified",
              },
            },
          },
          { new: true, session },
        );
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: "paid",
              verifiedAt: new Date(),
              rawEventId: event.id,
              providerIntentId:
                typeof checkout.payment_intent === "string"
                  ? checkout.payment_intent
                  : checkout.payment_intent?.id,
            },
          },
          { session },
        );
        if (!changed) return;
        await audit(
          "stripe",
          "payment.verified",
          bookingId,
          { eventId: event.id },
          session,
        );
        await notify(
          {
            key: `booking:${bookingId}:paid`,
            event: "booking_confirmed",
            reference: changed.reference ?? bookingId,
            recipientId: String(changed.userId),
            subject: "Your collection is confirmed",
            message: `Your payment for ${changed.reference} has been verified. Your collection is in the dispatch queue.`,
            href: `/account/bookings/${bookingId}`,
          },
          session,
        );
        await notifyStaff(
          `booking:${bookingId}:paid`,
          "paid_unassigned",
          changed.reference ?? bookingId,
          "Paid collection is ready for load planning and dispatch.",
          `/admin/jobs/${bookingId}`,
          session,
        );
      });
    }
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const intent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      await db.connection.transaction(async (session) => {
        await ProviderEvent.create([{ eventId: event.id, type: event.type }], {
          session,
        });
        const payment = await Payment.findOne({
          providerIntentId: intent,
        }).session(session);
        if (!payment) return;
        const changed = await Booking.findOneAndUpdate(
          {
            _id: payment.bookingId,
            refundsMinor: { $lt: charge.amount_refunded },
          },
          {
            $set: {
              refundsMinor: charge.amount_refunded,
              ...(charge.refunded ? { paymentStatus: "refunded" } : {}),
            },
            $inc: { version: 1 },
          },
          { session, new: true },
        );
        if (!changed) return;
        await Payout.updateMany(
          { bookingId: changed._id, status: { $ne: "paid" } },
          {
            $set: {
              status: "held",
              holdReason: "Customer refund requires settlement review",
            },
          },
          { session },
        );
        await audit(
          "stripe",
          "payment.refunded",
          String(changed._id),
          { eventId: event.id, refundedMinor: charge.amount_refunded },
          session,
        );
      });
    }
    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.closed"
    ) {
      const dispute = event.data.object;
      const intent =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id;
      await db.connection.transaction(async (session) => {
        await ProviderEvent.create([{ eventId: event.id, type: event.type }], {
          session,
        });
        const payment = await Payment.findOne({
          providerIntentId: intent,
        }).session(session);
        if (!payment) return;
        await Booking.updateOne(
          { _id: payment.bookingId },
          {
            $set: {
              chargebackMinor: dispute.status === "won" ? 0 : dispute.amount,
            },
          },
          { session },
        );
        await Payout.updateMany(
          { bookingId: payment.bookingId, status: { $ne: "paid" } },
          {
            $set: {
              status: "held",
              holdReason: "Payment dispute requires finance review",
            },
          },
          { session },
        );
        await audit(
          "stripe",
          `payment.${event.type}`,
          String(payment.bookingId),
          { eventId: event.id, status: dispute.status },
          session,
        );
      });
    }
    return new Response("OK");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return new Response("OK");
    return new Response("Unable to process event; retry later", {
      status: 500,
    });
  }
}
