import { PageTitle } from "@/components/page-title";
export default function Privacy() {
  return (
    <>
      <PageTitle title="Privacy policy" />
      <article className="article section px-6">
        <p>
          <strong>
            Pre-launch legal template — requires review and completion before
            publishing.
          </strong>
        </p>
        <h2>Personal information we process</h2>
        <p>
          When you book, register, or request a quote, we process your contact
          details, address, booking data, optional uploaded photos, and payment
          references. We do not store full card details.
        </p>
        <h2>Purposes</h2>
        <p>
          We use these details to provide collection services, support, payment
          reconciliation and legal recordkeeping. Marketing messages require
          appropriate consent.
        </p>
        <h2>Service providers and rights</h2>
        <p>
          Data may be processed using MongoDB Atlas, Cloudinary, Stripe and
          configured communications providers. UK data protection requests
          should be directed to the company contact email. Retention, legal
          basis, cookie consent and cross-border transfer clauses must be signed
          off before launch.
        </p>
      </article>
    </>
  );
}
