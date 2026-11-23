"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";

export function AdminImagePreview({
  src,
  alt = "Record image",
}: {
  src?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="admin-image-preview">
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            hidden={failed}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
          {!loaded && !failed && (
            <div className="admin-image-loading-status" role="status">
              <LoaderCircle
                size={22}
                className="animate-spin"
                aria-hidden="true"
              />
              <span>Loading image…</span>
            </div>
          )}
          {failed && <p>Image unavailable</p>}
        </>
      ) : (
        <div className="admin-image-empty">
          <ImagePlus size={28} aria-hidden="true" />
          <span>No image added</span>
        </div>
      )}
    </div>
  );
}

export function AdminImageInput({
  value,
  onChange,
  disabled = false,
  onUploadingChange,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  async function upload(file: File) {
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 3_000_000
    ) {
      setError("Choose a JPEG, PNG or WebP image under 3 MB.");
      return;
    }
    setBusy(true);
    onUploadingChange(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/images", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error ?? "Image upload failed. Please try again.");
      onChange(data.secureUrl);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Image upload failed. Please try again.",
      );
    } finally {
      setPreview("");
      URL.revokeObjectURL(localUrl);
      setBusy(false);
      onUploadingChange(false);
    }
  }
  const src = preview || value;
  return (
    <div className="admin-image-input">
      <AdminImagePreview key={src} src={src} alt="Selected record image" />
      <input
        ref={input}
        className="sr-only"
        aria-label="Choose image file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="admin-image-actions">
        <button
          type="button"
          className="btn btn-outline"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <LoaderCircle
              className="animate-spin"
              size={17}
              aria-hidden="true"
            />
          ) : (
            <ImagePlus size={17} aria-hidden="true" />
          )}
          {busy ? "Uploading…" : value ? "Change image" : "Choose image"}
        </button>
        {value && (
          <button
            type="button"
            className="admin-image-remove"
            disabled={disabled || busy}
            onClick={() => {
              setError("");
              onChange("");
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Remove
          </button>
        )}
      </div>
      <small>
        JPEG, PNG or WebP, up to 3 MB.{" "}
        {busy
          ? "Your image is uploading."
          : "Choose an image to upload it, then save your record."}
      </small>
      {busy && <p role="status">Uploading image…</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
