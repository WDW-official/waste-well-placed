"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, localDate } from "@/lib/operations/client";
import { Select } from "@/components/select";
import { PrivateFileInput } from "@/components/private-file-input";
import { gbp } from "@/lib/utils";
type Job = {
  assignment: {
    _id: string;
    status: string;
    version: number;
    offerMinor: number;
    expiresAt?: string;
  };
  booking: {
    reference: string;
    status: string;
    address?: {
      line1?: string;
      city?: string;
      postcode?: string;
      notes?: string;
    };
    scheduledAt?: string;
    contact?: { phone?: string; name?: string };
    photos?: { secureUrl: string }[];
    expectedWeightKg?: number;
    expectedVolumeM3?: number;
    wasteType?: string;
  };
  facility?: { name: string; address?: string; postcode?: string };
  evidence?: {
    beforeAssetIds: string[];
    afterAssetIds: string[];
    receiptAssetId?: string;
    receiptNumber?: string;
    wasteDescription?: string;
    ewcCode?: string;
    weightKg?: number;
    deliveredAt?: string;
    verificationNote?: string;
  };
};
type Workspace = {
  profile: { status: string; online: boolean; reviewNotes?: string } | null;
  eligible: boolean;
  jobs: Job[];
  payouts: {
    _id: string;
    offeredMinor: number;
    status: string;
    adjustments: { amountMinor: number; reason: string }[];
    paidAt?: string;
    scheduledAt?: string;
    transferReference?: string;
  }[];
  notifications: {
    _id: string;
    subject: string;
    message: string;
    createdAt: string;
  }[];
};
export function DriverWorkspace() {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await api<Workspace>("/api/driver/jobs"));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Workspace unavailable",
      );
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!data) return <p role="status">{error || "Loading your workspace…"}</p>;
  return (
    <div className="platform-stack">
      <div className="platform-card">
        <div className="platform-card-heading">
          <div>
            <span className="platform-badge">
              {data.profile?.status.replaceAll("_", " ") ??
                "Application needed"}
            </span>
            <h2>Your driver profile</h2>
          </div>
          <Link href="/driver/apply" className="btn btn-outline">
            Application
          </Link>
        </div>
        <p>
          {data.eligible
            ? "Your checks are current. Set your availability to receive suitable offers."
            : "You cannot access paid jobs until your application and current documents are approved."}
        </p>
        {data.profile?.reviewNotes && <p>{data.profile.reviewNotes}</p>}
        {data.eligible && (
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={busy || data.jobs.length > 0}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(
                  "/api/driver/availability",
                  {
                    online: !data.profile?.online,
                    until: new Date(Date.now() + 8 * 3600_000).toISOString(),
                  },
                  "PATCH",
                );
                await load();
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Could not update availability",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {data.profile?.online
              ? "Go offline"
              : "Available for the next 8 hours"}
          </button>
        )}
        <p className="muted mt-3">
          Times are displayed in London time. An active job takes you out of the
          available pool.
        </p>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <section>
        <h2 className="platform-section-title">Offers & active collections</h2>
        {!data.jobs.length && (
          <div className="platform-card">
            No current offers or active collections.
          </div>
        )}
        {data.jobs.map((job) => (
          <DriverJob
            key={`${job.assignment._id}:${job.assignment.version}`}
            job={job}
            refresh={load}
          />
        ))}
      </section>
      <section className="platform-card">
        <h2>Your earnings</h2>
        <p className="muted">
          Offered amounts are fixed when you accept. Evidence must be verified
          before finance approval. Transfers are settled manually.
        </p>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Offered</th>
                <th>Adjustments</th>
                <th>Payable</th>
                <th>Status</th>
                <th>Payment date</th>
              </tr>
            </thead>
            <tbody>
              {data.payouts.map((payout) => {
                const adjustment = payout.adjustments.reduce(
                  (sum, row) => sum + row.amountMinor,
                  0,
                );
                return (
                  <tr key={payout._id}>
                    <td>{gbp(payout.offeredMinor)}</td>
                    <td>{gbp(adjustment)}</td>
                    <td>{gbp(payout.offeredMinor + adjustment)}</td>
                    <td>{payout.status}</td>
                    <td>{localDate(payout.paidAt ?? payout.scheduledAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!data.payouts.length && <p>No earnings records yet.</p>}
      </section>
      <section className="platform-card">
        <h2>Updates</h2>
        {data.notifications.map((notification) => (
          <article className="platform-timeline" key={notification._id}>
            <strong>{notification.subject}</strong>
            <p>{notification.message}</p>
            <small>{localDate(notification.createdAt)}</small>
          </article>
        ))}
      </section>
    </div>
  );
}
function DriverJob({
  job,
  refresh,
}: {
  job: Job;
  refresh: () => Promise<void>;
}) {
  const [before, setBefore] = useState(job.evidence?.beforeAssetIds ?? []);
  const [after, setAfter] = useState(job.evidence?.afterAssetIds ?? []);
  const [receipt, setReceipt] = useState(
    job.evidence?.receiptAssetId ? [job.evidence.receiptAssetId] : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const transitions: Record<string, string> = {
    assigned: "en_route",
    en_route: "arrived",
    arrived: "collected",
    collected: "at_facility",
    at_facility: "evidence_submitted",
  };
  async function act(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/driver/jobs/${job.assignment._id}`, body);
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to update job",
      );
    } finally {
      setBusy(false);
    }
  }
  const [issueKind, setIssueKind] = useState("other");
  const [issueNote, setIssueNote] = useState("");
  const next = transitions[job.booking.status];
  return (
    <article className="platform-card mt-4">
      <div className="platform-card-heading">
        <div>
          <span className="platform-badge">
            {job.assignment.status.replaceAll("_", " ")}
          </span>
          <h3>{job.booking.reference}</h3>
        </div>
        <strong>{gbp(job.assignment.offerMinor)} offered</strong>
      </div>
      <p>{localDate(job.booking.scheduledAt)}</p>
      <p>
        {[
          job.booking.address?.line1,
          job.booking.address?.city,
          job.booking.address?.postcode,
        ]
          .filter(Boolean)
          .join(", ")}
      </p>
      <p>
        {job.booking.expectedVolumeM3} m³ · {job.booking.expectedWeightKg} kg ·{" "}
        {job.booking.wasteType}
      </p>
      <p>Receiving facility: {job.facility?.name ?? "Contact operations"}</p>
      {job.assignment.status === "offered" ? (
        <>
          <p>
            Respond before {localDate(job.assignment.expiresAt)}. Full contact
            details are shown after acceptance.
          </p>
          <div className="platform-actions">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void act({ action: "accept" })}
            >
              Accept offer
            </button>
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                const note = prompt("Reason for declining");
                if (note) void act({ action: "decline", note });
              }}
            >
              Decline
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="platform-actions">
            {job.booking.contact?.phone && (
              <a
                className="btn btn-outline"
                href={`tel:${job.booking.contact.phone}`}
              >
                Call customer
              </a>
            )}
            <a
              className="btn btn-outline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([job.booking.address?.line1, job.booking.address?.postcode].join(" "))}`}
            >
              Open directions
            </a>
          </div>
          {job.booking.address?.notes && (
            <p>Access: {job.booking.address.notes}</p>
          )}
          {!!job.booking.photos?.length && (
            <div className="platform-photos">
              {job.booking.photos.map((photo) => (
                <a
                  key={photo.secureUrl}
                  href={photo.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.secureUrl} alt="Customer waste" />
                </a>
              ))}
            </div>
          )}
          {job.evidence?.verificationNote && (
            <p className="platform-notice">{job.evidence.verificationNote}</p>
          )}
          {job.assignment.status !== "evidence_submitted" && (
            <>
              <h3 className="mt-6">Pickup & facility evidence</h3>
              <form
                className="platform-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  void act({
                    action: "evidence",
                    beforeAssetIds: before,
                    afterAssetIds: after,
                    receiptAssetId: receipt[0],
                    receiptNumber: String(values.get("receiptNumber") ?? ""),
                    wasteDescription: String(
                      values.get("wasteDescription") ?? "",
                    ),
                    ewcCode: String(values.get("ewcCode") ?? ""),
                    ...(values.get("weightKg")
                      ? { weightKg: Number(values.get("weightKg")) }
                      : {}),
                    ...(values.get("deliveredAt")
                      ? {
                          deliveredAt: new Date(
                            String(values.get("deliveredAt")),
                          ).toISOString(),
                        }
                      : {}),
                  });
                }}
              >
                <PrivateFileInput
                  label="Before pickup photos"
                  purpose="evidence"
                  multiple
                  value={before}
                  onChange={setBefore}
                />
                <PrivateFileInput
                  label="After pickup photos"
                  purpose="evidence"
                  multiple
                  value={after}
                  onChange={setAfter}
                />
                <PrivateFileInput
                  label="Facility receipt / weighbridge ticket"
                  purpose="evidence"
                  value={receipt}
                  onChange={setReceipt}
                />
                <div className="platform-form-grid">
                  <label>
                    Receipt number
                    <input
                      className="input"
                      name="receiptNumber"
                      defaultValue={job.evidence?.receiptNumber}
                    />
                  </label>
                  <label>
                    Waste description
                    <input
                      className="input"
                      name="wasteDescription"
                      defaultValue={job.evidence?.wasteDescription}
                    />
                  </label>
                  <label>
                    EWC code
                    <input
                      className="input"
                      name="ewcCode"
                      defaultValue={job.evidence?.ewcCode}
                    />
                  </label>
                  <label>
                    Actual weight (kg)
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      name="weightKg"
                      defaultValue={job.evidence?.weightKg}
                    />
                  </label>
                  <label>
                    Facility delivery time (your device local time)
                    <input
                      className="input"
                      type="datetime-local"
                      name="deliveredAt"
                    />
                  </label>
                </div>
                <button className="btn btn-outline" disabled={busy}>
                  Save evidence
                </button>
              </form>
              {next && (
                <button
                  className="btn btn-primary mt-4"
                  disabled={busy}
                  onClick={() =>
                    void act({
                      action: "milestone",
                      status: next,
                      version: job.assignment.version,
                      note: "Driver milestone update",
                    })
                  }
                >
                  Mark {next.replaceAll("_", " ")}
                </button>
              )}
            </>
          )}
          <form
            className="platform-form mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              void act({ action: "issue", kind: issueKind, note: issueNote });
            }}
          >
            <h3>Report an issue</h3>
            <Select
              aria-label="Issue type"
              value={issueKind}
              onValueChange={setIssueKind}
              options={[
                { value: "delay", label: "Delay" },
                { value: "access", label: "Access problem" },
                { value: "extra_waste", label: "Extra waste / changed scope" },
                {
                  value: "restricted_waste",
                  label: "Restricted or unexpected materials",
                },
                { value: "vehicle", label: "Vehicle problem" },
                { value: "other", label: "Other issue" },
              ]}
            />
            <textarea
              className="input"
              aria-label="Describe the issue"
              required
              minLength={5}
              maxLength={2000}
              value={issueNote}
              onChange={(event) => setIssueNote(event.target.value)}
            />
            <p>
              Extra or restricted waste pauses collection until operations
              resolves the exception. Do not promise additional charges without
              customer agreement.
            </p>
            <button className="btn btn-outline" disabled={busy}>
              Send issue to operations
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="field-error mt-3">
          {error}
        </p>
      )}
    </article>
  );
}
