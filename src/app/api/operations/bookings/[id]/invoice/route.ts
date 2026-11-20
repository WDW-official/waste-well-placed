import { Booking } from "@/lib/models";
import { CompanyProfile, Counter, Invoice } from "@/lib/workflow-models";
import { connectDB } from "@/lib/db";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { objectId } from "@/lib/operations/validation";
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
    const db = await connectDB();
    const invoice = await db.connection.transaction(async (session) => {
      const prior = await Invoice.findOne({ bookingId: id }).session(session);
      if (prior) return prior;
      const booking = await Booking.findById(id).session(session);
      requireCondition(
        booking && booking.paymentStatus === "paid",
        "Only verified paid bookings can be invoiced",
      );
      requireCondition(
        !booking.refundsMinor && !booking.chargebackMinor,
        "Refunded/disputed payments require a credit-note review before issuing an invoice",
      );
      const company = await CompanyProfile.findOne({
        key: "company",
        approved: true,
      }).session(session);
      requireCondition(
        company?.legalName && company.address,
        "Publish approved company details before issuing invoices",
      );
      if (booking.price?.vatMinor)
        requireCondition(
          company.vatNumber,
          "A VAT registration number is required for this invoice",
        );
      const year = new Date().getUTCFullYear();
      const counter = await Counter.findOneAndUpdate(
        { key: `invoice:${year}` },
        { $inc: { value: 1 } },
        { upsert: true, new: true, session },
      );
      const number = `INV-${year}-${String(counter.value).padStart(6, "0")}`;
      const [created] = await Invoice.create(
        [
          {
            bookingId: id,
            userId: booking.userId,
            organizationId: booking.organizationId,
            number,
            company: {
              legalName: company.legalName,
              address: company.address,
              companyNumber: company.companyNumber,
              vatNumber: company.vatNumber,
            },
            customer: {
              name: booking.contact?.name ?? "Customer",
              address: [
                booking.address?.line1,
                booking.address?.city,
                booking.address?.postcode,
              ]
                .filter(Boolean)
                .join(", "),
            },
            lines: [
              ...booking.items.map((line) => ({
                title: line.title,
                qty: line.qty,
                unitMinor: line.unitMinor,
              })),
              ...(booking.price?.surchargeMinor
                ? [
                    {
                      title: "Additional collection charges",
                      qty: 1,
                      unitMinor: booking.price.surchargeMinor,
                    },
                  ]
                : []),
            ],
            totalMinor: booking.price?.totalMinor ?? 0,
            vatMinor: booking.price?.vatMinor ?? 0,
            issuedBy: user.id,
          },
        ],
        { session },
      );
      await audit(user.id, "invoice.issued", id, { number }, session);
      await notify(
        {
          key: `invoice:${created._id}`,
          event: "invoice_issued",
          reference: number,
          recipientId: String(booking.userId),
          subject: "Your collection invoice is ready",
          message: `Invoice ${number} is ready to view, print or save as PDF.`,
          href: `/api/invoices/${created._id}`,
        },
        session,
      );
      return created;
    });
    return ok({
      invoiceId: String(invoice._id),
      href: `/api/invoices/${invoice._id}`,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      const prior = await Invoice.findOne({ bookingId: (await params).id });
      if (prior)
        return ok({
          invoiceId: String(prior._id),
          href: `/api/invoices/${prior._id}`,
        });
    }
    return errorResponse(error);
  }
}
