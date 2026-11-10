import { PageTitle } from "@/components/page-title";
export const metadata = { title: "About us" };
export default function Page() {
  return (
    <>
      <PageTitle
        title="About Waste Well Placed"
        desc="A simpler way to organise responsible waste collection."
      />
      <article className="article section px-6">
        <p>
          Waste Well Placed is building a convenient UK waste collection
          experience for homes and businesses. Customers can describe their
          waste, check availability, book a collection and stay informed
          throughout the process.
        </p>
        <h2>Our commitment</h2>
        <p>
          Transparency, careful handling and responsible disposal guide our
          approach. Formal licence numbers, insurance certificates and verified
          recycling statistics should be published once supplied and
          independently checked by the business.
        </p>
      </article>
    </>
  );
}
