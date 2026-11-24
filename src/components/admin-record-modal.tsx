"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/lib/booking-client";
import { moneyInput } from "@/lib/operations/client";
import { gbp } from "@/lib/utils";
import { AdminImageInput, AdminImagePreview } from "./admin-image-input";
import {
  resourceFields,
  type ResourceField,
} from "@/lib/admin-resource-fields";

export type AdminRow = { _id: string; [key: string]: unknown };

export function adminFieldLabel(key: string) {
  return key === "_id"
    ? "Record ID"
    : key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replaceAll("_", " ")
        .replace(/^./, (character) => character.toUpperCase());
}

function fieldFor(name: string, key: string, value: unknown): ResourceField {
  return (
    resourceFields[name]?.find((field) => field.key === key) ?? {
      key,
      label: adminFieldLabel(key),
      type:
        typeof value === "boolean"
          ? "boolean"
          : typeof value === "number" || key.endsWith("Minor")
            ? "number"
            : Array.isArray(value) ||
                (value !== null && typeof value === "object")
              ? "json"
              : ["text", "body", "notes", "description"].includes(key)
                ? "textarea"
                : "text",
    }
  );
}

function inputValue(value: unknown, type: ResourceField["type"]) {
  if (type === "boolean") return value === true ? "true" : "false";
  if (value === null || value === undefined) return "";
  if (type === "money") return (Number(value) / 100).toFixed(2);
  if (type === "json") return JSON.stringify(value, null, 2);
  if (type === "datetime") {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  }
  return String(value);
}

