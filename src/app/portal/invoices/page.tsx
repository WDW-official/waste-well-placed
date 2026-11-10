import { DashLayout } from "@/components/dash-layout";
export default function Invoices() {
  return (
    <DashLayout
      type="Business portal"
      title="Business invoices"
      links={[
        { name: "Overview", href: "/portal" },
        { name: "Sites", href: "/portal/sites" },
        { name: "Bookings", href: "/portal/bookings" },
        { name: "Reports", href: "/portal/reports" },
        { name: "Invoices", href: "/portal/invoices" },
      ]}
    >
      <div className="card p-7">
        Invoice downloads will appear once invoices are issued in the accounting
        workflow. No dummy invoices are shown as official VAT invoices.
      </div>
    </DashLayout>
  );
}
