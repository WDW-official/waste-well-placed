import Link from "next/link";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { DashLayout } from "@/components/dash-layout";
import { gbp, formatDate } from "@/lib/utils";
export default async function MyBookings() {
  const user = await getSession();
  await connectDB();
  const bookings = await Booking.find({ userId: user?.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return (
    <DashLayout
      type="My account"
      title="My bookings"
      links={[
        { name: "Overview", href: "/account" },
        { name: "Bookings", href: "/account/bookings" },
        { name: "Documents", href: "/account/documents" },
        { name: "Profile", href: "/account/profile" },
      ]}
    >
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={String(b._id)}>
                <td className="font-bold">{b.reference}</td>
                <td>
                  {b.scheduledAt ? formatDate(b.scheduledAt) : "Not scheduled"}
                </td>
                <td>{gbp(b.price?.totalMinor ?? 0)}</td>
                <td>
                  <span className="status">
                    {b.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{b.paymentStatus}</td>
                <td>
                  <Link
                    className="text-green-800 underline"
                    href={`/account/bookings/${b._id}`}
                  >
                    Details
                  </Link>
                </td>
              </tr>
            ))}
            {!bookings.length && (
              <tr>
                <td colSpan={6}>
                  No bookings yet.{" "}
                  <Link href="/book" className="underline">
                    Book a collection
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashLayout>
  );
}
