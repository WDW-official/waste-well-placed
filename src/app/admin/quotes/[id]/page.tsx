import { OperationsLayout } from "@/components/operations-layout";
import { QuoteReview } from "@/components/quote-review";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <OperationsLayout title="Review photo quotation">
      <QuoteReview id={(await params).id} />
    </OperationsLayout>
  );
}
