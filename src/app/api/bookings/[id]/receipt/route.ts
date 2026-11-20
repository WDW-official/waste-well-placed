import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { requireCondition } from "@/lib/operations/security";
import { permitted } from "@/lib/operations/policy";
import { objectId } from "@/lib/operations/validation";
import { printDocument, money } from "@/lib/print-document";
import { errorResponse } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSession();
    requireCondition(user, "Sign in to view your receipt", 401);
    await connectDB();
    const booking = await Booking.findById(
      objectId.parse((await params).id),
    ).lean();
    requireCondition(booking, "Booking not found", 404);
    requireCondition(
      String(booking.userId) === user.id ||
        (user.organizationId &&
          String(booking.organizationId) === user.organizationId) ||
        permitted(user.role, "finance"),
      "Not permitted",
      403,
    );
    requireCondition(
      ["paid", "refunded"].includes(booking.paymentStatus),
      "Payment has not been verified",
      404,
    );
    return printDocument(
      `Payment receipt — ${booking.reference}`,
      [
        "Waste Well Placed",
        "This is a payment receipt, not a VAT invoice.",
        `Customer: ${booking.contact?.name ?? "Customer"}`,
        `Collection address: ${[booking.address?.line1, booking.address?.city, booking.address?.postcode].filter(Boolean).join(", ")}`,
        `Verified payment: ${money(booking.paidMinor || booking.price?.totalMinor || 0)}`,
        `Refunded: ${money(booking.refundsMinor ?? 0)}`,
      ],
      {
        head: ["Description", "Quantity", "Unit price"],
        rows: booking.items.map((line) => [
          line.title ?? "Collection",
          String(line.qty ?? 1),
          money(line.unitMinor ?? 0),
        ]),
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
