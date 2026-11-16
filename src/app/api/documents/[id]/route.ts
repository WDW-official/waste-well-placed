import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { Evidence, Facility } from "@/lib/operations/models";
import { permitted } from "@/lib/operations/policy";
import { objectId } from "@/lib/operations/validation";
import { requireCondition } from "@/lib/operations/security";
import { errorResponse } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSession();
    requireCondition(user, "Sign in to continue", 401);
    await connectDB();
    const id = objectId.parse((await params).id);
    const booking = await Booking.findById(id).lean();
    requireCondition(booking, "Collection not found", 404);
    requireCondition(
      String(booking.userId) === user.id ||
        permitted(user.role, "verify") ||
        permitted(user.role, "operations"),
      "Not permitted",
      403,
    );
    const evidence = await Evidence.findOne({
      bookingId: id,
      status: "verified",
    }).lean();
    requireCondition(
      evidence && ["verified", "closed"].includes(booking.status),
      "Evidence has not been independently verified",
      404,
    );
    if (evidence.transferNoteAssetId)
      return Response.redirect(
        new URL(`/api/assets/${evidence.transferNoteAssetId}`, _.url),
      );
    const facility = await Facility.findById(evidence.facilityId).lean();
    const text = [
      "WASTE WELL PLACED — VERIFIED COLLECTION RECORD",
      "This collection summary is not a statutory waste transfer note.",
      `Reference: ${booking.reference}`,
      `Address: ${booking.address?.line1}, ${booking.address?.city}, ${booking.address?.postcode}`,
      `Waste description: ${evidence.wasteDescription}`,
      `Weight: ${evidence.weightKg ?? "Not recorded"} kg`,
      `Facility: ${facility?.name ?? "Recorded privately"}`,
      `Facility receipt: ${evidence.receiptNumber}`,
      `Delivery time: ${evidence.deliveredAt?.toISOString() ?? "Recorded"}`,
      `Staff verification: ${evidence.verifiedAt?.toISOString()}`,
      "Facility delivery does not by itself establish recycling or diversion outcomes.",
    ].join("\n");
    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${booking.reference}-collection-record.txt"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
