"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/operations/client";
export function PasswordRecovery({ token }: { token?: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="card p-7 platform-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        const form = new FormData(event.currentTarget);
        if (token && form.get("password") !== form.get("confirmPassword")) {
          setError("Passwords must match.");
          return;
        }
        setBusy(true);
        try {
          const result = await api<{ message?: string }>(
            `/api/auth/${token ? "reset-password" : "forgot-password"}`,
            token
              ? { token, password: form.get("password") }
              : { email: form.get("email") },
          );
          if (token) {
            router.replace("/login?reset=success");
          } else setMessage(result.message!);
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : "Unable to continue",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-bold">
        {token ? "Choose a new password" : "Recover your account"}
      </h2>
      {token ? (
        <>
          <label>
            New password
            <input
              className="input"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={120}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              className="input"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={120}
              required
            />
          </label>
        </>
      ) : (
        <label>
          Email address
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy
          ? "Please wait…"
          : token
            ? "Save new password"
            : "Email me a secure link"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Link href={token ? "/forgot-password" : "/login"} className="underline">
        {token ? "Request another link" : "Back to sign in"}
      </Link>
    </form>
  );
}
