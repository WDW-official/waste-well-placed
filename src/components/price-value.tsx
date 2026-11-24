import { gbp } from "@/lib/utils";

export function PriceValue({
  amount,
  ready,
  error,
}: {
  amount: number;
  ready: boolean;
  error: string;
}) {
  if (ready) return <>{gbp(amount)}</>;
  if (error) return <span className="price-unavailable">Unavailable</span>;
  return (
    <span className="price-skeleton" role="status" aria-label="Loading price" />
  );
}
