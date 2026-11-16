"use client";
import { useState } from "react";
import { api, moneyInput } from "@/lib/operations/client";
import { OperationsDashboard } from "@/components/operations-dashboard";
export function FacilityManager() {
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <div className="platform-stack">
      <form
        className="platform-card platform-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const form = new FormData(event.currentTarget);
          try {
            await api("/api/operations/facilities", {
              name: String(form.get("name")),
              address: String(form.get("address")),
              postcode: String(form.get("postcode")),
              permitReference: String(form.get("permit")),
              expiresAt: String(form.get("expiresAt")),
              wasteTypes: String(form.get("wasteTypes"))
                .split(",")
                .map((type) => type.trim())
                .filter(Boolean),
              chargeMinor: moneyInput(form.get("charge")),
              active: form.get("checked") === "on",
            });
            setVersion(version + 1);
            setMessage("Facility saved with your verification record.");
          } catch (failure) {
            setMessage(
              failure instanceof Error ? failure.message : "Unable to save",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Add a verified receiving facility</h2>
        <div className="platform-form-grid">
          {[
            ["name", "Facility name"],
            ["address", "Address"],
            ["postcode", "Postcode"],
            ["permit", "Verified permit / registration reference"],
            [
              "wasteTypes",
              "Accepted waste types (mixed, furniture, garden, construction, appliances)",
            ],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input className="input" name={name} required />
            </label>
          ))}
          <label>
            Recheck date
            <input type="date" className="input" name="expiresAt" required />
          </label>
          <label>
            Forecast disposal charge (£)
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              name="charge"
              required
            />
          </label>
        </div>
        <label className="platform-checkbox">
          <input type="checkbox" name="checked" required />I checked the
          facility authorisation and accepted waste types
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Save approved facility
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      <OperationsDashboard key={version} view="facilities" />
    </div>
  );
}
