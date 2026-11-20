import Link from "next/link";
import Image from "next/image";
import { SERVICES } from "@/lib/constants";
import { PublicCompany } from "./public-company";
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link
            href="/"
            className="footer-brand"
            aria-label="Waste Well Placed home"
          >
            <Image
              src="https://res.cloudinary.com/cfgipbsv/image/upload/v1794313846/Waste_Well_Placed_Logo.png"
              alt="Waste Well Placed"
              width={1448}
              height={1086}
              className="footer-brand-logo"
            />
          </Link>
          <p className="text-green-100 max-w-sm">
            Thoughtful collection. Responsible disposal. Clear pricing and a
            simpler booking experience for homes and businesses in London and
            surrounding areas.
          </p>
          <PublicCompany />
        </div>
        <div>
          <h3 className="font-bold mb-3">Services</h3>
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              className="block py-1 text-sm"
              href={`/services/${s.slug}`}
            >
              {s.title}
            </Link>
          ))}
        </div>
        <div>
          <h3 className="font-bold mb-3">Explore</h3>
          {[
            ["How it works", "/how-it-works"],
            ["Areas", "/areas"],
            ["Business", "/business"],
            ["Reviews", "/reviews"],
            ["Blog", "/blog"],
            ["About us", "/about"],
            ["Work with us", "/work-with-us"],
            ["Driver sign in", "/driver/login"],
          ].map(([n, h]) => (
            <Link key={h} className="block py-1 text-sm" href={h}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h3 className="font-bold mb-3">Help & legal</h3>
          {[
            ["Contact", "/contact"],
            ["FAQs", "/faq"],
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Customer account", "/account"],
          ].map(([n, h]) => (
            <Link key={h} className="block py-1 text-sm" href={h}>
              {n}
            </Link>
          ))}
        </div>
      </div>
      <div className="container border-t border-green-700 mt-10 pt-5 text-sm text-green-100 flex justify-between flex-wrap gap-3">
        <span>
          © {new Date().getFullYear()} Waste Well Placed. All rights reserved.
        </span>
        <span>Prices and availability subject to confirmation.</span>
      </div>
    </footer>
  );
}
