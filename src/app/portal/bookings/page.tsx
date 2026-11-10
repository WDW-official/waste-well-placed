import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { DashLayout } from "@/components/dash-layout";
import { gbp } from "@/lib/utils";
export default async function PortalBookings() {
  const u = await getSession();
  await connectDB();
  const rows = u?.organizationId
    ? await Booking.find({ organizationId: u.organizationId })
        .limit(100)
        .sort({ createdAt: -1 })
        .lean()
    : [];
  return (
    <DashLayout
      type="Business portal"
      title="Business bookings"
      links={[
        { name: "Overview", href: "/portal" },
        { name: "Sites", href: "/portal/sites" },
        { name: "Bookings", href: "/portal/bookings" },
        { name: "Reports", href: "/portal/reports" },
        { name: "Invoices", href: "/portal/invoices" },
      ]}
    >
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Address</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r._id)}>
                <td>{r.reference}</td>
                <td>{r.address?.postcode}</td>
                <td>{gbp(r.price?.totalMinor ?? 0)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4}>No linked business bookings.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashLayout>
  );
}
