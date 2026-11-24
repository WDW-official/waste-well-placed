"use client";
import { useEffect, useId, useRef, useState } from "react";
import { api, moneyInput } from "@/lib/operations/client";
import { resourceFields } from "@/lib/admin-resource-fields";
import { defaultLoads } from "@/lib/catalog-defaults";
import { Select } from "./select";
import { AdminImageInput } from "./admin-image-input";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { SkeletonBlock } from "./admin-skeleton";
export function AdminCreateRecord({
  name,
  onCreated,
}: {
  name: string;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!resourceFields[name]) return null;
  return (
    <div className="mb-6">
      <button
        type="button"
        className="btn btn-dark"
        onClick={() => setOpen(true)}
      >
        <Plus size={17} aria-hidden="true" />
        Add record
      </button>
      {open && (
        <CreateRecordModal
          name={name}
          onCreated={onCreated}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CreateRecordModal({
  name,
  onCreated,
  onClose,
}: {
  name: string;
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [zonesLoading, setZonesLoading] = useState(name === "slots");
  const working = busy || uploading;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
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
        .catch(() =>
          setError(
            "Service areas could not be loaded. Close and reopen this form to try again.",
          ),
        )
        .finally(() => setZonesLoading(false));
  }, [name]);
  return (
    <dialog
      ref={dialog}
      className="admin-record-dialog admin-create-dialog"
      aria-labelledby={titleId}
      onClose={() => {
        if (dialog.current && !dialog.current.open) onClose();
      }}
      onCancel={(event) => {
        if (working) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <form
        className="admin-record-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || uploading) return;
          setBusy(true);
          setError("");
          try {
            const record: Record<string, unknown> = {};
            for (const field of resourceFields[name]) {
              const value = values[field.key];
              if (value === undefined || value === "") {
                if (field.required)
                  throw Error(`Enter ${field.label.toLowerCase()}.`);
                continue;
              }
              record[field.key] =
                field.type === "money"
                  ? moneyInput(value)
                  : field.type === "number"
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
            await onCreated();
            toast.success("Record created");
            onClose();
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
        <header className="admin-record-header">
          <span className="admin-record-symbol">
            <Plus size={22} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow">
              {name === "catalog"
                ? "ITEM CATALOG"
                : name === "posts"
                  ? "ARTICLES"
                  : name === "zones"
                    ? "SERVICE AREAS"
                    : name === "slots"
                      ? "APPOINTMENT SLOTS"
                      : name === "tariffs"
                        ? "LOAD PRICING"
                        : "SERVICES"}
            </span>
            <h2 id={titleId}>Add record</h2>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close add record"
            disabled={working}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="admin-record-body platform-form">
          <p className="muted text-sm">
            Add the details below, then create your record.
          </p>
          <div className="platform-form-grid">
            {resourceFields[name].map((field) =>
              field.type === "image" ? (
                <div key={field.key} className="admin-record-wide">
                  <span className="label">{field.label}</span>
                  <AdminImageInput
                    value={values[field.key] ?? ""}
                    disabled={busy}
                    onUploadingChange={setUploading}
                    onChange={(url) =>
                      setValues((current) => ({ ...current, [field.key]: url }))
                    }
                  />
                </div>
              ) : (
                <label
                  key={field.key}
                  className={
                    field.type === "textarea" || field.type === "json"
                      ? "admin-record-wide"
                      : undefined
                  }
                >
                  {field.label}
                  {field.type === "boolean" ? (
                    <Select
                      disabled={working}
                      aria-label={field.label}
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
                    zonesLoading ? (
                      <div role="status" aria-label="Loading service areas">
                        <SkeletonBlock className="skeleton-input" />
                      </div>
                    ) : (
                      <Select
                        disabled={working}
                        aria-label={field.label}
                        value={values.zoneId ?? ""}
                        onValueChange={(value) =>
                          setValues({ ...values, zoneId: value })
                        }
                        options={[
                          {
                            value: "",
                            label: "All UK postcodes",
                          },
                          ...zones.map((zone) => ({
                            value: zone._id,
                            label: zone.name,
                          })),
                        ]}
                      />
                    )
                  ) : name === "tariffs" && field.key === "key" ? (
                    <Select
                      disabled={working}
                      aria-label={field.label}
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
                      disabled={working}
                      aria-label={field.label}
                      className="input"
                      required={field.required}
                      value={values[field.key] ?? ""}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          [field.key]: event.target.value,
                        })
                      }
                    />
                  ) : (
                    <input
                      disabled={working}
                      aria-label={field.label}
                      className="input"
                      type={
                        field.type === "number" || field.type === "money"
                          ? "number"
                          : field.type === "datetime"
                            ? "datetime-local"
                            : "text"
                      }
                      required={field.required}
                      min={
                        field.type === "number" || field.type === "money"
                          ? 0
                          : undefined
                      }
                      step={field.type === "money" ? "0.01" : undefined}
                      inputMode={field.type === "money" ? "decimal" : undefined}
                      value={values[field.key] ?? ""}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          [field.key]: event.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ),
            )}
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
        <footer className="admin-record-footer">
          <button
            type="button"
            className="btn btn-outline"
            disabled={working}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn btn-dark" disabled={working || zonesLoading}>
            {uploading
              ? "Uploading image…"
              : busy
                ? "Creating…"
                : "Create record"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
