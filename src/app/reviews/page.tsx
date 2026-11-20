import { PageTitle } from "@/components/page-title";
import { PublicReviews } from "@/components/public-reviews";
export default function Reviews() {
  return (
    <>
      <PageTitle
        title="Customer reviews"
        desc="Reviews from customers with completed, verified collections."
      />
      <PublicReviews />
    </>
  );
}
