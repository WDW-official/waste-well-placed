import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { fail, ok, errorResponse } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  try {
    const user = await getSession();
    if (!user) return fail("Sign in to view your booking", 401);
    await connectDB();
    const booking = await Booking.findOne({
      reference: (await params).ref,
      userId: user.id,
    })
      .select("reference status paymentStatus")
      .lean();
    return booking
      ? ok({
          booking: {
            id: String(booking._id),
            reference: booking.reference,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
          },
        })
      : fail("Booking not found", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
