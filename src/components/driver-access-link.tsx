"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/operations/client";
import { DriverEmailAccess } from "./driver-email-access";

export function DriverAccessLink({
  token,
  purpose,
}: {
  token: string;
  purpose: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setup = purpose === "password_setup";
  if (
    !/^[a-f\d]{64}$/i.test(token) ||
    !["application", "password_setup"].includes(purpose)
  )
    return (
      <>
        <p className="platform-notice">
          This link is invalid. Request a new access link below.
        </p>
        <DriverEmailAccess />
      </>
    );
  return (
    <div className="platform-stack">
      <form
        className="platform-card platform-form max-w-lg"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const form = new FormData(event.currentTarget);
          if (setup && form.get("password") !== form.get("confirmPassword")) {
            setError("Passwords must match.");
            return;
          }
          setBusy(true);
          try {
            const result = await api<{ href: string }>("/api/driver/access", {
              token,
              purpose,
              ...(setup ? { password: form.get("password") } : {}),
            });
            router.replace(result.href);
            router.refresh();
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Unable to use this link",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>
          {setup
            ? "Your application is approved"
            : "Return to your application"}
        </h2>
        <p>
          {setup
            ? "Choose a password to finish activating your driver access."
            : "Continue securely without a password. This link can be used once."}
        </p>
        {setup && (
          <>
            <label>
              Choose your password
              <input
                className="input"
                type="password"
                name="password"
                minLength={12}
                maxLength={120}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirm password
              <input
                className="input"
                type="password"
                name="confirmPassword"
                minLength={12}
                maxLength={120}
                autoComplete="new-password"
                required
              />
            </label>
          </>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : setup
              ? "Set password and continue"
              : "Continue application"}
        </button>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {error && <DriverEmailAccess />}
    </div>
  );
}
