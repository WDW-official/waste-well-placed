import { DashLayout } from "@/components/dash-layout";
import { adminLinks } from "@/lib/admin-links";
export default function Settings() {
  return (
    <DashLayout
      type="Operations"
      title="Operations settings"
      links={adminLinks}
    >
      <div className="card p-7 max-w-3xl">
        <h2 className="text-xl font-bold">Launch checklist</h2>
        <ul className="list-disc ml-5 mt-5 space-y-3">
          <li>
            Confirm company number, waste carrier registration and insurance
          </li>
          <li>
            Replace illustrative seed tariffs with approved prices and correct
            VAT treatment
          </li>
          <li>
            Configure live service zones, driver capacity and blackout dates
          </li>
          <li>Activate Stripe GBP payments and webhook secret</li>
          <li>Set Cloudinary, authentication and email provider credentials</li>
          <li>Approve terms, privacy, cancellation and refund policies</li>
          <li>
            Test a complete paid booking and document workflow before launch
          </li>
        </ul>
      </div>
    </DashLayout>
  );
}
