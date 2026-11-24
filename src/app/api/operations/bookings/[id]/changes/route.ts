import { z } from "zod";
import { stripeClient } from "@/lib/stripe";
import { reconcileRefund } from "@/lib/refunds";
import { Booking, Payment, Slot } from "@/lib/models";
import { Assignment, Payout } from "@/lib/operations/models";
import { BookingChange, RefundRequest } from "@/lib/workflow-models";
import { connectDB } from "@/lib/db";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { permitted } from "@/lib/operations/policy";
import { objectId, pence } from "@/lib/operations/validation";
import { releaseBookingSlot, releaseExpiredHolds } from "@/lib/slot-holds";
import { audit, notify } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    requireCondition(
      permitted(user.role, "operations") || permitted(user.role, "finance"),
      "Not permitted",
      403,
    );
    await connectDB();
    const id = objectId.parse((await params).id);
    const booking = await Booking.findById(id)
      .select(
        "reference address status paymentStatus paidMinor refundsMinor price",
      )
      .lean();
    requireCondition(booking, "Not found", 404);
    return ok({
      booking,
      requests: await BookingChange.find({ bookingId: id })
        .sort({ createdAt: -1 })
        .lean(),
      refunds: await RefundRequest.find({ bookingId: id })
        .sort({ createdAt: -1 })
        .lean(),
      canReview: permitted(user.role, "operations"),
      canRefund: permitted(user.role, "finance"),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser();
    const id = objectId.parse((await params).id);
    const data = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("reconcile_refund"),
          requestId: objectId,
          providerRef: z.string().regex(/^re_[a-zA-Z0-9_]+$/),
        }),
        z.object({
          action: z.literal("refund"),
          amountMinor: pence.refine((value) => value > 0),
          note: z.string().min(5).max(2000),
        }),
        z.object({
          action: z.literal("review"),
          requestId: objectId,
          approved: z.boolean(),
          slotId: objectId.optional(),
          note: z.string().min(5).max(2000),
        }),
      ])
      .parse(await req.json());
    requireCondition(
      permitted(user.role, data.action !== "review" ? "finance" : "operations"),
      "Not permitted",
      403,
    );
    if (data.action === "reconcile_refund") {
      await connectDB();
      const item = await RefundRequest.findOne({
        _id: data.requestId,
        bookingId: id,
      });
      requireCondition(item, "Refund request not found", 404);
      const payment = await Payment.findOne({ bookingId: id, status: "paid" });
      requireCondition(
        payment?.providerIntentId,
        "Verified payment reference is missing",
      );
      const stripe = stripeClient();
      const refund = await stripe.refunds.retrieve(data.providerRef);
      const intent =
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : refund.payment_intent?.id;
      requireCondition(
        refund.metadata?.refundRequestId === String(item._id) &&
          intent === payment.providerIntentId &&
          refund.amount === item.amountMinor,
        "The provider refund does not match this approved request",
      );
      requireCondition(
        refund.status === "succeeded",
        "The provider has not confirmed this refund yet",
      );
      const chargeId =
        typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
      requireCondition(chargeId, "Refund charge is unavailable");
      const charge = await stripe.charges.retrieve(chargeId);
      requireCondition(
        charge.amount_refunded >= item.amountMinor,
        "The provider charge is not reconciled yet",
      );
      await RefundRequest.updateOne(
        { _id: item._id, status: { $ne: "confirmed" } },
        { $set: { providerRef: refund.id, status: "submitted" } },
      );
      await reconcileRefund(id, charge.amount_refunded, charge.refunded, [
        refund.id,
      ]);
      await audit(user.id, "booking.refund_reconciled", id, {
        refundRequestId: String(item._id),
        providerRef: refund.id,
      });
      return ok({ updated: true });
    }
    await releaseExpiredHolds();
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const booking = await Booking.findById(id).session(session);
      requireCondition(booking, "Booking not found", 404);
      if (data.action === "refund") {
        requireCondition(
          ["paid", "refunded"].includes(booking.paymentStatus),
          "Only verified payments can be refunded",
        );
        const outstanding = await RefundRequest.find({
          bookingId: id,
          status: { $in: ["queued", "sending", "submitted", "review"] },
        }).session(session);
        const available =
          (booking.paidMinor || booking.price?.totalMinor || 0) -
          (booking.refundsMinor || 0) -
          outstanding.reduce((sum, row) => sum + row.amountMinor, 0);
        requireCondition(
          data.amountMinor <= available,
          "Amount exceeds the unrefunded payment",
        );
        await Booking.updateOne(
          { _id: id },
          { $inc: { version: 1 } },
          { session },
        );
        await RefundRequest.create(
          [
            {
              bookingId: id,
              requestedBy: user.id,
              amountMinor: data.amountMinor,
              reason: data.note,
            },
          ],
          { session },
        );
        await Payout.updateMany(
          { bookingId: id, status: { $ne: "paid" } },
          {
            $set: {
              status: "held",
              holdReason: "Customer refund queued for provider processing",
            },
          },
          { session },
        );
        await audit(
          user.id,
          "booking.refund_queued",
          id,
          { amountMinor: data.amountMinor, note: data.note },
          session,
        );
        return;
      }
      const change = await BookingChange.findOne({
        _id: data.requestId,
        bookingId: id,
        status: "pending",
      }).session(session);
      requireCondition(change, "Request changed or already reviewed", 409);
      if (data.approved) {
        requireCondition(
          !(await Assignment.exists({ bookingId: id, live: true }).session(
            session,
          )),
          "Release the active assignment before changing the booking",
          409,
        );
        requireCondition(
          ["pending_payment", "confirmed", "payment_review"].includes(
            booking.status,
          ),
          "Booking can no longer be changed",
          409,
        );
        if (change.kind === "cancel") {
          if (!booking.slotReleasedAt)
            await releaseBookingSlot(id, "cancelled", session);
          else
            await Booking.updateOne(
              { _id: id },
              {
                $set: { status: "cancelled", cancelledAt: new Date() },
                $inc: { version: 1 },
              },
              { session },
            );
        } else {
          requireCondition(
            booking.paymentStatus === "paid",
            "For an unpaid booking, cancel the old reservation and start a new booking.",
          );
          requireCondition(data.slotId, "Choose a new collection slot");
          requireCondition(
            String(booking.slotId) !== data.slotId,
            "Choose a different slot",
          );
          const target = await Slot.findOneAndUpdate(
            {
              _id: data.slotId,
              active: true,
              start: { $gt: new Date() },
              $expr: { $lt: ["$reservedCount", "$capacity"] },
            },
            { $inc: { reservedCount: 1 } },
            { session, new: true },
          );
          requireCondition(target, "The new slot is no longer available", 409);
          if (!booking.slotReleasedAt && booking.slotId)
            await Slot.updateOne(
              { _id: booking.slotId, reservedCount: { $gt: 0 } },
              { $inc: { reservedCount: -1 } },
              { session },
            );
          await Booking.updateOne(
            { _id: id },
            {
              $set: {
                slotId: target._id,
                scheduledAt: target.start,
                status:
                  booking.paymentStatus === "paid"
                    ? "confirmed"
                    : "pending_payment",
                ...(booking.paymentStatus !== "paid"
                  ? { checkoutExpiresAt: new Date(Date.now() + 3600_000) }
                  : {}),
              },
              $unset: { slotReleasedAt: 1 },
              $inc: { version: 1 },
              $push: {
                events: {
                  status: "rescheduled",
                  at: new Date(),
                  by: user.id,
                  note: data.note,
                },
              },
            },
            { session },
          );
        }
      }
      const result = await BookingChange.updateOne(
        { _id: change._id, status: "pending" },
        {
          $set: {
            status: data.approved ? "approved" : "rejected",
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNote: data.note,
          },
        },
        { session },
      );
      requireCondition(result.modifiedCount, "Request already reviewed", 409);
      await audit(
        user.id,
        "booking.change_reviewed",
        id,
        { requestId: data.requestId, approved: data.approved, note: data.note },
        session,
      );
      await notify(
        {
          key: `booking-change:${change._id}:reviewed`,
          event: "booking_change_reviewed",
          reference: booking.reference ?? id,
          recipientId: String(booking.userId),
          subject: "Your booking change has been reviewed",
          message: `Your ${change.kind} request was ${data.approved ? "approved" : "declined"}. ${data.note}${change.kind === "cancel" && data.approved && booking.paymentStatus === "paid" ? " Any refund is reviewed separately by our team." : ""}`,
          href: `/account/bookings/${id}`,
        },
        session,
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
