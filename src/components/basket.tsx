"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  MessageCircle,
  X,
  Phone,
  ArrowUpRight,
} from "lucide-react";
import { loadDraft } from "@/lib/booking-client";
import { phoneHref, whatsappHref } from "@/lib/contact";

export function useBasket() {
  const pathname = usePathname();
  const [basket, setBasket] = useState({ count: 0, href: "/book" });
  useEffect(() => {
    function sync() {
      const draft = loadDraft();
      const count =
        draft.kind === "items"
          ? (draft.items || []).reduce((sum, item) => sum + item.qty, 0)
          : draft.selected
            ? 1
            : 0;
      setBasket({
        count,
        href: count
          ? draft.holdId && draft.estimate
            ? "/book/checkout"
            : "/book/details"
          : "/book",
      });
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("wwp-draft-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("wwp-draft-change", sync);
    };
  }, [pathname]);
  return basket;
}

export function FloatingActions() {
  const pathname = usePathname();
  const { count, href } = useBasket();
  const [support, setSupport] = useState(false);
  if (/^\/(book\/|account|admin|crew|portal)/.test(pathname)) return null;
  return (
    <div className={`floating-actions ${count ? "has-basket" : ""}`}>
      {support && (
        <div className="support-popover">
          <button
            type="button"
            className="support-close"
            aria-label="Close support"
            onClick={() => setSupport(false)}
          >
            <X size={18} />
          </button>
          <span className="eyebrow">A LITTLE HELP GOES A LONG WAY</span>
          <h3>Let’s clear things up.</h3>
          <p>Questions about your collection? We’re happy to help.</p>
          <a className="btn btn-dark" href={phoneHref}>
            <Phone size={17} />
            {phoneHref.startsWith("tel:") ? "Call us" : "Contact our team"}
          </a>
          {whatsappHref.startsWith("https:") && (
            <a
              className="support-whatsapp"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} /> WhatsApp <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      )}
      <button
        type="button"
        className="support-toggle"
        aria-expanded={support}
        aria-label={support ? "Close help" : "Get help with your collection"}
        onClick={() => setSupport(!support)}
      >
        {support ? <X /> : <MessageCircle size={25} />}
      </button>
      {count > 0 && (
        <div className="floating-checkout">
          <Link className="btn btn-primary" href={href}>
            <ShoppingCart size={21} />
            Continue booking<span className="basket-count">{count}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
