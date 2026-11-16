"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, localDate, moneyInput } from "@/lib/operations/client";
import { Select } from "@/components/select";
import { PrivateFileInput } from "@/components/private-file-input";
import { gbp } from "@/lib/utils";
type Payload = {
  booking: {
    _id: string;
    reference: string;
    version: number;
    status: string;
    paymentStatus: string;
    paidMinor?: number;
    refundsMinor?: number;
    chargebackMinor?: number;
    scheduledAt?: string;
    source?: string;
    kind?: string;
    notes?: string;
    expectedWeightKg?: number;
    expectedVolumeM3?: number;
    wasteType?: string;
    address?: {
      line1?: string;
      city?: string;
      postcode?: string;
      notes?: string;
    };
    contact?: { name?: string; email?: string; phone?: string };
    photos: { secureUrl: string }[];
    price?: { totalMinor?: number; vatMinor?: number };
    events: { status: string; note?: string; at: string }[];
  };
  quote?: { _id: string; reference: string; status: string };
  assignments: {
    _id: string;
    status: string;
    live: boolean;
    driverId: string;
    offerMinor: number;
    expiresAt?: string;
    economics?: Record<string, number | boolean>;
  }[];
  candidates: {
    userId: string;
    name: string;
    capacityKg: number;
    capacityM3: number;
  }[];
  facilities: { _id: string; name: string; chargeMinor?: number }[];
  evidence: {
    _id: string;
    status: string;
    beforeAssetIds: string[];
    afterAssetIds: string[];
    receiptAssetId?: string;
    receiptNumber?: string;
    wasteDescription?: string;
    ewcCode?: string;
    weightKg?: number;
    deliveredAt?: string;
    verificationNote?: string;
    transferNoteAssetId?: string;
  }[];
  issues: {
    _id: string;
    status: string;
    note: string;
    kind: string;
    dueAt?: string;
    resolution?: string;
  }[];
  history: {
    _id: string;
    action: string;
    actorId: string;
    createdAt: string;
    detail?: { note?: string; reason?: string };
  }[];
  payouts: {
    _id: string;
    status: string;
    version: number;
    offeredMinor: number;
    transferReference?: string;
    adjustments: { amountMinor: number; reason: string }[];
  }[];
  permissions: { dispatch: boolean; verify: boolean; finance: boolean };
};
function ActionForm({
  title,
  submit,
  done,
  children,
}: {
  title: string;
  submit: (form: FormData) => Promise<unknown>;
  done: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="platform-form mt-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await submit(new FormData(event.currentTarget));
          await done();
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : "Unable to save",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : title}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
function AssetLinks({ ids, label }: { ids: string[]; label: string }) {
  return (
    <div className="platform-document-grid">
      {ids.map((id, index) => (
        <a
          key={id}
          className="platform-document"
          href={`/api/assets/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          {label} {index + 1} ↗
        </a>
      ))}
    </div>
  );
}
export function JobCockpit({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Summary");
  const [driverId, setDriverId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [wasteType, setWasteType] = useState("mixed");
  const [payoutAction, setPayoutAction] = useState("approve");
  const [transferNote, setTransferNote] = useState<string[]>([]);
  async function load() {
    try {
      setData(await api<Payload>(`/api/operations/jobs/${id}`));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to load job",
      );
    }
  }
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!data) return <p role="status">{error || "Loading collection…"}</p>;
  const job = data.booking;
  const post = (body: unknown) => api(`/api/operations/jobs/${id}`, body);
  return (
    <div className="platform-stack">
      <div className="platform-card">
        <div className="platform-card-heading">
          <h2>{job.reference}</h2>
          <span className="platform-badge">
            {job.status.replaceAll("_", " ")}
          </span>
        </div>
        <p>
          {job.contact?.name} · {job.address?.postcode} ·{" "}
          {localDate(job.scheduledAt)}
        </p>
        <p>
          Payment: {job.paymentStatus} · {gbp(job.price?.totalMinor ?? 0)}
        </p>
      </div>
      <div className="platform-tabs" role="tablist" aria-label="Job sections">
        {[
          "Summary",
          "Photos",
          "Quote & payments",
          "Dispatch",
          "Evidence",
          "Comms & history",
          ...(data.permissions.finance ? ["Financials"] : []),
        ].map((name) => (
          <button
            role="tab"
            type="button"
            id={`job-tab-${name.replace(/\W/g, "")}`}
            aria-controls="job-panel"
            aria-selected={tab === name}
            key={name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <section
        className="platform-card"
        id="job-panel"
        role="tabpanel"
        aria-labelledby={`job-tab-${tab.replace(/\W/g, "")}`}
      >
        {tab === "Summary" && (
          <>
            <h2>Collection summary</h2>
            <p>
              {[job.address?.line1, job.address?.city, job.address?.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p>
              Source: {job.source ?? job.kind}
              <br />
              Access: {job.address?.notes || "No access notes"}
              <br />
              Internal notes: {job.notes || "None"}
            </p>
            <div className="platform-actions">
              {job.contact?.phone && (
                <a
                  className="btn btn-outline"
                  href={`tel:${job.contact.phone}`}
                >
                  Call customer
                </a>
              )}
              {job.contact?.email && (
                <a
                  className="btn btn-outline"
                  href={`mailto:${job.contact.email}`}
                >
                  Email customer
                </a>
              )}
            </div>
            <h3 className="mt-6">Open issues</h3>
            {!data.issues.length && <p>No issues recorded.</p>}
            {data.issues.map((issue) => (
              <div className="platform-timeline" key={issue._id}>
                <strong>
                  {issue.kind} · {issue.status}
                </strong>
                <p>{issue.note}</p>
                <small>Due: {localDate(issue.dueAt)}</small>
                {issue.resolution && <p>{issue.resolution}</p>}
                {issue.status === "open" && data.permissions.dispatch && (
                  <ActionForm
                    title="Resolve issue"
                    done={load}
                    submit={(form) =>
                      post({
                        action: "resolve_issue",
                        issueId: issue._id,
                        customerApprovalReference:
                          String(form.get("approval") ?? "") || undefined,
                        note: String(form.get("note")),
                      })
                    }
                  >
                    {issue.kind === "extra_waste" && (
                      <label>
                        Customer approval / original-scope confirmation
                        reference
                        <input
                          className="input"
                          name="approval"
                          minLength={3}
                          required
                        />
                      </label>
                    )}
                    <label>
                      Resolution
                      <textarea
                        className="input"
                        name="note"
                        required
                        minLength={5}
                      />
                    </label>
                  </ActionForm>
                )}
              </div>
            ))}
          </>
        )}
        {tab === "Photos" && (
          <>
            <h2>Customer photographs</h2>
            <div className="platform-photos">
              {job.photos.map((photo) => (
                <a
                  key={photo.secureUrl}
                  href={photo.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.secureUrl} alt="Customer submitted waste" />
                </a>
              ))}
            </div>
            <p>Driver pickup photographs are shown separately in Evidence.</p>
          </>
        )}
        {tab === "Quote & payments" && (
          <>
            <h2>Quote & payment</h2>
            <p>
              Verified payments: {gbp(job.paidMinor ?? 0)} · Refunds:{" "}
              {gbp(job.refundsMinor ?? 0)} · Disputed:{" "}
              {gbp(job.chargebackMinor ?? 0)}
            </p>
            <p>
              Collection total: {gbp(job.price?.totalMinor ?? 0)}
              <br />
              VAT: {gbp(job.price?.vatMinor ?? 0)}
              <br />
              Payment state: {job.paymentStatus}
            </p>
            {data.quote && (
              <Link
                className="btn btn-outline mt-4"
                href={`/admin/quotes/${data.quote._id}`}
              >
                Open original quote & revisions
              </Link>
            )}
            <p className="mt-4">
              Payments are confirmed from signed Stripe events. Collection
              milestones never mark a payment as received.
            </p>
          </>
        )}
        {tab === "Dispatch" && (
          <>
            <h2>Dispatch planning</h2>
            <p>
              Only paid, unassigned jobs can receive offers. Coverage, hours,
              in-date checks, waste type and vehicle capacity are checked again
              on acceptance.
            </p>
            {data.permissions.dispatch && (
              <>
                <ActionForm
                  key={`plan:${job.version}`}
                  title="Save load requirements"
                  done={load}
                  submit={(form) =>
                    post({
                      action: "plan",
                      version: job.version ?? 0,
                      expectedWeightKg: Number(form.get("weight")),
                      expectedVolumeM3: Number(form.get("volume")),
                      wasteType,
                      note: String(form.get("note")),
                    })
                  }
                >
                  <div className="platform-form-grid">
                    <label>
                      Expected weight (kg)
                      <input
                        className="input"
                        type="number"
                        min="1"
                        name="weight"
                        required
                        defaultValue={job.expectedWeightKg}
                      />
                    </label>
                    <label>
                      Expected volume (m³)
                      <input
                        className="input"
                        type="number"
                        step="0.1"
                        min="0.1"
                        name="volume"
                        required
                        defaultValue={job.expectedVolumeM3}
                      />
                    </label>
                    <label>
                      Waste type
                      <Select
                        value={wasteType}
                        onValueChange={setWasteType}
                        options={[
                          "mixed",
                          "furniture",
                          "garden",
                          "construction",
                          "appliances",
                        ].map((value) => ({ value, label: value }))}
                      />
                    </label>
                    <label>
                      Planning notes
                      <input
                        className="input"
                        name="note"
                        minLength={3}
                        required
                        defaultValue={job.notes}
                      />
                    </label>
                  </div>
                </ActionForm>
                <ActionForm
                  title="Send driver offer"
                  done={load}
                  submit={(form) =>
                    post({
                      action: "offer",
                      driverId,
                      facilityId,
                      driverMinor: moneyInput(form.get("driver")),
                      disposalMinor: moneyInput(form.get("disposal")),
                      processorMinor: moneyInput(form.get("processor")),
                      contingencyMinor: moneyInput(form.get("contingency")),
                      passThroughMinor: moneyInput(form.get("passThrough")),
                      minutes: Number(form.get("minutes")),
                    })
                  }
                >
                  <h3>Offer & forecast economics</h3>
                  <label>
                    Eligible available driver
                    <Select
                      value={driverId}
                      onValueChange={setDriverId}
                      placeholder="Choose eligible driver"
                      options={data.candidates.map((driver) => ({
                        value: driver.userId,
                        label: `${driver.name} · ${driver.capacityM3} m³ / ${driver.capacityKg} kg`,
                      }))}
                    />
                  </label>
                  {!data.candidates.length && (
                    <p>
                      No suitable online drivers. Save the job requirements and
                      confirm current driver checks/availability.
                    </p>
                  )}
                  <label>
                    Receiving facility
                    <Select
                      value={facilityId}
                      onValueChange={setFacilityId}
                      placeholder="Choose approved facility"
                      options={data.facilities.map((facility) => ({
                        value: facility._id,
                        label: facility.name,
                      }))}
                    />
                  </label>
                  <div className="platform-form-grid">
                    {[
                      [
                        "driver",
                        "Fixed driver offer (£), or 0 for approved percentage policy",
                      ],
                      ["disposal", "Forecast disposal (£)"],
                      ["processor", "Processor/direct admin cost (£)"],
                      ["contingency", "Contingency (£)"],
                      ["passThrough", "Excluded pass-through charges (£)"],
                    ].map(([name, label]) => (
                      <label key={name}>
                        {label}
                        <input
                          className="input"
                          name={name}
                          type="number"
                          min="0"
                          step="0.01"
                          required
                        />
                      </label>
                    ))}
                    <label>
                      Offer expiry (minutes)
                      <input
                        className="input"
                        name="minutes"
                        type="number"
                        min="5"
                        max="120"
                        defaultValue="30"
                        required
                      />
                    </label>
                  </div>
                </ActionForm>
              </>
            )}
            <h3 className="mt-6">Assignment history</h3>
            {data.assignments.map((assignment) => (
              <div className="platform-timeline" key={assignment._id}>
                <p>
                  {assignment.status} · Driver {assignment.driverId} ·{" "}
                  {gbp(assignment.offerMinor)}
                </p>
                {assignment.live && data.permissions.dispatch && (
                  <ActionForm
                    title="Release for reassignment"
                    done={load}
                    submit={(form) =>
                      post({
                        action: "reassign",
                        assignmentId: assignment._id,
                        note: String(form.get("note")),
                      })
                    }
                  >
                    <input
                      className="input"
                      name="note"
                      aria-label="Reason for reassignment"
                      placeholder="Reason for reassignment"
                      minLength={5}
                      required
                    />
                  </ActionForm>
                )}
              </div>
            ))}
          </>
        )}
        {tab === "Evidence" && (
          <>
            <h2>Pickup & facility evidence</h2>
            {!data.evidence.length && (
              <p>No driver evidence has been submitted.</p>
            )}
            {data.evidence.map((evidence) => (
              <article className="platform-timeline" key={evidence._id}>
                <span className="platform-badge">{evidence.status}</span>
                <h3>Before pickup</h3>
                <AssetLinks
                  ids={evidence.beforeAssetIds}
                  label="Before photo"
                />
                <h3>After pickup</h3>
                <AssetLinks ids={evidence.afterAssetIds} label="After photo" />
                <h3>Facility delivery</h3>
                <p>
                  Receipt: {evidence.receiptNumber}
                  <br />
                  Delivered: {localDate(evidence.deliveredAt)}
                  <br />
                  Waste: {evidence.wasteDescription}
                  <br />
                  EWC: {evidence.ewcCode}
                  <br />
                  Weight: {evidence.weightKg ?? "Not recorded"} kg
                </p>
                <AssetLinks
                  ids={evidence.receiptAssetId ? [evidence.receiptAssetId] : []}
                  label="Facility receipt"
                />
                {evidence.verificationNote && (
                  <p>{evidence.verificationNote}</p>
                )}
                {evidence.status === "submitted" && data.permissions.verify && (
                  <>
                    <PrivateFileInput
                      label="Optional authorised waste transfer document"
                      purpose="transfer_note"
                      value={transferNote}
                      onChange={setTransferNote}
                    />
                    <ActionForm
                      title="Record verification decision"
                      done={load}
                      submit={(form) =>
                        post({
                          action: "verify",
                          evidenceId: evidence._id,
                          approved: form.get("approved") === "on",
                          note: String(form.get("note")),
                          transferNoteAssetId: transferNote[0],
                        })
                      }
                    >
                      <label className="platform-checkbox">
                        <input type="checkbox" name="approved" />I independently
                        checked the pickup evidence, receiving facility and
                        receipt. Approve this evidence.
                      </label>
                      <label>
                        Reason / corrections
                        <textarea
                          className="input"
                          name="note"
                          minLength={5}
                          required
                        />
                      </label>
                      <p>
                        Unchecked approval returns the evidence to the driver
                        for correction. A facility delivery is not a recycling
                        claim.
                      </p>
                    </ActionForm>
                  </>
                )}
              </article>
            ))}
          </>
        )}
        {tab === "Comms & history" && (
          <>
            <h2>Audit history</h2>
            {data.history.map((event) => (
              <div className="platform-timeline" key={event._id}>
                <strong>{event.action}</strong>
                <p>{event.detail?.note ?? event.detail?.reason}</p>
                <small>
                  {localDate(event.createdAt)} · {event.actorId}
                </small>
              </div>
            ))}
            <h3 className="mt-5">Customer milestones</h3>
            {job.events.map((event, index) => (
              <p key={index}>
                {localDate(event.at)} · {event.status} · {event.note}
              </p>
            ))}
          </>
        )}
        {tab === "Financials" && (
          <>
            <h2>Offer economics & settlement</h2>
            {data.assignments.map((assignment) => (
              <div className="platform-timeline" key={assignment._id}>
                <strong>Frozen offer: {gbp(assignment.offerMinor)}</strong>
                <div className="platform-detail-grid">
                  {Object.entries(assignment.economics ?? {})
                    .filter(([key]) => key.endsWith("Minor"))
                    .map(([key, value]) => (
                      <p key={key}>
                        {key.replace("Minor", "")}
                        <br />
                        <strong>{gbp(Number(value))}</strong>
                      </p>
                    ))}
                </div>
              </div>
            ))}
            {data.payouts.map((payout) => (
              <div
                key={`${payout._id}:${payout.version}`}
                className="platform-timeline"
              >
                <h3>
                  {payout.status} ·{" "}
                  {gbp(
                    payout.offeredMinor +
                      payout.adjustments.reduce(
                        (sum, adjustment) => sum + adjustment.amountMinor,
                        0,
                      ),
                  )}
                </h3>
                {payout.adjustments.map((adjustment, index) => (
                  <p key={index}>
                    {gbp(adjustment.amountMinor)} · {adjustment.reason}
                  </p>
                ))}
                {payout.transferReference && (
                  <p>Transfer reference: {payout.transferReference}</p>
                )}
                {payout.status !== "paid" && (
                  <ActionForm
                    title="Update settlement"
                    done={load}
                    submit={(form) => {
                      const action = payoutAction;
                      const raw = String(form.get("amount") ?? "0");
                      return api(`/api/operations/payouts/${payout._id}`, {
                        action,
                        version: payout.version,
                        note: String(form.get("note")),
                        ...(action === "adjust"
                          ? {
                              amountMinor:
                                (raw.startsWith("-") ? -1 : 1) *
                                moneyInput(raw.replace(/^-/, "")),
                            }
                          : {}),
                        ...(form.get("reference")
                          ? { reference: String(form.get("reference")) }
                          : {}),
                        ...(form.get("date")
                          ? {
                              scheduledAt: new Date(
                                String(form.get("date")),
                              ).toISOString(),
                            }
                          : {}),
                      });
                    }}
                  >
                    <label>
                      Action
                      <Select
                        value={payoutAction}
                        onValueChange={setPayoutAction}
                        options={[
                          {
                            value: "approve",
                            label: "Approve after verification",
                          },
                          {
                            value: "schedule",
                            label: "Schedule manual transfer",
                          },
                          {
                            value: "paid",
                            label: "Record completed bank transfer",
                          },
                          { value: "hold", label: "Hold for review" },
                          {
                            value: "adjust",
                            label: "Record agreed adjustment",
                          },
                        ]}
                      />
                    </label>
                    <label>
                      Adjustment amount (£), if applicable
                      <input
                        className="input"
                        name="amount"
                        type="number"
                        step="0.01"
                      />
                    </label>
                    <label>
                      Completed transfer reference
                      <input className="input" name="reference" />
                    </label>
                    <label>
                      Scheduled payment date
                      <input
                        className="input"
                        name="date"
                        type="datetime-local"
                      />
                    </label>
                    <label>
                      Reason / agreement
                      <textarea
                        className="input"
                        name="note"
                        minLength={5}
                        required
                      />
                    </label>
                  </ActionForm>
                )}
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
