"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
export function BusinessManager() {
  const [canCreate, setCanCreate] = useState(false);
  const [rows, setRows] = useState<
      {
        _id: string;
        name: string;
        billingEmail?: string;
        managerId?: { email?: string };
      }[]
    >([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const result = await api<{
      organizations: typeof rows;
      canCreate: boolean;
    }>("/api/operations/organizations");
    setRows(result.organizations);
    setCanCreate(result.canCreate);
  }, []);
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, [load]);
  return (
    <div className="platform-stack">
      {canCreate && (
        <form
          className="platform-card platform-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const form = event.currentTarget;
            try {
              await api(
                "/api/operations/organizations",
                Object.fromEntries(new FormData(form)),
              );
              setMessage(
                "Organisation created. A new manager receives an account setup email.",
              );
              form.reset();
              await load();
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Unable to create",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Onboard a business</h2>
          <div className="platform-form-grid">
            {[
              ["name", "Display name"],
              ["legalName", "Legal business name"],
              ["managerName", "Manager name"],
              ["managerEmail", "Manager email"],
              ["billingEmail", "Billing email"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  className="input"
                  name={name}
                  type={name.endsWith("Email") ? "email" : "text"}
                  required
                />
              </label>
            ))}
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create organisation"}
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      )}
      {!canCreate && message && <p role="alert">{message}</p>}
      <section className="platform-card">
        <h2>Organisations</h2>
        {rows.map((row) => (
          <p key={row._id}>
            {row.name} · {row.managerId?.email} · {row.billingEmail}
          </p>
        ))}
      </section>
    </div>
  );
}
