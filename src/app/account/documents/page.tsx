import Link from "next/link";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { DashLayout } from "@/components/dash-layout";
export default async function Documents() {
  const u = await getSession();
  await connectDB();
  const rows = await Booking.find({
    userId: u?.id,
    status: "completed",
    "evidence.transferNoteId": { $exists: true },
  })
    .select("reference")
    .lean();
  return (
    <DashLayout
      type="My account"
      title="My documents"
      links={[
        { name: "Overview", href: "/account" },
        { name: "Bookings", href: "/account/bookings" },
        { name: "Documents", href: "/account/documents" },
        { name: "Profile", href: "/account/profile" },
      ]}
    >
      <div className="card p-7">
        {rows.map((r) => (
          <p key={String(r._id)} className="py-3 border-b">
            <Link
              href={`/api/documents/${r._id}`}
              className="text-green-800 underline"
            >
              Collection record: {r.reference}
            </Link>
          </p>
        ))}
        {rows.length === 0 && (
          <p className="muted">No completed collection records yet.</p>
        )}
      </div>
    </DashLayout>
  );
}
