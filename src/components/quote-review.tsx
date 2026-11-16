"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, moneyInput, localDate } from "@/lib/operations/client";
import { parseQuoteLines } from "@/lib/operations/quote-lines";
import { gbp } from "@/lib/utils";
import { Select } from "@/components/select";
type Quote = {
  _id: string;
  reference: string;
  version: number;
  status: string;
  customer?: { name?: string; email?: string; phone?: string };
  details?: {
    notes?: string;
    timing?: string;
    collectionDetails?: {
      propertyType?: string;
      floor?: string;
      parking?: string;
    };
  };
  address?: { line1?: string; city?: string; postcode?: string };
  photos: { secureUrl: string }[];
  priceMinor?: number;
  vatMinor?: number;
  totalMinor?: number;
  validUntil?: string;
  bookingId?: string;
};
export function QuoteReview({ id }: { id: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("reviewing");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setQuote(
        (await api<{ quote: Quote }>(`/api/operations/quotes/${id}`)).quote,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Quote unavailable",
      );
    }
  }
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!quote) return <p role="status">{error || "Loading quotation…"}</p>;
  return (
    <div className="platform-stack">
      <section className="platform-card">
        <div className="platform-card-heading">
          <h2>{quote.reference}</h2>
          <span className="platform-badge">{quote.status}</span>
        </div>
        <p>
          {quote.customer?.name} ·{" "}
          <a href={`mailto:${quote.customer?.email}`}>
            {quote.customer?.email}
          </a>{" "}
          · <a href={`tel:${quote.customer?.phone}`}>{quote.customer?.phone}</a>
        </p>
        <p>
          {[quote.address?.line1, quote.address?.city, quote.address?.postcode]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p>{quote.details?.notes}</p>
        <p>
          Timing: {quote.details?.timing?.replaceAll("-", " ")} · Property:{" "}
          {quote.details?.collectionDetails?.propertyType} · Floor:{" "}
          {quote.details?.collectionDetails?.floor}
        </p>
        <p>Parking: {quote.details?.collectionDetails?.parking}</p>
        <p>
          Current price:{" "}
          {quote.totalMinor !== undefined
            ? gbp(quote.totalMinor)
            : "Not yet quoted"}{" "}
          · Expiry: {localDate(quote.validUntil)}
        </p>
        {quote.bookingId && (
          <Link
            className="btn btn-outline mt-4"
            href={`/admin/jobs/${quote.bookingId}`}
          >
            Open linked collection
          </Link>
        )}
      </section>
      <section className="platform-card">
        <h2>Customer originals</h2>
        <div className="platform-photos">
          {quote.photos.map((photo) => (
            <a
              key={photo.secureUrl}
              href={photo.secureUrl}
              target="_blank"
              rel="noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.secureUrl} alt="Customer waste for quotation" />
            </a>
          ))}
        </div>
        {!quote.photos.length && <p>No customer photos were supplied.</p>}
      </section>
      {!["accepted", "rejected", "expired"].includes(quote.status) && (
        <form
          className="platform-card platform-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const values = new FormData(event.currentTarget);
            try {
              const lines =
                status === "awaiting_customer"
                  ? parseQuoteLines(String(values.get("lines")))
                  : [];
              await api(
                `/api/admin/quotes/${id}`,
                {
                  status,
                  version: quote.version ?? 0,
                  ...(status === "awaiting_customer"
                    ? {
                        lineItems: lines,
                        priceMinor: lines.reduce(
                          (sum, line) => sum + line.qty * line.unitMinor,
                          0,
                        ),
                        vatMinor: moneyInput(values.get("vat")),
                        validUntil: new Date(
                          String(values.get("expiry")),
                        ).toISOString(),
                      }
                    : {}),
                  note: String(values.get("note")),
                },
                "PATCH",
              );
              await load();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Quote update failed",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Review & issue quotation</h2>
          <label>
            Action
            <Select
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "reviewing", label: "Reviewing / follow-up needed" },
                {
                  value: "awaiting_customer",
                  label: "Publish price and send secure customer link",
                },
                { value: "rejected", label: "Decline request" },
                { value: "expired", label: "Expire quotation" },
              ]}
            />
          </label>
          {status === "awaiting_customer" && (
            <div className="platform-form-grid">
              <label>
                Itemised charges (description | quantity | unit price in GBP)
                <textarea
                  className="input"
                  name="lines"
                  placeholder={
                    "Collection | 1 | 120.00\nAccess supplement | 1 | 15.00"
                  }
                  required
                />
              </label>
              <label>
                Applicable VAT amount (£)
                <input
                  className="input"
                  type="number"
                  name="vat"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Quote expiry (your device local time)
                <input
                  className="input"
                  type="datetime-local"
                  name="expiry"
                  required
                />
              </label>
            </div>
          )}
          <label>
            Review / pricing notes
            <textarea className="input" name="note" maxLength={1000} required />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Save review
          </button>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
