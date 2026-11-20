"use client";
import { useState } from "react";
import { api } from "@/lib/operations/client";

export function DriverEmailAccess() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="platform-card platform-form max-w-lg"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const result = await api<{ message: string }>(
            "/api/driver/request-access",
            { email: form.get("email") },
          );
          setMessage(result.message);
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to request a link",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Applied without a password?</h2>
      <p>
        Get an email link to return to your application. Once approved, your
        link lets you set a password.
      </p>
      <label>
        Email address
        <input
          className="input"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </label>
      <button className="btn btn-outline" disabled={busy}>
        {busy ? "Requesting…" : "Email me an access link"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
