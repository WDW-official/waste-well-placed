import { OperationsLayout } from "@/components/operations-layout";
import { DriverReview } from "@/components/driver-review";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <OperationsLayout title="Driver application review">
      <DriverReview id={(await params).id} />
    </OperationsLayout>
  );
}
