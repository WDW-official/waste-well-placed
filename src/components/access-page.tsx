import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Leaf } from "lucide-react";
import { HERO_IMAGE, DRIVER_HERO_IMAGE } from "@/lib/images";

export function AccessPage({
  children,
  driver = false,
}: {
  children: React.ReactNode;
  driver?: boolean;
}) {
  return (
    <section className="access-page">
      <div className="access-layout">
        <div className="access-welcome">
          <Link href="/" className="access-back" aria-label="Back to home">
            <ArrowLeft size={18} aria-hidden="true" /> <span>Back to home</span>
          </Link>
          <div className="access-welcome-copy">
            <span className="access-eyebrow">
              <Leaf size={15} />{" "}
              {driver ? "YOUR DRIVER SPACE" : "YOUR NEXT FRESH START"}
            </span>
            <h1>
              {driver ? (
                <>
                  Good work.
                  <br />
                  <span>Ahead of you.</span>
                </>
              ) : (
                <>
                  Less clutter.
                  <br />
                  <span>More possibilities.</span>
                </>
              )}
            </h1>
            <p>
              {driver
                ? "Your application, collections and earnings. All together, whenever you need them."
                : "A little more space, a little less to think about. Manage your collections in one simple place."}
            </p>
            <ul>
              {(driver
                ? [
                    "Pick up where your application left off",
                    "Keep your collection details close",
                  ]
                : [
                    "Book and manage your collections",
                    "Keep track of your quotes and bookings",
                  ]
              ).map((text) => (
                <li key={text}>
                  <Check size={16} /> {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="access-photo">
            <Image
              src={driver ? DRIVER_HERO_IMAGE : HERO_IMAGE}
              alt=""
              fill
              sizes="(max-width: 767px) 1px, 500px"
            />
          </div>
        </div>
        <div className="access-forms">
          {children}
          <p className="access-privacy">
            Your space. Your details.{" "}
            <Link href="/privacy">Our privacy promise</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
