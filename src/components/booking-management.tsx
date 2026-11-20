"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
import { gbp } from "@/lib/utils";
import { Select } from "./select";
type Data = {
  booking: {
    address?: { postcode?: string };
    paymentStatus: string;
    paidMinor?: number;
    price?: { totalMinor?: number };
    refundsMinor?: number;
  };
  requests: {
    _id: string;
    kind: string;
    reason: string;
    preferredDate?: string;
    status: string;
    reviewNote?: string;
  }[];
  refunds: {
    _id: string;
    amountMinor: number;
    status: string;
    failure?: string;
    providerRef?: string;
  }[];
  canReview: boolean;
  canRefund: boolean;
};
export function BookingManagement({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [slots, setSlots] = useState<{ id: string; start: string }[]>([]),
    [slot, setSlot] = useState("");
  const load = useCallback(async () => {
    setData(await api<Data>(`/api/operations/bookings/${id}/changes`));
  }, [id]);
  useEffect(() => {
    void load().catch((failure) => setError(failure.message));
  }, [load]);
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/operations/bookings/${id}/changes`, body);
      setMessage("Saved.");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p role="status">{error || "Loading booking changes…"}</p>;
  return (
    <section className="platform-card mt-6">
      <h2>Booking changes & refunds</h2>
      {data.requests.length === 0 && <p>No customer change requests.</p>}
      {data.requests.map((row) => (
        <div key={row._id} className="border-b py-4">
          <h3>
            {row.kind}: {row.status}
          </h3>
          <p>{row.reason}</p>
          {row.preferredDate && <p>Preferred date: {row.preferredDate}</p>}
          {row.reviewNote && <p>{row.reviewNote}</p>}
          {row.status === "pending" && data.canReview && (
            <form
              className="platform-form mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void run({
                  action: "review",
                  requestId: row._id,
                  approved:
                    (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                      "value",
                    ) === "approve",
                  note: form.get("note"),
                  ...(row.kind === "reschedule" && slot
                    ? { slotId: slot }
                    : {}),
                });
              }}
            >
              {row.kind === "reschedule" && (
                <>
                  <label>
                    Find available collection slots
                    <input
                      className="input"
                      type="date"
                      onChange={async (event) => {
                        setSlot("");
                        try {
                          const result = await api<{
                            slots: { id: string; start: string }[];
                          }>(
                            `/api/slots?postcode=${encodeURIComponent(data.booking.address?.postcode ?? "")}&date=${event.target.value}`,
                          );
                          setSlots(result.slots);
                        } catch (failure) {
                          setError(
                            failure instanceof Error
                              ? failure.message
                              : "Unable to load slots",
                          );
                        }
                      }}
                    />
                  </label>
                  <Select
                    value={slot}
                    onValueChange={setSlot}
                    options={[
                      { value: "", label: "Choose new slot", disabled: true },
                      ...slots.map((value) => ({
                        value: value.id,
                        label: new Date(value.start).toLocaleString("en-GB", {
                          timeZone: "Europe/London",
                        }),
                      })),
                    ]}
                  />
                </>
              )}
              <label>
                Review notes
                <textarea
                  className="input"
                  name="note"
                  required
                  minLength={5}
                />
              </label>
              <div className="platform-actions">
                <button
                  className="btn btn-primary"
                  name="decision"
                  value="approve"
                  disabled={busy}
                >
                  Approve request
                </button>
                <button
                  className="btn btn-outline"
                  name="decision"
                  value="reject"
                  disabled={busy}
                >
                  Decline request
                </button>
              </div>
            </form>
          )}
        </div>
      ))}
      {data.canRefund &&
        ["paid", "refunded"].includes(data.booking.paymentStatus) && (
          <form
            className="platform-form mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run({
                action: "refund",
                amountMinor: Math.round(Number(form.get("amount")) * 100),
                note: form.get("note"),
              });
            }}
          >
            <h3>Request a Stripe refund</h3>
            <p>
              Refunded so far: {gbp(data.booking.refundsMinor ?? 0)}. Approved
              refunds are queued for provider processing.
            </p>
            <label>
              Refund amount (£)
              <input
                className="input"
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
              />
            </label>
            <label>
              Reason
              <textarea className="input" name="note" required minLength={5} />
            </label>
            <button className="btn btn-outline" disabled={busy}>
              Queue approved refund
            </button>
          </form>
        )}
      {data.canRefund && data.booking.paymentStatus === "paid" && (
        <button
          className="btn btn-outline mt-5"
          type="button"
          disabled={busy}
          onClick={async () => {
            setError("");
            try {
              const result = await api<{ href: string }>(
                `/api/operations/bookings/${id}/invoice`,
                {},
              );
              setMessage("Invoice issued.");
              window.open(result.href, "_blank", "noopener,noreferrer");
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Unable to issue invoice",
              );
            }
          }}
        >
          Issue or view invoice
        </button>
      )}
      {data.refunds.map((row) => (
        <div key={row._id} className="mt-4 border-t pt-4">
          <p>
            {gbp(row.amountMinor)} — {row.status}
            {row.failure ? `: ${row.failure}` : ""}
          </p>
          {data.canRefund && ["review", "submitted"].includes(row.status) && (
            <form
              className="platform-form mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void run({
                  action: "reconcile_refund",
                  requestId: row._id,
                  providerRef: form.get("providerRef"),
                });
              }}
            >
              <label>
                Stripe refund reference
                <input
                  className="input"
                  name="providerRef"
                  required
                  defaultValue={row.providerRef ?? ""}
                  placeholder="re_…"
                />
              </label>
              <button className="btn btn-outline" disabled={busy}>
                Verify existing provider refund
              </button>
            </form>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
