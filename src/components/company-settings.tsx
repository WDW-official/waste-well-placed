"use client";
import { AdminSkeleton } from "./admin-skeleton";
import { useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
import { Select } from "./select";
export function CompanySettings() {
  const [data, setData] = useState<{
      company: Record<string, unknown> | null;
      canEdit: boolean;
      configuration: Record<string, boolean>;
    } | null>(null),
    [values, setValues] = useState<Record<string, unknown>>({
      vatRegistered: false,
      vatRate: 0.2,
      pricesIncludeVat: false,
      approved: false,
    }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<NonNullable<typeof data>>("/api/operations/company")
      .then((result) => {
        setData(result);
        if (result.company) setValues(result.company);
      })
      .catch((error) => setMessage(error.message));
  }, []);
  if (!data)
    return message ? (
      <p role="alert">{message}</p>
    ) : (
      <AdminSkeleton variant="form" label="Loading company settings" />
    );
  return (
    <div className="platform-stack">
      <section className="platform-card">
        <h2>Service configuration</h2>
        {Object.entries(data.configuration).map(([key, configured]) => (
          <p key={key}>
            {key}: <strong>{configured ? "Configured" : "Missing"}</strong>
          </p>
        ))}
        <p>
          Provider values remain on the server. Schedule the maintenance
          endpoint to deliver notifications, expire reservations and process
          approved refunds.
        </p>
      </section>
      <form
        className="platform-card platform-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const body: Record<string, unknown> = {};
            for (const key of [
              "legalName",
              "address",
              "companyNumber",
              "vatNumber",
              "carrierNumber",
              "email",
              "phone",
              "cancellationPolicy",
              "privacyText",
              "termsText",
            ])
              body[key] = String(values[key] ?? "");
            Object.assign(body, {
              approved: !!values.approved,
              vatRegistered: !!values.vatRegistered,
              vatRate: Number(values.vatRate ?? 0.2),
              pricesIncludeVat: !!values.pricesIncludeVat,
            });
            await api("/api/operations/company", body);
            setMessage("Company details saved.");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Unable to save",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Company details & approved policies</h2>
        <p>
          Only the owner can publish these details. Save drafts until the
          company information, VAT treatment and policy text have been approved.
        </p>
        <div className="platform-form-grid">
          {[
            ["legalName", "Registered business name"],
            ["address", "Registered/business address"],
            ["companyNumber", "Company number"],
            ["vatNumber", "VAT number"],
            ["carrierNumber", "Waste carrier registration"],
            ["email", "Support email"],
            ["phone", "Support phone"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                className="input"
                disabled={!data.canEdit}
                value={String(values[key] ?? "")}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              />
            </label>
          ))}
        </div>
        {[
          ["vatRegistered", "VAT registered"],
          ["pricesIncludeVat", "Guide prices include VAT"],
          ["approved", "Publish approved details and policies"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <Select
              disabled={!data.canEdit}
              value={values[key] ? "true" : "false"}
              onValueChange={(value) =>
                setValues({ ...values, [key]: value === "true" })
              }
              options={[
                { value: "false", label: "No" },
                { value: "true", label: "Yes" },
              ]}
            />
          </label>
        ))}
        <label>
          VAT rate (0.2 means 20%)
          <input
            className="input"
            type="number"
            min="0"
            max="1"
            step="0.01"
            disabled={!data.canEdit}
            value={Number(values.vatRate ?? 0.2)}
            onChange={(event) =>
              setValues({ ...values, vatRate: Number(event.target.value) })
            }
          />
        </label>
        {[
          [
            "cancellationPolicy",
            "Cancellation, rescheduling and refund policy",
          ],
          ["privacyText", "Approved privacy policy"],
          ["termsText", "Approved terms"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              className="input min-h-40"
              disabled={!data.canEdit}
              value={String(values[key] ?? "")}
              onChange={(event) =>
                setValues({ ...values, [key]: event.target.value })
              }
            />
          </label>
        ))}
        {data.canEdit && (
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save company settings"}
          </button>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </div>
  );
}
