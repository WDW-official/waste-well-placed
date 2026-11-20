import { PageTitle } from "@/components/page-title";
import { BookingConfirmation } from "@/components/booking-confirmation";
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
        <BookingConfirmation reference={ref.replace(/[^a-zA-Z0-9-]/g, "")} />
      </div>
    </>
  );
}
