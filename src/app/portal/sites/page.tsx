import { BusinessSites } from "@/components/business-sites";
import { DashLayout } from "@/components/dash-layout";
export default async function Sites() {
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
      <BusinessSites />
    </DashLayout>
  );
}
