"use client";
import { useState } from "react";
import { api } from "@/lib/operations/client";
import { PrivateFileInput } from "./private-file-input";
export function CompanyVehicleForm({
  id,
  version,
  onSaved,
}: {
  id: string;
  version: number;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [documents, setDocuments] = useState<Record<string, string[]>>({});
  return (
    <section className="platform-card">
      <h2>Company vehicle</h2>
      <p>
        This applicant does not own a van. Add the company vehicle and evidence
        before reviewing activation.
      </p>
      <button className="btn btn-outline mt-4" onClick={() => setOpen(!open)}>
        {open ? "Close vehicle form" : "Assign company vehicle"}
      </button>
      {open && (
        <form
          className="platform-form mt-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(event.currentTarget);
            const body: Record<string, unknown> = {
              ...Object.fromEntries(form),
              version,
              vehicleTaxConfirmed: form.get("vehicleTaxConfirmed") === "on",
              documents: Object.entries(documents).flatMap(([kind, ids]) =>
                ids.map((assetId) => ({ kind, assetId })),
              ),
            };
            for (const key of ["maximumWeightKg", "capacityKg", "capacityM3"])
              body[key] = Number(body[key]);
            try {
              await api(`/api/admin/drivers/${id}/vehicle`, body);
              setOpen(false);
              await onSaved();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Unable to assign vehicle",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="platform-form-grid">
            {[
              ["vehicleRegistration", "Registration", "text"],
              ["vehicleMakeModel", "Make and model", "text"],
              ["vehicleClass", "Vehicle class", "text"],
              ["vanSize", "Van size", "text"],
              ["maximumWeightKg", "Maximum permitted weight (kg)", "number"],
              ["capacityKg", "Load capacity (kg)", "number"],
              ["capacityM3", "Load volume (m³)", "number"],
              ["insuranceExpiresAt", "Insurance expiry", "date"],
              ["motExpiresAt", "Roadworthiness expiry", "date"],
            ].map(([name, label, type]) => (
              <label key={name}>
                {label}
                <input
                  className="input"
                  name={name}
                  type={type}
                  required
                  min={type === "number" ? 0.1 : undefined}
                  step={type === "number" ? "any" : undefined}
                />
              </label>
            ))}
          </div>
          <label className="platform-checkbox">
            <input type="checkbox" name="vehicleTaxConfirmed" required />
            Vehicle tax and insured business/waste use confirmed
          </label>
          <div className="platform-form-grid">
            {[
              "insurance",
              "mot",
              "vehicle_front",
              "vehicle_side",
              "vehicle_load",
            ].map((kind) => (
              <PrivateFileInput
                key={kind}
                label={kind.replaceAll("_", " ")}
                purpose="driver_document"
                value={documents[kind] ?? []}
                onChange={(ids) =>
                  setDocuments((current) => ({ ...current, [kind]: ids }))
                }
              />
            ))}
          </div>
          <label>
            Assignment notes
            <textarea className="input" name="note" required minLength={5} />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save vehicle for review"}
          </button>
        </form>
      )}
    </section>
  );
}
