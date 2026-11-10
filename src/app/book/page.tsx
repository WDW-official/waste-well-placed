import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { Trash2, Armchair, Camera, ArrowRight } from "lucide-react";
export default function Book() {
  return (
    <>
      <PageTitle
        title="Book a waste collection"
        desc="Select how you want to describe your waste. You can review all details before making payment."
      />
      <div className="container section grid md:grid-cols-3 gap-5">
        {[
          {
            Icon: Trash2,
            title: "Mixed rubbish",
            text: "Choose a load size with clear volume and weight allowances.",
            href: "/book/load",
          },
          {
            Icon: Armchair,
            title: "Single or multiple items",
            text: "Search for furniture, appliances and other bulky items.",
            href: "/book/items",
          },
          {
            Icon: Camera,
            title: "Upload photos for a quote",
            text: "For a full clearance or complicated job, let us review the images.",
            href: "/book/photo-quote",
          },
        ].map((x) => (
          <Link href={x.href} key={x.title} className="card p-8 service-card">
            <x.Icon size={38} className="text-green-800 mb-5" />
            <h2 className="text-2xl font-bold">{x.title}</h2>
            <p className="muted mt-4">{x.text}</p>
            <span className="inline-flex text-green-800 font-bold gap-2 mt-5">
              Continue <ArrowRight size={18} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
