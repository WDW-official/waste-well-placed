import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { Building2, Repeat, FileText, MapPinned } from "lucide-react";
export const metadata = { title: "Commercial waste collection" };
export default function Business() {
  return (
    <>
      <PageTitle
        eyebrow="For businesses"
        title="Dependable clearance, fewer admin headaches"
        desc="Office clearance and commercial collections with organised booking records, site information and dedicated enquiries."
      />
      <div className="container section">
        <div className="grid md:grid-cols-4 gap-5">
          {[
            {
              I: Building2,
              t: "Office & commercial",
              d: "Tailored collections for workspaces.",
            },
            {
              I: MapPinned,
              t: "Multiple sites",
              d: "Keep site addresses organised.",
            },
            {
              I: Repeat,
              t: "Repeat jobs",
              d: "Discuss recurring waste schedules.",
            },
            {
              I: FileText,
              t: "Documentation",
              d: "Find bookings and available records in one place.",
            },
          ].map((x) => (
            <div className="card p-6" key={x.t}>
              <x.I className="text-green-800 mb-4" size={32} />
              <h2 className="font-bold text-xl">{x.t}</h2>
              <p className="muted mt-3">{x.d}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#eafaeb] rounded-3xl mt-10 p-10 flex justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">
              Need a tailored business quote?
            </h2>
            <p className="muted mt-3">
              Tell us what you need to clear and how many sites are involved.
            </p>
          </div>
          <Link className="btn btn-primary" href="/business/enquire">
            Request a business quote
          </Link>
        </div>
      </div>
    </>
  );
}
