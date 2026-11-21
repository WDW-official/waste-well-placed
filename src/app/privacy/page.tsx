import { PublishedPolicy } from "@/components/published-policy";
import { PolicyPage } from "@/components/policy-page";
export default function Privacy() {
  return (
    <PolicyPage
      title="Privacy policy"
      description="How we handle your personal information when you use Waste Well Placed."
      kind="privacy"
    >
      <PublishedPolicy kind="privacyText">
        <article className="article section px-6">
          <p className="policy-review-note">
            <strong>
              Pre-launch legal template — requires review and completion before
              publishing.
            </strong>
          </p>
          <h2>Personal information we process</h2>
          <p>
            When you book, register, or request a quote, we process your contact
            details, address, booking data, optional uploaded photos, and
            payment references. We do not store full card details.
          </p>
          <h2>Purposes</h2>
          <p>
            We use these details to provide collection services, support,
            payment reconciliation and legal recordkeeping. Marketing messages
            require appropriate consent.
          </p>
          <h2>Driver applications and collection evidence</h2>
          <p>
            Driver applications include identity and contact details, date of
            birth, driving entitlement, vehicle and insurance information,
            authorisation records, availability and supporting documents. We use
            these for application review, eligibility checks, dispatch and
            settlement administration. Check credentials are encrypted; identity
            documents are restricted to the applicant and authorised reviewers.
          </p>
          <p>
            Approved drivers see customer details only for their own accepted
            collections. Pickup photographs and receiving-facility records are
            reviewed before verified records are made available to customers.
            The driver workspace does not currently collect live GPS location or
            bank account details.
          </p>
          <h2>Service providers and rights</h2>
          <p>
            Data may be processed using MongoDB Atlas, Cloudinary, Stripe and
            configured communications providers. UK data protection requests
            should be directed to the company contact email. Retention, legal
            basis, cookie consent and cross-border transfer clauses must be
            signed off before launch.
          </p>
        </article>
      </PublishedPolicy>
    </PolicyPage>
  );
}
