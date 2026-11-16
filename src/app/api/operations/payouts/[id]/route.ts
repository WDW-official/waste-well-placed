import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { Assignment, Evidence, Payout } from "@/lib/operations/models";
import { objectId } from "@/lib/operations/validation";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { audit, notify } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("finance");
    const id = objectId.parse((await params).id);
    const data = z
      .object({
        action: z.enum(["approve", "schedule", "paid", "hold", "adjust"]),
        version: z.number().int(),
        note: z.string().min(5).max(2000),
        amountMinor: z
          .number()
          .int()
          .min(-100_000_000)
          .max(100_000_000)
          .optional(),
        reference: z.string().min(3).max(200).optional(),
        scheduledAt: z.string().datetime().optional(),
      })
      .parse(await req.json());
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const payout = await Payout.findOne({
        _id: id,
        version: data.version,
      }).session(session);
      requireCondition(
        payout && payout.status !== "paid",
        "Payout changed or already paid",
        409,
      );
      if (data.action !== "hold") {
        requireCondition(
          await Assignment.exists({
            _id: payout.assignmentId,
            status: "approved",
          }).session(session),
          "Assignment has not been approved",
        );
        requireCondition(
          await Evidence.exists({
            assignmentId: payout.assignmentId,
            status: "verified",
          }).session(session),
          "Facility evidence is not verified",
        );
        const booking = await Booking.findById(payout.bookingId).session(
          session,
        );
        requireCondition(
          booking?.paymentStatus === "paid" &&
            !booking.refundsMinor &&
            !booking.chargebackMinor,
          "Refunded, disputed or unpaid jobs need financial review",
        );
      }
      const total =
        payout.offeredMinor +
        payout.adjustments.reduce(
          (sum, adjustment) => sum + (adjustment.amountMinor ?? 0),
          0,
        );
      if (data.action === "adjust") {
        requireCondition(
          data.amountMinor !== undefined &&
            total + data.amountMinor >= 0 &&
            data.amountMinor !== 0,
          "Adjustment must keep the payable amount nonnegative",
        );
        // Negative changes require an existing dispute/hold and recorded review, never an automatic deduction.
        requireCondition(
          data.amountMinor > 0 || payout.status === "held",
          "Hold and review a dispute before recording a negative adjustment",
        );
        payout.adjustments.push({
          amountMinor: data.amountMinor,
          reason: data.note,
          actorId: user.id,
          at: new Date(),
        });
        payout.status = "conditional";
      }
      if (data.action === "approve") {
        payout.status = "approved";
        payout.approvedBy = new Types.ObjectId(user.id);
        payout.approvedAt = new Date();
      }
      if (data.action === "schedule") {
        requireCondition(
          payout.status === "approved" && data.scheduledAt,
          "Approve the payout and supply its payment date",
        );
        payout.status = "scheduled";
        payout.scheduledAt = new Date(data.scheduledAt);
      }
      if (data.action === "paid") {
        requireCondition(
          ["approved", "scheduled"].includes(payout.status) && data.reference,
          "Approve the payout and enter the completed bank-transfer reference",
        );
        payout.status = "paid";
        payout.paidBy = new Types.ObjectId(user.id);
        payout.paidAt = new Date();
        payout.transferReference = data.reference;
      }
      if (data.action === "hold") {
        payout.status = "held";
        payout.holdReason = data.note;
      }
      const { _id, ...fields } = payout.toObject();
      const changed = await Payout.updateOne(
        { _id, version: data.version },
        {
          $set: {
            status: fields.status,
            adjustments: fields.adjustments,
            approvedBy: fields.approvedBy,
            approvedAt: fields.approvedAt,
            scheduledAt: fields.scheduledAt,
            paidBy: fields.paidBy,
            paidAt: fields.paidAt,
            transferReference: fields.transferReference,
            holdReason: fields.holdReason,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      requireCondition(changed.modifiedCount, "Payout changed", 409);
      if (data.action === "paid")
        await Booking.updateOne(
          { _id: payout.bookingId, status: "verified" },
          {
            $set: { status: "closed" },
            $inc: { version: 1 },
            $push: {
              events: {
                status: "closed",
                by: user.id,
                at: new Date(),
                note: "Collection record closed",
              },
            },
          },
          { session },
        );
      await audit(
        user.id,
        `payout.${data.action}`,
        String(payout.bookingId),
        {
          payoutId: id,
          note: data.note,
          amountMinor: data.amountMinor,
          reference: data.reference,
        },
        session,
      );
      await notify(
        {
          key: `payout:${id}:${data.version}`,
          event: "payout_update",
          reference: id,
          recipientId: String(payout.driverId),
          subject: "Your driver earnings have an update",
          message: `Settlement status: ${payout.status}. ${data.note}`,
          href: "/driver",
        },
        session,
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
