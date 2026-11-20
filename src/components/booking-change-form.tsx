"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
import { Select } from "./select";
type Change = {
  _id: string;
  kind: string;
  reason: string;
  status: string;
  reviewNote?: string;
};
export function BookingChangeForm({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [requests, setRequests] = useState<Change[]>([]),
    [kind, setKind] = useState("cancel"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const result = await api<{ requests: Change[] }>(
      `/api/bookings/${id}/changes`,
    );
    setRequests(result.requests);
  }, [id]);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);
  return (
    <section className="card p-7 mt-6">
      <h2 className="text-xl font-bold">Change your booking</h2>
      <p className="muted mt-3">
        Cancellation and rescheduling requests require staff review. A request
        does not change your collection or automatically issue a refund.
      </p>
      {requests.map((row) => (
        <div key={row._id} className="border-b py-3">
          <strong>
            {row.kind}: {row.status}
          </strong>
          <p>{row.reason}</p>
          {row.reviewNote && <p>{row.reviewNote}</p>}
        </div>
      ))}
      {[
        "pending_payment",
        "confirmed",
        "assigned",
        "en_route",
        "arrived",
        "payment_review",
      ].includes(status) &&
        !requests.some((row) => row.status === "pending") && (
          <form
            className="platform-form mt-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setMessage("");
              const form = new FormData(event.currentTarget);
              try {
                await api(`/api/bookings/${id}/changes`, {
                  kind,
                  reason: form.get("reason"),
                  ...(kind === "reschedule"
                    ? { preferredDate: form.get("preferredDate") }
                    : {}),
                });
                setMessage("Your request has been sent for staff review.");
                await load();
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to request a change",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Request type
              <Select
                value={kind}
                onValueChange={setKind}
                options={[
                  { value: "cancel", label: "Cancel collection" },
                  { value: "reschedule", label: "Request a different date" },
                ]}
              />
            </label>
            {kind === "reschedule" && (
              <label>
                Preferred date
                <input
                  className="input"
                  name="preferredDate"
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                />
              </label>
            )}
            <label>
              Reason
              <textarea
                className="input"
                name="reason"
                required
                minLength={5}
                maxLength={2000}
              />
            </label>
            <button className="btn btn-outline" disabled={busy}>
              {busy ? "Sending…" : "Send request for review"}
            </button>
          </form>
        )}
      {message && (
        <p role="status" className="mt-4">
          {message}
        </p>
      )}
    </section>
  );
}
