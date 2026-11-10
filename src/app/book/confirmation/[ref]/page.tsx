import { PageTitle } from "@/components/page-title";
import Link from "next/link";
export default async function Confirmation({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return (
    <>
      <PageTitle
        title="Your booking is being confirmed"
        desc="Payment confirmation may take a moment. Check the current status in your account."
      />
      <div className="container section max-w-2xl">
        <div className="card p-8">
          <p className="text-lg">
            Reference: <strong>{ref.replace(/[^a-zA-Z0-9-]/g, "")}</strong>
          </p>
          <p className="muted mt-4">
            A booking is confirmed only after Stripe verifies the payment.
            Please view your account for the latest status.
          </p>
          <Link href="/account/bookings" className="btn btn-primary mt-5">
            View my bookings
          </Link>
        </div>
      </div>
    </>
  );
}
