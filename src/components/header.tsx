"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, ShoppingCart, ArrowRight } from "lucide-react";
import { SERVICES } from "@/lib/constants";
import { useBasket } from "./basket";

export function Header() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const { count, href } = useBasket();
  useEffect(() => {
    dialog.current?.close();
    document.body.style.overflow = "";
  }, [pathname]);
  useEffect(
    () => () => {
      document.body.style.overflow = "";
    },
    [],
  );
  function close() {
    dialog.current?.close();
    document.body.style.overflow = "";
  }
  if (
    pathname.startsWith("/book/") &&
    !["/book/photo-quote", "/book/quote-received"].includes(pathname)
  )
    return null;
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Open navigation"
            onClick={() => {
              dialog.current?.showModal();
              document.body.style.overflow = "hidden";
            }}
          >
            <Menu size={27} />
          </button>
          <Link href="/" aria-label="Waste Well Placed home" className="brand">
            <Image
              src="https://res.cloudinary.com/cfgipbsv/image/upload/v1794313846/Waste_Well_Placed_Logo.png"
              alt="Waste Well Placed"
              width={1448}
              height={1086}
              priority
            />
          </Link>
          <nav className="header-nav" aria-label="Main navigation">
            <details className="nav-dropdown">
              <summary>
                Our services <ChevronDown size={15} />
              </summary>
              <div className="nav-dropdown-panel">
                {SERVICES.map((s) => (
                  <Link key={s.slug} href={`/services/${s.slug}`}>
                    {s.title}
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </details>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/faq">FAQs</Link>
            <Link href="/business">For businesses</Link>
          </nav>
          <div className="header-actions">
            <Link href="/login" className="btn btn-outline login-link">
              Log in
            </Link>
            <Link href="/contact" className="btn btn-primary header-contact">
              Contact us <ArrowRight size={17} />
            </Link>
            <Link
              href={href}
              className="btn btn-dark header-basket"
              aria-label={`Basket, ${count} selected ${count === 1 ? "item" : "items"}`}
            >
              <ShoppingCart size={21} />
              <span className="basket-label">Basket</span>
              {count > 0 && <span className="basket-count">{count}</span>}
            </Link>
          </div>
        </div>
      </header>
      <dialog
        ref={dialog}
        className="navigation-drawer"
        onClose={() => {
          document.body.style.overflow = "";
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        aria-label="Navigation"
      >
        <div className="drawer-inner">
          <div className="drawer-top">
            <Link href="/" onClick={close}>
              <Image
                src="https://res.cloudinary.com/cfgipbsv/image/upload/v1794313846/Waste_Well_Placed_Logo.png"
                alt="Waste Well Placed"
                width={1448}
                height={1086}
              />
            </Link>
            <button type="button" aria-label="Close navigation" onClick={close}>
              <X size={25} />
            </button>
          </div>
          <nav aria-label="Mobile navigation">
            <Link className="drawer-service" href="/book/load" onClick={close}>
              <Image
                src="/images/general-waste.jpg"
                alt=""
                width={85}
                height={65}
              />
              <div>
                <strong>Rubbish clearance</strong>
                <span>Bags, boxes and everyday clutter. Let’s make space.</span>
              </div>
              <ArrowRight size={18} />
            </Link>
            <Link className="drawer-service" href="/book/items" onClick={close}>
              <Image
                src="/images/furniture.jpg"
                alt=""
                width={85}
                height={65}
              />
              <div>
                <strong>Single or multiple items</strong>
                <span>Find your furniture, appliances and bulky items.</span>
              </div>
              <ArrowRight size={18} />
            </Link>
            <details className="drawer-category">
              <summary>
                <Image src="/images/office.jpg" alt="" width={85} height={65} />
                <div>
                  <strong>Home & office clearances</strong>
                  <span>A fresh start for your whole space.</span>
                </div>
                <ChevronDown size={19} />
              </summary>
              <div className="drawer-subservices">
                {SERVICES.slice(4).map((s) => (
                  <Link
                    href={`/services/${s.slug}`}
                    key={s.slug}
                    onClick={close}
                  >
                    <Image src={s.image} alt="" width={120} height={90} />
                    {s.title}
                  </Link>
                ))}
              </div>
            </details>
            {[
              ["How it works", "/how-it-works"],
              ["FAQs", "/faq"],
              ["For businesses", "/business"],
              ["Contact us", "/contact"],
            ].map(([label, url]) => (
              <Link
                className="drawer-link"
                key={url}
                href={url}
                onClick={close}
              >
                {label}
                <ArrowRight size={17} />
              </Link>
            ))}
          </nav>
          <div className="drawer-bottom">
            <span className="eyebrow">LESS CLUTTER. MORE LIVING.</span>
            <h3>
              Your next fresh start
              <br />
              is a few clicks away.
            </h3>
            <Link href="/book" className="btn btn-primary" onClick={close}>
              Book a collection <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
