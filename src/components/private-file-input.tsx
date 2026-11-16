"use client";
import { useState } from "react";
import { uploadPrivate } from "@/lib/operations/client";
export function PrivateFileInput({
  label,
  purpose,
  value,
  onChange,
  multiple = false,
}: {
  label: string;
  purpose: string;
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="platform-upload">
      <label className="label">
        {label}
        <input
          type="file"
          accept={
            purpose === "quote"
              ? "image/jpeg,image/png,image/webp"
              : "image/jpeg,image/png,image/webp,application/pdf"
          }
          multiple={multiple}
          disabled={busy}
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            if (!files.length) return;
            setBusy(true);
            setError("");
            try {
              const ids = multiple ? [...value] : [];
              for (const file of files) {
                if (ids.length >= 12) break;
                const uploaded = await uploadPrivate(file, purpose);
                ids.push(uploaded.assetId);
              }
              onChange(ids);
            } catch (failure) {
              setError(
                failure instanceof Error ? failure.message : "Upload failed",
              );
            } finally {
              setBusy(false);
              event.target.value = "";
            }
          }}
        />
      </label>
      {busy && <p role="status">Uploading securely…</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="platform-files">
        {value.map((id) => (
          <span key={id}>
            <a href={`/api/assets/${id}`} target="_blank" rel="noreferrer">
              View file
            </a>
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== id))}
              aria-label="Remove uploaded file"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
