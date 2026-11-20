"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
import { resourceFields } from "@/lib/admin-resource-fields";
import { defaultLoads } from "@/lib/catalog-defaults";
import { Select } from "./select";
export function AdminCreateRecord({
  name,
  onCreated,
}: {
  name: string;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({
    active: "true",
    published: "false",
  });
  const [zones, setZones] = useState<{ _id: string; name: string }[]>([]);
  useEffect(() => {
    if (name === "slots")
      void api<{ rows: { _id: string; name: string }[] }>(
        "/api/admin/collections?name=zones",
      )
        .then((data) => setZones(data.rows))
        .catch(() => {});
  }, [name]);
  if (!resourceFields[name]) return null;
  return (
    <div className="mb-6">
      <button className="btn btn-outline" onClick={() => setOpen(!open)}>
        {open ? "Close" : "Add record"}
      </button>
      {open && (
        <form
          className="card p-6 platform-form mt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const record: Record<string, unknown> = {};
              for (const field of resourceFields[name]) {
                const value = values[field.key];
                if (value === undefined || value === "") continue;
                record[field.key] =
                  field.type === "number"
                    ? Number(value)
                    : field.type === "boolean"
                      ? value === "true"
                      : field.type === "json"
                        ? JSON.parse(value)
                        : field.type === "datetime"
                          ? new Date(value).toISOString()
                          : value;
              }
              await api("/api/admin/collections", { name, record });
              setOpen(false);
              await onCreated();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Unable to create record",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="platform-form-grid">
            {resourceFields[name].map((field) => (
              <label key={field.key}>
                {field.label}
                {field.type === "boolean" ? (
                  <Select
                    value={values[field.key] ?? "false"}
                    onValueChange={(value) =>
                      setValues({ ...values, [field.key]: value })
                    }
                    options={[
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                  />
                ) : field.key === "zoneId" ? (
                  <Select
                    value={values.zoneId ?? ""}
                    onValueChange={(value) =>
                      setValues({ ...values, zoneId: value })
                    }
                    options={[
                      {
                        value: "",
                        label: "Choose service area",
                        disabled: true,
                      },
                      ...zones.map((zone) => ({
                        value: zone._id,
                        label: zone.name,
                      })),
                    ]}
                  />
                ) : name === "tariffs" && field.key === "key" ? (
                  <Select
                    value={values.key ?? ""}
                    onValueChange={(value) =>
                      setValues({
                        ...values,
                        key: value,
                        title:
                          defaultLoads.find((load) => load.key === value)
                            ?.title ?? "",
                      })
                    }
                    options={[
                      { value: "", label: "Choose load", disabled: true },
                      ...defaultLoads.map((load) => ({
                        value: load.key,
                        label: load.title,
                      })),
                    ]}
                  />
                ) : field.type === "textarea" || field.type === "json" ? (
                  <textarea
                    className="input"
                    required={field.required}
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                  />
                ) : (
                  <input
                    className="input"
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "datetime"
                          ? "datetime-local"
                          : "text"
                    }
                    required={field.required}
                    min={field.type === "number" ? 0 : undefined}
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                  />
                )}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create record"}
          </button>
        </form>
      )}
    </div>
  );
}
