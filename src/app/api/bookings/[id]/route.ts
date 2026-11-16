import { getSession, isStaff } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { ok, fail, errorResponse } from "@/lib/http";
import mongoose from "mongoose";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSession();
    if (!user) return fail("Unauthorised", 401);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return fail("Invalid booking", 400);
    await connectDB();
    const b = await Booking.findById(id).lean();
    if (!b) return fail("Not found", 404);
    if (
      String(b.userId) !== user.id &&
      !isStaff(user.role) &&
      !(user.role === "crew" && String(b.assignedCrewId) === user.id)
    )
      return fail("Forbidden", 403);
    return ok({
      booking: isStaff(user.role)
        ? b
        : {
            id: String(b._id),
            reference: b.reference,
            status: b.status,
            paymentStatus: b.paymentStatus,
            scheduledAt: b.scheduledAt,
            address: b.address,
            price: b.price,
            events: b.events.map((event) => ({
              status: event.status,
              at: event.at,
            })),
          },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
