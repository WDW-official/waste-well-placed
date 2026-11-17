import Image from "next/image";
import { HOW_IT_WORKS_HERO_IMAGE } from "@/lib/images";
import Link from "next/link";
export const metadata = { title: "How it works" };
export default function HowItWorks() {
  return (
    <>
      <section className="how-it-works-hero" aria-labelledby="how-it-works-title">
        <Image
          className="how-it-works-background"
          src={HOW_IT_WORKS_HERO_IMAGE}
          alt="Customer booking a collection on her phone beside items ready to go"
          fill
          priority
          sizes="100vw"
        />
        <div className="container how-it-works-content">
          <div>
            <h1 id="how-it-works-title">From clutter to clear in three steps</h1>
            <p>A simple, transparent booking process.</p>
          </div>
        </div>
      </section>
      <div className="container section max-w-4xl">
        {[
          {
            t: "1. Tell us what you have",
            d: "Use a load size, choose individual items, or submit photos for a tailored quote. We confirm your UK service area.",
          },
          {
            t: "2. Choose collection details",
            d: "Confirm access conditions and choose an available time slot. Review the final price and pay securely where online checkout is offered.",
          },
          {
            t: "3. Collection & evidence",
            d: "Our team updates job status and records completion evidence; any applicable waste transfer documents are available in your account.",
          },
        ].map((s) => (
          <div className="border-l-4 border-green-600 pl-8 pb-10" key={s.t}>
            <h2 className="text-2xl font-bold mb-3">{s.t}</h2>
            <p className="muted">{s.d}</p>
          </div>
        ))}
        <Link href="/book" className="btn btn-primary">
          Get started
        </Link>
      </div>
    </>
  );
}
