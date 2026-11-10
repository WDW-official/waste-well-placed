import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Organization } from "@/lib/models";
import { DashLayout } from "@/components/dash-layout";
export default async function Sites() {
  const u = await getSession();
  await connectDB();
  const org = await Organization.findOne({ managerId: u?.id }).lean();
  return (
    <DashLayout
      type="Business portal"
      title="Collection sites"
      links={[
        { name: "Overview", href: "/portal" },
        { name: "Sites", href: "/portal/sites" },
        { name: "Bookings", href: "/portal/bookings" },
        { name: "Reports", href: "/portal/reports" },
        { name: "Invoices", href: "/portal/invoices" },
      ]}
    >
      <div className="card p-7">
        {org?.sites?.length ? (
          org.sites.map((s, i) => (
            <p key={i} className="py-3 border-b">
              <strong>{s.name}</strong> — {s.address}, {s.postcode}
            </p>
          ))
        ) : (
          <p className="muted">
            No business sites are linked. Please contact support to activate
            your organisation.
          </p>
        )}
      </div>
    </DashLayout>
  );
}
