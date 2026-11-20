import { z } from "zod";
import { Booking } from "@/lib/models";
import { BookingChange } from "@/lib/workflow-models";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { objectId } from "@/lib/operations/validation";
import { audit, notifyStaff } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
async function owned(id: string) {
  const user = await getSession();
  if (!user) return null;
  await connectDB();
  const booking = await Booking.findOne({ _id: id, userId: user.id });
  return booking ? { user, booking } : null;
}
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = objectId.parse((await params).id);
    if (!(await owned(id))) return fail("Booking not found", 404);
    return ok({
      requests: await BookingChange.find({ bookingId: id })
        .sort({ createdAt: -1 })
        .lean(),
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
    const id = objectId.parse((await params).id);
    const owner = await owned(id);
    if (!owner) return fail("Booking not found", 404);
    const data = z
      .object({
        kind: z.enum(["cancel", "reschedule"]),
        reason: z.string().trim().min(5).max(2000),
        preferredDate: z.string().date().optional(),
      })
      .parse(await req.json());
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const locked = await Booking.findOneAndUpdate(
        {
          _id: id,
          userId: owner.user.id,
          status: {
            $in: [
              "pending_payment",
              "confirmed",
              "assigned",
              "en_route",
              "arrived",
              "payment_review",
            ],
          },
        },
        { $inc: { version: 1 } },
        { session, new: true },
      );
      if (!locked)
        throw Object.assign(
          new Error(
            "This booking cannot be changed online. Please contact support.",
          ),
          { status: 409 },
        );
      const [change] = await BookingChange.create(
        [{ bookingId: id, userId: owner.user.id, ...data }],
        { session },
      );
      await audit(
        owner.user.id,
        "booking.change_requested",
        id,
        { kind: data.kind },
        session,
      );
      await notifyStaff(
        `booking-change:${change._id}`,
        "booking_change_requested",
        locked.reference ?? id,
        `A customer requested ${data.kind}. Staff review is required.`,
        `/admin/jobs/${id}`,
        session,
      );
    });
    return ok({ requested: true }, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("A change request is already waiting for review", 409);
    return errorResponse(error);
  }
}
