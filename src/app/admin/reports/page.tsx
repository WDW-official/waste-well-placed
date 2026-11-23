import { requireUser } from "@/lib/operations/security";
import { AdminPage } from "@/components/admin-page";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { gbp } from "@/lib/utils";
import Link from "next/link";
export default async function Reports() {
  await requireUser("finance");
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
    <AdminPage title="Booking reports">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job status</th>
              <th>Paid bookings</th>
              <th>Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.map((r) => (
              <tr key={r._id}>
                <td>{r._id}</td>
                <td>{r.count}</td>
                <td>{gbp(r.amount)}</td>
                <td>
                  <Link
                    className="text-sm font-semibold underline"
                    href={`/admin/jobs?status=${encodeURIComponent(String(r._id))}`}
                  >
                    View collections
                  </Link>
                </td>
              </tr>
            ))}
            {!result.length && (
              <tr>
                <td colSpan={4}>No verified payments yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
