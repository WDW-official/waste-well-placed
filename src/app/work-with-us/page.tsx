import Link from "next/link";
import Image from "next/image";
import {
  Truck,
  ShieldCheck,
  CalendarDays,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { DRIVER_HERO_IMAGE } from "@/lib/images";
export const metadata = {
  title: "Drive with Waste Well Placed | London and surrounding areas",
};
export default function WorkWithUs() {
  return (
    <>
      <section
        className="driver-recruitment-hero"
        aria-labelledby="driver-hero-title"
      >
        <Image
          className="driver-recruitment-background"
          src={DRIVER_HERO_IMAGE}
          alt="Waste Well Placed driver standing beside a collection vehicle"
          fill
          priority
          sizes="100vw"
        />
        <div className="container driver-recruitment-content">
          <span className="driver-recruitment-eyebrow">WORK WITH US</span>
          <h1 id="driver-hero-title">
            Drive with
            <br />
            <span>Waste Well Placed.</span>
          </h1>
          <p>
            Flexible collection work in London and surrounding areas. Apply with
            your vehicle, tell us when you are available, and complete verified
            waste collections.
          </p>
        </div>
      </section>
      <section className="container section">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-7">
            <Truck size={38} />
            <h2 className="heading mt-5">
              Good work starts with a proper check.
            </h2>
            <p className="muted mt-4">
              We review your driving entitlement, vehicle, insurance, waste
              authorisation and availability before offering work. Applying does
              not guarantee acceptance, jobs or earnings.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link className="btn btn-primary" href="/driver/apply">
                Start your application <ArrowRight size={18} />
              </Link>
              <Link className="btn btn-outline" href="/driver/login">
                Driver sign in
              </Link>
            </div>
          </div>
          <div className="space-y-4">
            {[
              {
                Icon: ShieldCheck,
                title: "Human approval",
                text: "Your documents are checked by our team. Only approved drivers with current documents receive offers.",
              },
              {
                Icon: CalendarDays,
                title: "Availability that works",
                text: "Set your working hours and areas. Review the collection and offered pay before accepting.",
              },
              {
                Icon: ClipboardCheck,
                title: "Clear proof. Clear settlement.",
                text: "Record pickup and delivery evidence. Staff verify facility documentation before earnings can be approved.",
              },
            ].map(({ Icon, title, text }) => (
              <article key={title} className="card p-6">
                <Icon size={26} />
                <h3 className="font-bold mt-3">{title}</h3>
                <p className="muted mt-2">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
