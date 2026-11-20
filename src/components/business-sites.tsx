"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
export function BusinessSites() {
  const [sites, setSites] = useState<
      { name: string; address: string; postcode: string }[]
    >([]),
    [email, setEmail] = useState(""),
    [canEdit, setCanEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void api<{
      organization: { sites: typeof sites; billingEmail?: string };
      canEdit: boolean;
    }>("/api/business/sites")
      .then((data) => {
        setSites(data.organization.sites);
        setEmail(data.organization.billingEmail ?? "");
        setCanEdit(data.canEdit);
      })
      .catch((error) => setMessage(error.message));
  }, []);
  return (
    <form
      className="card p-7 platform-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await api(
            "/api/business/sites",
            {
              billingEmail: email,
              sites: sites.map(({ name, address, postcode }) => ({
                name,
                address,
                postcode,
              })),
            },
            "PATCH",
          );
          setMessage("Business sites saved.");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Unable to save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Billing email
        <input
          className="input"
          type="email"
          value={email}
          disabled={!canEdit}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {sites.map((site, index) => (
        <fieldset className="border rounded-xl p-4" key={index}>
          <legend>Collection site {index + 1}</legend>
          {[
            ["name", "Site name"],
            ["address", "Address"],
            ["postcode", "Postcode"],
          ].map(([key, label]) => (
            <label className="block my-3" key={key}>
              {label}
              <input
                className="input"
                disabled={!canEdit}
                required
                value={site[key as keyof typeof site]}
                onChange={(event) =>
                  setSites((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, [key]: event.target.value } : row,
                    ),
                  )
                }
              />
            </label>
          ))}
          {canEdit && (
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setSites(sites.filter((_, i) => i !== index))}
            >
              Remove site
            </button>
          )}
        </fieldset>
      ))}
      {canEdit && (
        <div className="platform-actions">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() =>
              setSites([...sites, { name: "", address: "", postcode: "" }])
            }
          >
            Add collection site
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save sites"}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
