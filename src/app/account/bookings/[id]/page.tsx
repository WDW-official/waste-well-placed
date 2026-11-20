import { ReviewForm } from "@/components/review-form";
import { Invoice } from "@/lib/workflow-models";
import { BookingChangeForm } from "@/components/booking-change-form";
import { CollectionTimeline } from "@/components/collection-timeline";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { notFound } from "next/navigation";
import { DashLayout } from "@/components/dash-layout";
import { gbp, formatDate } from "@/lib/utils";
import Link from "next/link";
import mongoose from "mongoose";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSession();
  if (!mongoose.isValidObjectId(id)) notFound();
  await connectDB();
  const b = await Booking.findOne({ _id: id, userId: user?.id }).lean();
  if (!b) notFound();
  const invoice = await Invoice.findOne({ bookingId: b._id })
    .select("_id number")
    .lean();
  return (
    <DashLayout
      type="My account"
      title={`Booking ${b.reference}`}
      links={[
        { name: "Overview", href: "/account" },
        { name: "Bookings", href: "/account/bookings" },
        { name: "Documents", href: "/account/documents" },
        { name: "Profile", href: "/account/profile" },
      ]}
    >
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-7">
          <h2 className="font-bold text-xl">Collection details</h2>
          <p className="mt-4">
            {b.address?.line1}, {b.address?.city}, {b.address?.postcode}
          </p>
          <p className="mt-3">
            <strong>Date:</strong>{" "}
            {b.scheduledAt ? formatDate(b.scheduledAt) : "Not scheduled"}
          </p>
          <p className="mt-3">
            <strong>Amount:</strong> {gbp(b.price?.totalMinor ?? 0)}
          </p>
          <p className="mt-3">
            <strong>Payment:</strong> {b.paymentStatus}
          </p>
          {["paid", "refunded"].includes(b.paymentStatus) && (
            <Link
              className="btn btn-outline mt-5"
              href={`/api/bookings/${id}/receipt`}
              target="_blank"
            >
              View payment receipt
            </Link>
          )}
          {invoice && (
            <Link
              className="btn btn-outline mt-5"
              href={`/api/invoices/${invoice._id}`}
              target="_blank"
            >
              View invoice {invoice.number}
            </Link>
          )}
          {["verified", "closed"].includes(b.status) && (
            <Link
              className="btn btn-primary mt-6"
              href={`/api/documents/${id}`}
            >
              Download collection record
            </Link>
          )}
        </div>
        <div className="card p-7">
          <CollectionTimeline id={id} />
        </div>
      </div>
      <BookingChangeForm id={id} status={b.status} />
      {["verified", "closed"].includes(b.status) && (
        <ReviewForm bookingId={id} />
      )}
    </DashLayout>
  );
}
