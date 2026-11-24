"use client";
import { AddressLookup } from "./address-lookup";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, localDate } from "@/lib/operations/client";
import { PlatformShell } from "@/components/platform-shell";
import { Select } from "@/components/select";
import { gbp } from "@/lib/utils";
type Quote = {
  _id: string;
  reference: string;
  status: string;
  version: number;
  totalMinor?: number;
  priceMinor?: number;
  vatMinor?: number;
  validUntil?: string;
  bookingId?: string;
  address?: { line1?: string; city?: string; postcode?: string };
  details?: { notes?: string };
  customer?: { email?: string };
  photos: { secureUrl: string }[];
  lineItems?: { description: string; qty: number; unitMinor: number }[];
};
export function CustomerQuote({ id, token }: { id: string; token: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [address, setAddress] = useState({ line1: "", city: "", postcode: "" });
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ id: string; start: string }[]>([]);
  const [slotId, setSlotId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/api/quotes/${id}?token=${encodeURIComponent(token)}`;
  async function load() {
    try {
      const data = await api<{ quote: Quote }>(url);
      setQuote(data.quote);
      setAddress({
        line1: data.quote.address?.line1 ?? "",
        city: data.quote.address?.city ?? "",
        postcode: data.quote.address?.postcode ?? "",
      });
      setUser(
        (await api<{ user: { email: string } | null }>("/api/auth/me")).user,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Quotation unavailable",
      );
    }
  }
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
  async function pay(bookingId: string) {
    const data = await api<{ url: string }>("/api/payments/initialize", {
      bookingId,
    });
    window.location.assign(data.url);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to continue",
      );
    } finally {
      setBusy(false);
    }
  }
  const next = `/quote/${id}?token=${encodeURIComponent(token)}`;
  return (
    <PlatformShell
      title={quote?.reference ?? "Your quotation"}
      subtitle="Review your request and collection quotation."
    >
      <div className="platform-stack">
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {!quote && !error && <p role="status">Loading your request…</p>}
        {quote && (
          <>
            <section className="platform-card">
              <span className="platform-badge">
                {quote.status === "new"
                  ? "Request submitted"
                  : quote.status.replaceAll("_", " ")}
              </span>
              <h2>
                {quote.status === "awaiting_customer"
                  ? "Your collection quote is ready."
                  : quote.status === "accepted"
                    ? "Your quote has been accepted."
                    : "Thanks. We have your request."}
              </h2>
              <p>{quote.details?.notes}</p>
              <p>
                {quote.status === "new" || quote.status === "reviewing"
                  ? "Our team is reviewing your request. This is not yet a confirmed collection."
                  : "A collection is confirmed after your payment is verified."}
              </p>
              {quote.totalMinor !== undefined && (
                <>
                  {quote.lineItems?.map((line, index) => (
                    <p key={index}>
                      {line.qty} × {line.description}:{" "}
                      {gbp(line.qty * line.unitMinor)}
                    </p>
                  ))}
                  <strong className="platform-price">
                    {gbp(quote.totalMinor)}
                  </strong>
                  <p>
                    Collection before VAT: {gbp(quote.priceMinor ?? 0)} · VAT:{" "}
                    {gbp(quote.vatMinor ?? 0)}
                  </p>
                  <p>Quote expiry: {localDate(quote.validUntil)}</p>
                </>
              )}
              <div className="platform-photos">
                {quote.photos.map((photo) => {
                  const href = photo.secureUrl.startsWith("/api/assets/")
                    ? `${photo.secureUrl}?token=${encodeURIComponent(token)}`
                    : photo.secureUrl;
                  return (
                    <a key={href} href={href} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={href} alt="Your submitted waste" />
                    </a>
                  );
                })}
              </div>
            </section>
            {quote.status === "awaiting_customer" && (
              <section className="platform-card">
                <h2>Choose your collection</h2>
                {!user ? (
                  <p>
                    <Link
                      className="btn btn-primary mt-4"
                      href={`/login?next=${encodeURIComponent(next)}`}
                    >
                      Sign in to accept and book
                    </Link>
                    <br />
                    Use the email on your quotation: {quote.customer?.email}
                  </p>
                ) : (
                  <form
                    className="platform-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        if (!slotId)
                          throw Error("Choose an available slot first");
                        const hold = await api<{ holdId: string }>(
                          "/api/slot-holds",
                          { slotId },
                        );
                        const booked = await api<{ bookingId: string }>(url, {
                          action: "accept",
                          version: quote.version,
                          address: { ...address, notes: "" },
                          slotId,
                          holdId: hold.holdId,
                        });
                        await pay(booked.bookingId);
                      });
                    }}
                  >
                    <AddressLookup
                      value={address.postcode}
                      manualInputId="quote-customer-line1"
                      onPostcodeChange={(value) => {
                        setAddress((current) => ({
                          ...current,
                          postcode: value,
                          ...(value.replace(/\s/g, "").toUpperCase() !==
                          current.postcode.replace(/\s/g, "").toUpperCase()
                            ? { line1: "", city: "" }
                            : {}),
                        }));
                        setSlots([]);
                        setSlotId("");
                      }}
                      onSelect={(selected) => {
                        setAddress((current) => ({
                          ...current,
                          city: selected.city,
                          postcode: selected.postcode,
                        }));
                        setSlots([]);
                        setSlotId("");
                      }}
                    />
                    <div className="platform-form-grid">
                      {[
                        ["line1", "Street address"],
                        ["city", "Town / city / area"],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            className="input"
                            id={`quote-customer-${key}`}
                            required
                            value={address[key as keyof typeof address]}
                            onChange={(event) => {
                              setAddress({
                                ...address,
                                [key]: event.target.value,
                              });
                              setSlots([]);
                              setSlotId("");
                            }}
                          />
                        </label>
                      ))}
                      <label>
                        Preferred date
                        <input
                          className="input"
                          type="date"
                          required
                          value={date}
                          onChange={(event) => {
                            setDate(event.target.value);
                            setSlots([]);
                            setSlotId("");
                          }}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy || !date || !address.postcode}
                      onClick={() =>
                        void run(async () => {
                          const response = await api<{
                            slots: { id: string; start: string }[];
                          }>(
                            `/api/slots?postcode=${encodeURIComponent(address.postcode)}&date=${date}`,
                          );
                          setSlots(response.slots);
                          if (!response.slots.length)
                            throw Error(
                              "No available slots for this date and postcode",
                            );
                        })
                      }
                    >
                      Check available times
                    </button>
                    {!!slots.length && (
                      <label>
                        Collection time
                        <Select
                          value={slotId}
                          onValueChange={setSlotId}
                          options={slots.map((slot) => ({
                            value: slot.id,
                            label: localDate(slot.start),
                          }))}
                        />
                      </label>
                    )}
                    <button
                      className="btn btn-primary"
                      disabled={busy || !slotId}
                    >
                      Accept quote & continue to payment
                    </button>
                  </form>
                )}
                <button
                  className="btn btn-outline mt-5"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(url, {
                        action: "decline",
                        version: quote.version,
                      });
                      await load();
                    })
                  }
                >
                  Decline this quotation
                </button>
              </section>
            )}
            {quote.status === "accepted" && quote.bookingId && (
              <div className="platform-card">
                <Link
                  className="btn btn-outline"
                  href={`/account/bookings/${quote.bookingId}`}
                >
                  View collection status
                </Link>
                {user && (
                  <button
                    className="btn btn-primary mt-4"
                    disabled={busy}
                    onClick={() => void run(() => pay(quote.bookingId!))}
                  >
                    Continue payment if unpaid
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PlatformShell>
  );
}
