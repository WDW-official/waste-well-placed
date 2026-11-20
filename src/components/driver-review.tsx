"use client";
import { useEffect, useState } from "react";
import { api, localDate } from "@/lib/operations/client";
import { CompanyVehicleForm } from "./company-vehicle-form";
import { Select } from "@/components/select";
type Application = {
  _id: string;
  userId: string;
  version: number;
  status: string;
  legalName?: string;
  dateOfBirth?: string;
  postcode?: string;
  phone?: string;
  basedIn?: string;
  hasFullUkLicence?: boolean;
  ownsVan?: boolean;
  vanSize?: string;
  points?: number;
  disqualified?: boolean;
  endorsements?: string;
  licenceCategories: string[];
  licenceExpiresAt?: string;
  insuranceExpiresAt?: string;
  carrierExpiresAt?: string;
  motExpiresAt?: string;
  carrierReference?: string;
  carrierRelationship?: string;
  vehicleMakeModel?: string;
  vehicleRegistration?: string;
  vehicleClass?: string;
  capacityKg?: number;
  capacityM3?: number;
  maximumWeightKg?: number;
  coveragePrefixes: string[];
  wasteTypes: string[];
  checks?: Record<string, boolean>;
  documents: { kind: string; assetId: string; expiresAt?: string }[];
  reviewNotes?: string;
};
export function DriverReview({ id }: { id: string }) {
  const [data, setData] = useState<{
    application: Application;
    account: { name: string; email: string; driverPasswordPending?: boolean };
    drivingCheck?: { licenceLastEight: string; dvlaCheckCode: string };
  } | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("driving_review");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(identity = false) {
    try {
      const result = await api<NonNullable<typeof data>>(
        `/api/admin/drivers/${id}${identity ? "?identity=1" : ""}`,
      );
      setData(result);
      setChecks(result.application.checks ?? {});
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to load application",
      );
    }
  }
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!data) return <p role="status">{error || "Loading application…"}</p>;
  const app = data.application;
  return (
    <div className="platform-stack">
      <section className="platform-card">
        <span className="platform-badge">
          {app.status.replaceAll("_", " ")}
        </span>
        <h2>{app.legalName ?? data.account.name}</h2>
        <p>
          {data.account.email} · {app.phone} · {app.basedIn} · {app.postcode}
        </p>
        <div className="platform-detail-grid">
          <div>
            <h3>Driving entitlement</h3>
            <p>
              Full UK driving licence:{" "}
              {app.hasFullUkLicence == null
                ? "Not recorded"
                : app.hasFullUkLicence
                  ? "Yes"
                  : "No"}
              <br />
              DOB: {app.dateOfBirth?.slice(0, 10)}
              <br />
              Categories: {app.licenceCategories.join(", ")}
              <br />
              Points: {app.points} · Disqualified:{" "}
              {app.disqualified ? "Yes" : "No"}
              <br />
              Endorsements: {app.endorsements}
              <br />
              Licence expiry: {localDate(app.licenceExpiresAt)}
            </p>
            <button
              className="btn btn-outline mt-3"
              onClick={() => void load(true)}
            >
              Reveal consented check credentials
            </button>
            {data.drivingCheck && (
              <p className="platform-notice">
                Last eight: {data.drivingCheck.licenceLastEight}
                <br />
                DVLA code: {data.drivingCheck.dvlaCheckCode}
              </p>
            )}
          </div>
          <div>
            <h3>Vehicle & insurance</h3>
            <p>
              Owns a van:{" "}
              {app.ownsVan == null
                ? "Not recorded"
                : app.ownsVan
                  ? "Yes"
                  : "No — company vehicle required"}
              <br />
              Van size: {app.vanSize ?? "Not provided"}
              <br />
              {app.vehicleRegistration} · {app.vehicleMakeModel}
              <br />
              {app.vehicleClass} · {app.capacityKg} kg / {app.capacityM3} m³
              <br />
              Maximum vehicle weight: {app.maximumWeightKg} kg
              <br />
              Insurance: {localDate(app.insuranceExpiresAt)}
              <br />
              Roadworthiness: {localDate(app.motExpiresAt)}
            </p>
          </div>
          <div>
            <h3>Waste authorisation</h3>
            <p>
              {app.carrierReference}
              <br />
              {app.carrierRelationship}
              <br />
              Recheck: {localDate(app.carrierExpiresAt)}
              <br />
              Waste types: {app.wasteTypes.join(", ")}
              <br />
              Coverage: {app.coveragePrefixes.join(", ")}
            </p>
          </div>
        </div>
      </section>
      <section className="platform-card">
        <h2>Private application documents</h2>
        <div className="platform-document-grid">
          {app.documents.map((document) => (
            <a
              className="platform-document"
              key={document.assetId}
              href={`/api/assets/${document.assetId}`}
              target="_blank"
              rel="noreferrer"
            >
              {document.kind.replaceAll("_", " ")} ↗
            </a>
          ))}
        </div>
      </section>
      {app.ownsVan === false && app.status !== "active" && (
        <CompanyVehicleForm
          id={id}
          version={app.version}
          onSaved={() => load()}
        />
      )}
      <form
        className="platform-card platform-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(event.currentTarget);
          try {
            await api(
              `/api/admin/drivers/${id}`,
              {
                status,
                version: app.version,
                note: String(form.get("note")),
                checks: Object.fromEntries(
                  [
                    "identity",
                    "licence",
                    "insurance",
                    "carrier",
                    "vehicle",
                    "contract",
                  ].map((key) => [key, !!checks[key]]),
                ),
              },
              "PATCH",
            );
            await load();
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Review failed",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Human review</h2>
        {data.account.driverPasswordPending && (
          <p className="platform-notice">
            This applicant has no password yet. Approval and activation queues
            an email with a secure password-setup link.
          </p>
        )}
        <p>
          Check the original documents and appropriate registers before
          confirming each check. No driver can approve themselves.
        </p>
        {[
          "identity",
          "licence",
          "insurance",
          "carrier",
          "vehicle",
          "contract",
        ].map((key) => (
          <label className="platform-checkbox" key={key}>
            <input
              type="checkbox"
              checked={!!checks[key]}
              onChange={(event) =>
                setChecks({ ...checks, [key]: event.target.checked })
              }
            />
            {key} checked and accepted
          </label>
        ))}
        <label>
          Decision
          <Select
            value={status}
            onValueChange={setStatus}
            options={[
              "driving_review",
              "vehicle_review",
              "compliance_review",
              "more_information",
              "rejected",
              "active",
              "suspended",
            ].map((value) => ({
              value,
              label:
                value === "active"
                  ? "Approve and activate"
                  : value.replaceAll("_", " "),
            }))}
          />
        </label>
        <label>
          Reason / review notes
          <textarea
            className="input"
            name="note"
            minLength={5}
            required
            defaultValue={app.reviewNotes}
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Record review
        </button>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
