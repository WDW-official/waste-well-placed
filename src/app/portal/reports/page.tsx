import { BusinessReports } from "@/components/business-reports";
import { DashLayout } from "@/components/dash-layout";
export default function Reports() {
  return (
    <DashLayout
      type="Business portal"
      title="Business reports"
      links={[
        { name: "Overview", href: "/portal" },
        { name: "Sites", href: "/portal/sites" },
        { name: "Bookings", href: "/portal/bookings" },
        { name: "Reports", href: "/portal/reports" },
        { name: "Invoices", href: "/portal/invoices" },
      ]}
    >
      <BusinessReports />
    </DashLayout>
  );
}
