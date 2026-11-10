import { DashLayout } from "@/components/dash-layout";
import { adminLinks } from "@/lib/admin-links";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { gbp } from "@/lib/utils";
export default async function Reports() {
  await connectDB();
  const result = await Booking.aggregate([
    { $match: { paymentStatus: "paid" } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        amount: { $sum: "$price.totalMinor" },
      },
    },
    { $sort: { count: -1 } },
  ]);
  return (
    <DashLayout type="Operations" title="Booking reports" links={adminLinks}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job status</th>
              <th>Paid bookings</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {result.map((r) => (
              <tr key={r._id}>
                <td>{r._id}</td>
                <td>{r.count}</td>
                <td>{gbp(r.amount)}</td>
              </tr>
            ))}
            {!result.length && (
              <tr>
                <td colSpan={3}>No verified payments yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashLayout>
  );
}