export function AdminRecordModal({
  name,
  title,
  row,
  fields,
  editableFields,
  initialMode,
  onClose,
  onSaved,
}: {
  name: string;
  title: string;
  row: AdminRow;
  fields: string[];
  editableFields: string[];
  initialMode: "view" | "edit" | "price";
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const priceOnly = initialMode === "price";
  const [mode, setMode] = useState(initialMode === "view" ? "view" : "edit");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const working = busy || uploading;
  const [error, setError] = useState("");
  const editFields = editableFields
    .filter((key) => !priceOnly || key === "priceMinor")
    .map((key) => fieldFor(name, key, row[key]));
  const initialValues = Object.fromEntries(
    editFields.map((field) => [
      field.key,
      inputValue(row[field.key], field.type),
    ]),
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const dirty = editFields.some(
    (field) => values[field.key] !== initialValues[field.key],
  );
  const displayFields = Array.from(
    new Set([
      ...fields,
      ...(name === "users" ? ["phone"] : []),
      ...(resourceFields[name] ?? []).map((field) => field.key),
      ...editableFields,
      "_id",
      "createdAt",
      "updatedAt",
    ]),
  ).filter((key) => row[key] !== undefined || key === "image");
  const recordTitle = String(
    row.title ?? row.name ?? row.reference ?? row.key ?? row._id,
  );

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    if (priceOnly)
      element?.querySelector<HTMLInputElement>("#record-priceMinor")?.focus();
    return () => element?.close();
  }, [priceOnly]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (working || !dirty) return;
    setError("");
    const patch: Record<string, unknown> = {};
    try {
      for (const field of editFields) {
        const value = values[field.key];
        if (value === initialValues[field.key]) continue;
        if (field.type === "money") patch[field.key] = moneyInput(value);
        else if (field.type === "number") {
          if (!value.trim() || !Number.isFinite(Number(value)))
            throw Error(`Enter a valid number for ${field.label}.`);
          patch[field.key] = Number(value);
        } else if (field.type === "boolean")
          patch[field.key] = value === "true";
        else if (field.type === "json") {
          try {
            patch[field.key] = JSON.parse(value);
          } catch {
            throw Error(`${field.label} must be valid JSON.`);
          }
        } else if (field.type === "datetime") {
          const date = new Date(value);
          if (Number.isNaN(date.getTime()))
            throw Error(`Choose a valid date for ${field.label}.`);
          patch[field.key] = date.toISOString();
        } else patch[field.key] = value;
      }
      setBusy(true);
      await request("/api/admin/record", { name, id: row._id, patch }, "PATCH");
      await onSaved();
      toast.success("Record updated");
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to save changes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className={`admin-record-dialog${priceOnly ? " admin-price-dialog" : ""}`}
      aria-labelledby="admin-record-title"
      onClose={() => {
        // Strict Mode closes and reopens the dialog during effect replay.
        // Ignore that queued close event if the dialog is already open again.
        if (dialog.current && !dialog.current.open) onClose();
      }}
      onCancel={(event) => {
        if (working) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <form className="admin-record-panel" onSubmit={save}>
        <header className="admin-record-header">
          <span className="admin-record-symbol">
            {mode === "view" ? <Eye size={21} /> : <Pencil size={21} />}
          </span>
          <div>
            <span className="eyebrow">{title}</span>
            <h2 id="admin-record-title">
              {mode === "view"
                ? "Record details"
                : priceOnly
                  ? "Change price"
                  : "Edit record"}
            </h2>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close record"
            disabled={working}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="admin-record-body">
          <p className="admin-record-name">{recordTitle}</p>
          {mode === "view" ? (
            <dl className="admin-record-details">
              {displayFields.map((key) => {
                const value = row[key];
                return (
                  <div
                    key={key}
                    className={
                      key === "image" ||
                      typeof value === "object" ||
                      String(value).length > 100
                        ? "admin-record-detail-wide"
                        : undefined
                    }
                  >
                    <dt>{fieldFor(name, key, value).label}</dt>
                    <dd>
                      {key === "image" ? (
                        <>
                          <AdminImagePreview
                            key={String(value ?? "")}
                            src={typeof value === "string" ? value : undefined}
                            alt={recordTitle}
                          />
                          {typeof value === "string" && value && (
                            <a
                              className="admin-image-link"
                              href={value}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open full image ↗
                            </a>
                          )}
                        </>
                      ) : value === null || value === "" ? (
                        "—"
                      ) : fieldFor(name, key, value).type === "money" ? (
                        gbp(Number(value))
                      ) : typeof value === "boolean" ? (
                        value ? (
                          "Yes"
                        ) : (
                          "No"
                        )
                      ) : typeof value === "object" ? (
                        <pre>{JSON.stringify(value, null, 2)}</pre>
                      ) : (
                        String(value)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <div className="platform-form admin-record-form">
              <p className="muted">
                {priceOnly
                  ? "Enter the new price in pounds (£), then save."
                  : "Update the fields below. Your changes are saved together."}
              </p>
              {name === "slots" && Number(row.reservedCount) > 0 && (
                <p className="platform-notice">
                  This slot has reservations. Its start and end times cannot be
                  changed.
                </p>
              )}
              <div className="platform-form-grid">
                {editFields.map((field) => {
                  const locked =
                    name === "slots" &&
                    Number(row.reservedCount) > 0 &&
                    ["start", "end"].includes(field.key);
                  const id = `record-${field.key}`;
                  if (field.type === "image")
                    return (
                      <div key={field.key} className="admin-record-wide">
                        <span className="label">{field.label}</span>
                        <AdminImageInput
                          value={values[field.key] ?? ""}
                          disabled={busy}
                          onUploadingChange={setUploading}
                          onChange={(url) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: url,
                            }))
                          }
                        />
                      </div>
                    );
                  return (
                    <label
                      key={field.key}
                      htmlFor={id}
                      className={
                        field.type === "json" || field.type === "textarea"
                          ? "admin-record-wide"
                          : undefined
                      }
                    >
                      {field.label}
                      {field.type === "boolean" ? (
                        <span className="admin-record-toggle">
                          <input
                            id={id}
                            aria-label={field.label}
                            type="checkbox"
                            checked={values[field.key] === "true"}
                            disabled={working}
                            onChange={(event) =>
                              setValues({
                                ...values,
                                [field.key]: String(event.target.checked),
                              })
                            }
                          />
                          <span>
                            {values[field.key] === "true" ? "Yes" : "No"}
                          </span>
                        </span>
                      ) : field.type === "textarea" || field.type === "json" ? (
                        <textarea
                          id={id}
                          aria-label={field.label}
                          className="input"
                          rows={field.type === "json" ? 5 : 4}
                          required={field.required}
                          disabled={working}
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            setValues({
                              ...values,
                              [field.key]: event.target.value,
                            })
                          }
                          spellCheck={field.type !== "json"}
                        />
                      ) : (
                        <input
                          id={id}
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
                            (field.type === "number" ||
                              field.type === "money") &&
                            field.key !== "sortOrder"
                              ? 0
                              : undefined
                          }
                          step={
                            field.type === "money"
                              ? "0.01"
                              : field.type === "number"
                                ? 1
                                : undefined
                          }
                          inputMode={
                            field.type === "money" ? "decimal" : undefined
                          }
                          disabled={working || locked}
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
                  );
                })}
              </div>
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
        <footer className="admin-record-footer">
          <button
            type="button"
            className="btn btn-outline"
            disabled={working}
            onClick={onClose}
          >
            {mode === "view" ? "Close" : "Cancel"}
          </button>
          {mode === "view" && editFields.length > 0 && (
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => setMode("edit")}
            >
              <Pencil size={16} aria-hidden="true" />
              Edit record
            </button>
          )}
          {mode === "edit" && (
            <button className="btn btn-dark" disabled={working || !dirty}>
              {uploading
                ? "Uploading image…"
                : busy
                  ? "Saving…"
                  : priceOnly
                    ? "Save price"
                    : "Save changes"}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
