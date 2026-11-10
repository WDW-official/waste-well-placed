"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookingShell } from "@/components/booking-shell";
import { loadDraft, request, type BookingDraft } from "@/lib/booking-client";
import { gbp } from "@/lib/utils";
import { toast } from "sonner";
export default function Checkout() {
  const [d, setD] = useState<BookingDraft | null>(null),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const idempotency = useRef<string>("");
  useEffect(() => {
    setD(loadDraft());
    idempotency.current =
      sessionStorage.getItem("wwp_checkout_key") || crypto.randomUUID();
    sessionStorage.setItem("wwp_checkout_key", idempotency.current);
  }, []);
  if (!d) return <div className="container section">Loading…</div>;
  async function pay() {
    if (!d) return;
    if (!accepted) return toast.error("Please review and accept the terms");
    if (!d.address || !d.holdId || !d.slotId)
      return toast.error("Booking details are incomplete; choose a new slot");
    setBusy(true);
    try {
      const body = {
        kind: d.kind,
        postcode: d.postcode,
        stairs: d.stairs,
        longCarry: d.longCarry,
        specialHandling: d.specialHandling,
        address: d.address,
        contact: d.contact,
        photos: d.photos,
        slotId: d.slotId,
        holdId: d.holdId,
        idempotencyKey: idempotency.current,
        ...(d.kind === "load" ? { loadKey: d.loadKey } : { items: d.items }),
      };
      const booking = await request<{ bookingId: string }>(
        "/api/bookings",
        body,
      );
      const payment = await request<{ url: string }>(
        "/api/payments/initialize",
        { bookingId: booking.bookingId },
      );
      if (!payment.url.startsWith("https://checkout.stripe.com/"))
        throw Error("Invalid checkout destination");
      window.location.assign(payment.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to begin payment");
      setBusy(false);
    }
  }
  return (
    <BookingShell
      step={3}
      title="Review & pay"
      desc="Your price is recalculated server-side. Payment completes via secure Stripe checkout."
    >
      <div className="grid md:grid-cols-[1fr_330px] gap-6">
        <div className="card p-7">
          <h2 className="text-xl font-bold">Collection details</h2>
          {d.contact && (
            <p className="muted mt-3 text-sm">
              {d.contact.name} · {d.contact.email}
              <br />
              {d.contact.phone}
            </p>
          )}
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="font-bold">Collection type</dt>
              <dd>{d.kind === "load" ? "Mixed waste" : "Selected items"}</dd>
            </div>
            <div>
              <dt className="font-bold">Address</dt>
              <dd>
                {d.address?.line1}, {d.address?.city}, {d.address?.postcode}
              </dd>
            </div>
            <div>
              <dt className="font-bold">Preferred date</dt>
              <dd>{d.date || "Selected slot"}</dd>
            </div>
            <div>
              <dt className="font-bold">Items</dt>
              <dd>
                {d.estimate?.lines
                  .map((x) => `${x.qty} × ${x.title}`)
                  .join(", ")}
              </dd>
            </div>
          </dl>
          <label className="flex items-start gap-3 mt-8 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              I have reviewed my collection details and agree to the{" "}
              <Link
                className="underline text-green-800"
                href="/terms"
                target="_blank"
              >
                terms
              </Link>{" "}
              and{" "}
              <Link
                className="underline text-green-800"
                href="/privacy"
                target="_blank"
              >
                privacy information
              </Link>
              .
            </span>
          </label>
        </div>
        <aside className="card p-7 h-fit">
          <h2 className="font-bold text-xl">Order summary</h2>
          <div className="space-y-3 mt-5 text-sm">
            {d.estimate?.lines.map((x) => (
              <div className="flex justify-between gap-3" key={x.title}>
                <span>
                  {x.qty} × {x.title}
                </span>
                <strong>{gbp(x.qty * x.unitMinor)}</strong>
              </div>
            ))}
            <div className="flex justify-between">
              <span>Extra charges</span>
              <span>{gbp(d.estimate?.surchargeMinor || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT</span>
              <span>{gbp(d.estimate?.vatMinor || 0)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-xl border-t pt-4">
              <span>Total</span>
              <span>{d.estimate ? gbp(d.estimate.totalMinor) : "—"}</span>
            </div>
          </div>
          <p className="muted text-xs mt-4">
            Final price is checked again by the server. You need to sign in
            before checkout.
          </p>
          <button
            className="btn btn-primary w-full mt-5"
            disabled={busy || !accepted}
            onClick={pay}
          >
            {busy ? "Preparing checkout…" : "Continue to secure payment"}
          </button>
          <Link
            href="/book/schedule"
            className="block text-center mt-4 text-green-800 underline text-sm"
          >
            Change time
          </Link>
        </aside>
      </div>
    </BookingShell>
  );
}
