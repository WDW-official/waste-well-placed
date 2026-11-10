import Link from "next/link";
import Image from "next/image";
import { HeroBooking } from "@/components/hero-booking";
import { SERVICES, DEFAULT_FAQS } from "@/lib/constants";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Truck,
  Recycle,
  Camera,
  Leaf,
  Phone,
  MessageCircle,
  Check,
  ClipboardCheck,
  Armchair,
  ShieldCheck,
} from "lucide-react";
import { FAQ } from "@/components/faq";
import { phoneHref, whatsappHref } from "@/lib/contact";

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="container home-hero-grid">
          <div className="hero-intro">
            <span className="eyebrow hero-eyebrow">
              <span className="status-dot" /> A FRESH START FOR YOUR SPACE
            </span>
            <h1>
              Goodbye clutter.
              <br />
              Hello, <span>breathing room.</span>
            </h1>
            <p>
              Rubbish removal for your home or business.
              <br className="desktop-break" /> Simply booked. Thoughtfully
              collected.
            </p>
            <div className="hero-benefits">
              <span>
                <CalendarDays size={17} />
                Simple online booking
              </span>
              <span>
                <Recycle size={17} />
                Responsible disposal
              </span>
              <span>
                <Check size={17} />
                Clear pricing
              </span>
            </div>
          </div>
          <div className="hero-photo">
            <Image
              src="/images/hero-team.jpg"
              alt="Waste Well Placed collection team and van illustration"
              width={766}
              height={510}
              priority
              sizes="(max-width: 767px) 130px, 45vw"
            />
            <div className="hero-photo-caption">
              <span className="photo-caption-icon">
                <Leaf size={23} />
              </span>
              <div>
                <strong>Less waste. More possibility.</strong>
                <span>A little care makes a big difference.</span>
              </div>
            </div>
            <span className="photo-credit">Brand illustration</span>
          </div>
          <div className="hero-booking-wrap">
            <HeroBooking />
          </div>
        </div>
        <div className="container">
          <div className="brand-strip">
            <span className="brand-strip-icon">
              <Recycle size={28} />
            </span>
            <p>
              A clearer space. A lighter footprint.{" "}
              <strong>Waste, well placed.</strong>
            </p>
            <Link href="/about">
              Meet your fresh start <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section" id="services">
        <div className="container">
          <div className="section-top">
            <div>
              <span className="eyebrow">A PLACE FOR EVERYTHING</span>
              <h2 className="section-title">
                What can we take off your hands?
              </h2>
              <p className="section-description">
                One bulky item or a whole new beginning. We’ll help you clear
                it.
              </p>
            </div>
            <Link className="text-link" href="/services">
              All services <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="home-services">
            {SERVICES.map((service, i) => (
              <Link
                className="home-service-card"
                key={service.slug}
                href={
                  i >= 4
                    ? "/business/enquire"
                    : i === 0
                      ? "/book/load"
                      : "/book/items"
                }
              >
                <div className="service-image">
                  <Image
                    src={service.image}
                    alt={service.title}
                    width={220}
                    height={128}
                    sizes="(max-width: 767px) 42vw, 15vw"
                  />
                </div>
                <h3>{i === 0 ? "Rubbish clearance" : service.title}</h3>
                <p>{service.subtitle}</p>
                <span>
                  {i >= 4 ? "Enquire now" : "Book a collection"}
                  <ArrowRight size={17} />
                </span>
              </Link>
            ))}
          </div>
          <div className="photo-quote-banner">
            <div className="quote-banner-icon">
              <Camera size={34} strokeWidth={1.5} />
            </div>
            <div className="quote-banner-copy">
              <h3>
                Not sure where to start<span>?</span>
              </h3>
              <p>
                A few photos can say a lot. Send yours for a personalised quote.
              </p>
            </div>
            <div className="quote-banner-actions">
              <Link href="/book/photo-quote" className="btn btn-white">
                <Camera size={19} />
                Upload photos
              </Link>
              <a href={whatsappHref} className="banner-contact">
                <MessageCircle size={20} />
                {whatsappHref.startsWith("https:")
                  ? "Send on WhatsApp"
                  : "Talk to our team"}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section steps-section" id="how-it-works">
        <div className="container">
          <span className="eyebrow">SMALL EFFORT. BIG DIFFERENCE.</span>
          <h2 className="section-title">
            Ready. Set. <span>Clear.</span>
          </h2>
          <p className="section-description">
            Your space back, in three simple steps.
          </p>
          <div className="home-steps">
            {[
              {
                Icon: CalendarDays,
                title: "A few clicks. All booked.",
                description:
                  "Choose your items or load size, add your address and pick an available collection time.",
              },
              {
                Icon: Truck,
                title: "Leave the lifting to us.",
                description:
                  "Your collection team handles the booked waste. Just show us what needs to go.",
              },
              {
                Icon: Recycle,
                title: "Room for what’s next.",
                description:
                  "Enjoy your clearer space while we arrange responsible handling of your waste.",
              },
            ].map(({ Icon, title, description }, i) => (
              <article className="home-step" key={title}>
                <div className="step-top">
                  <span>0{i + 1}</span>
                  <Icon size={27} strokeWidth={1.4} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container editorial-row">
          <div
            className="booking-illustration"
            aria-label="Illustration of an online collection booking"
          >
            <div className="illustration-orbit orbit-one" />
            <div className="illustration-orbit orbit-two" />
            <span className="illustration-spark spark-one">✳</span>
            <span className="illustration-spark spark-two">✳</span>
            <div className="phone-mockup">
              <div className="phone-speaker" />
              <div className="phone-brand">
                <Recycle size={17} />
                waste well placed<span>●</span>
              </div>
              <div className="phone-heading">
                Good things
                <br />
                are on their way<span>.</span>
              </div>
              <div className="phone-collection-art">
                <Truck size={95} strokeWidth={1} />
                <span className="phone-art-leaf">
                  <Leaf size={21} />
                </span>
              </div>
              <div className="phone-confirmation">
                <span>
                  <Check size={17} />
                </span>
                <div>
                  <strong>Your space, reclaimed.</strong>
                  <small>A simpler way to book a collection</small>
                </div>
              </div>
              <div className="phone-summary">
                <span>YOUR COLLECTION</span>
                <div>
                  <Armchair size={25} />
                  <div>
                    <strong>Furniture removal</strong>
                    <small>One less thing on your list.</small>
                  </div>
                  <Check size={15} />
                </div>
              </div>
              <div className="phone-home-bar" />
            </div>
            <div className="illustration-label">
              <ClipboardCheck size={22} />
              <div>
                <strong>A little less life admin.</strong>
                <span>Everything in one place.</span>
              </div>
            </div>
          </div>
          <div className="editorial-copy">
            <span className="eyebrow">CLEAR SPACE. CLEAR HEAD.</span>
            <h2 className="section-title">
              Good for your home.
              <br />
              Easy on your day.
            </h2>
            <p>
              That sofa you’ve been meaning to move. The boxes taking over the
              spare room. The office ready for its next chapter.
            </p>
            <p>
              Whatever your fresh start looks like, we make arranging a
              collection straightforward—with clear details, available time
              slots and your booking records in one place.
            </p>
            <Link href="/book" className="text-link">
              Let’s make some room <ArrowRight size={19} />
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container editorial-row editorial-reverse">
          <div className="editorial-copy">
            <span className="eyebrow">PEOPLE, NOT JUST PICKUPS</span>
            <h2 className="section-title">
              A helping hand.
              <br />
              From start to finish.
            </h2>
            <p>
              Not sure which load size fits? Need to talk through a bigger
              clearance? Ask us. We’ll help you find the right next step.
            </p>
            <p>
              Visit our FAQs for the everyday questions, or get in touch with
              the team about your collection.
            </p>
            <div className="editorial-actions">
              <a className="btn btn-outline" href={phoneHref}>
                <Phone size={18} />
                {phoneHref.startsWith("tel:") ? "Call our team" : "Contact us"}
              </a>
              <Link className="text-link" href="/faq">
                Browse FAQs <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
          <div className="care-panel">
            <span className="care-panel-word">
              A little
              <br />
              less clutter.
              <br />
              <em>
                A lot more
                <br />
                possibility.
              </em>
            </span>
            <div className="care-panel-footer">
              <Leaf size={29} />
              <span>
                THOUGHTFUL COLLECTION.
                <br />A FRESH PERSPECTIVE.
              </span>
            </div>
            <div className="care-circle" />
          </div>
        </div>
      </section>

      <section className="home-section expectations-section">
        <div className="container">
          <div className="section-top">
            <div>
              <span className="eyebrow">THE LITTLE THINGS THAT MATTER</span>
              <h2 className="section-title">A better way to make space.</h2>
              <p className="section-description">
                Straightforward service, from the first click to the final lift.
              </p>
            </div>
          </div>
          <div className="expectation-grid">
            {[
              {
                Icon: ClipboardCheck,
                title: "Clarity comes first.",
                text: "Review your collection details and calculated price before you pay.",
                tag: "NO GUESSWORK",
              },
              {
                Icon: CalendarDays,
                title: "Fits around your day.",
                text: "Choose from the collection times available in your postcode area.",
                tag: "YOUR TIME MATTERS",
              },
              {
                Icon: Camera,
                title: "A bigger job? Just ask.",
                text: "Send us photos for a quote when your clearance needs a closer look.",
                tag: "A PERSONAL TOUCH",
              },
              {
                Icon: Recycle,
                title: "Care beyond collection.",
                text: "Responsible waste handling and collection records in your account.",
                tag: "THOUGHTFULLY HANDLED",
              },
            ].map(({ Icon, title, text, tag }) => (
              <article key={title} className="expectation-card">
                <Icon size={26} strokeWidth={1.5} />
                <h3>{title}</h3>
                <p>{text}</p>
                <span>{tag}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container planet-panel">
          <div>
            <span className="eyebrow">LESS LEFT BEHIND</span>
            <h2 className="section-title">
              Your unwanted things.
              <br />
              Our thoughtful approach.
            </h2>
            <p>
              Clearing your space should feel good. We focus on responsible
              handling and keeping useful materials in circulation where
              possible.
            </p>
            <Link className="text-link" href="/about">
              More about our approach <ArrowRight size={18} />
            </Link>
          </div>
          <div className="planet-points">
            {[
              { Icon: Leaf, label: "Mindful waste handling" },
              { Icon: Recycle, label: "Reuse and recycling where possible" },
              { Icon: ShieldCheck, label: "Clear collection records" },
            ].map(({ Icon, label }) => (
              <div key={label}>
                <span>
                  <Icon size={23} />
                </span>
                {label}
                <Check size={17} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-faq">
        <div className="container faq-layout">
          <div>
            <span className="eyebrow">LET’S CLEAR THINGS UP</span>
            <h2 className="section-title">
              Good questions.
              <br />
              Clear answers.
            </h2>
            <p className="section-description">
              A few things you might be wondering.
            </p>
            <Link href="/faq" className="text-link">
              All your questions answered <ArrowUpRight size={17} />
            </Link>
          </div>
          <FAQ items={DEFAULT_FAQS} />
        </div>
      </section>
      <section className="closing-section">
        <div className="container closing-panel">
          <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
          <h2>
            A fresh start
            <br />
            looks good on you<span>.</span>
          </h2>
          <p>Start with your postcode. We’ll take it from there.</p>
          <Link href="/book" className="btn btn-primary">
            Book your collection <ArrowRight size={20} />
          </Link>
          <Recycle className="closing-mark" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
