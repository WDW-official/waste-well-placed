import { PublishedPolicy } from "@/components/published-policy";
import { PolicyPage } from "@/components/policy-page";
export default function Terms() {
  return (
    <PolicyPage
      title="Terms & conditions"
      description="Information about booking, payment and using our collection services."
      kind="terms"
    >
      <PublishedPolicy kind="termsText">
        <article className="article section px-6">
          <p className="policy-review-note">
            <strong>Pre-launch terms draft — legal review required.</strong>
          </p>
          <h2>Bookings & payment</h2>
          <p>
            All collections depend on actual service coverage, waste
            classification, site access and appointment capacity. Final prices,
            charges and VAT are displayed at checkout.
          </p>
          <h2>Restricted materials</h2>
          <p>
            Hazardous substances, asbestos and certain special waste types are
            not accepted through standard instant booking; contact the team for
            assessment.
          </p>
          <h2>Changes and cancellations</h2>
          <p>
            Applicable rescheduling, cancellation and refund rules must be
            supplied by Waste Well Placed and agreed before accepting payment.
          </p>
        </article>
      </PublishedPolicy>
    </PolicyPage>
  );
}
