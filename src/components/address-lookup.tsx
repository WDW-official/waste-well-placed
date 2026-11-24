"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, LoaderCircle } from "lucide-react";

export function AddressLookup({
  value,
  onPostcodeChange,
  onSelect,
  id = "address-postcode",
  manualInputId,
  required = true,
}: {
  value: string;
  onPostcodeChange: (postcode: string) => void;
  onSelect: (address: { postcode: string; city: string }) => void;
  id?: string;
  manualInputId: string;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function find() {
    const version = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/postcodes/lookup?postcode=${encodeURIComponent(value.trim())}`,
        { signal: abort.signal, cache: "no-store" },
      );
      const data = (await response.json()) as {
        postcode: string;
        district: string | null;
        error?: string;
      };
      if (version !== request.current) return;
      if (!response.ok)
        throw Error(
          data.error ??
            "Address lookup is unavailable. Enter your address manually below.",
        );
      onSelect({ postcode: data.postcode, city: data.district ?? "" });
      setMessage(
        data.district
          ? "Postcode and town / area filled in. Check the area and add your house number and street below."
          : "Postcode found. Add your house number, street and town / area below.",
      );
    } catch (failure) {
      if (version === request.current && !abort.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to find addresses. Enter your address manually below.",
        );
    } finally {
      if (version === request.current) setBusy(false);
    }
  }

  return (
    <div className="address-lookup">
      <label className="label" htmlFor={id}>
        UK postcode
      </label>
      <div className="address-lookup-controls">
        <div className="address-lookup-input">
          <MapPin size={18} aria-hidden="true" />
          <input
            id={id}
            className="input"
            required={required}
            maxLength={10}
            autoComplete="postal-code"
            value={value}
            placeholder="e.g. SW1A 1AA"
            onChange={(event) => {
              ++request.current;
              controller.current?.abort();
              setBusy(false);
              setMessage("");
              setError("");
              onPostcodeChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!busy && value.trim()) void find();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-dark"
          disabled={busy || !value.trim()}
          onClick={() => void find()}
        >
          {busy ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Search size={17} aria-hidden="true" />
          )}
          {busy ? "Checking…" : "Find area"}
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {/* <button
        className="address-lookup-manual"
        type="button"
        onClick={() => document.getElementById(manualInputId)?.focus()}
      >
        Enter address manually
      </button> */}
    </div>
  );
}
