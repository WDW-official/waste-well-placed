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
          {b.status === "completed" && (
            <Link
              className="btn btn-primary mt-6"
              href={`/api/documents/${id}`}
            >
              Download collection record
            </Link>
          )}
        </div>
        <div className="card p-7">
          <h2 className="font-bold text-xl">Collection updates</h2>
          <ol className="mt-5 space-y-5">
            {(b.events || []).map((e, i) => (
              <li key={i} className="border-l-4 pl-4 border-green-500">
                <p className="font-bold capitalize">
                  {e.status?.replaceAll("_", " ")}
                </p>
                <p className="text-sm muted">{e.note}</p>
                <p className="text-xs muted">{e.at ? formatDate(e.at) : ""}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </DashLayout>
  );
}
