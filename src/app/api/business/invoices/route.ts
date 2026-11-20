import { businessContext } from "@/lib/business";
import { Booking } from "@/lib/models";
import { Invoice } from "@/lib/workflow-models";
import { errorResponse, ok } from "@/lib/http";
export async function GET() {
  try {
    const { organization } = await businessContext();
    return ok({
      invoices: await Invoice.find({ organizationId: organization._id })
        .select("number bookingId issuedAt totalMinor vatMinor")
        .sort({ issuedAt: -1 })
        .limit(100)
        .lean(),
      receipts: await Booking.find({
        organizationId: organization._id,
        paymentStatus: { $in: ["paid", "refunded"] },
      })
        .select("reference price refundsMinor")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
