import { PageTitle } from "@/components/page-title";
import Link from "next/link";
export default async function Area({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <PageTitle
        title={`Collections in ${slug.replaceAll("-", " ")}`}
        desc="Please check your exact postcode before booking; service coverage is confirmed by current operating zones."
      />
      <div className="container section">
        <Link className="btn btn-primary" href="/areas">
          Check a postcode
        </Link>
      </div>
    </>
  );
}
