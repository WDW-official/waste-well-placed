"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/operations/client";
export function DriverAccess({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="platform-card platform-form max-w-lg"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          await api(
            `/api/driver/${register ? "register" : "login"}`,
            Object.fromEntries(form),
          );
          router.push(register ? "/driver/apply" : "/driver");
          router.refresh();
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : "Unable to sign in",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {register && (
        <>
          <label>
            Full legal name
            <input
              className="input"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
            />
          </label>
          <label>
            UK phone
            <input
              className="input"
              name="phone"
              type="tel"
              autoComplete="tel"
            />
          </label>
        </>
      )}
      <label>
        Email address
        <input
          className="input"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label>
        Password
        <input
          className="input"
          name="password"
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          minLength={register ? 12 : 1}
          maxLength={120}
          required
        />
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy
          ? "Please wait…"
          : register
            ? "Create driver account"
            : "Sign in as a driver"}
      </button>
      <p>
        {register ? "Already have a driver account?" : "New to the team?"}{" "}
        <Link
          className="underline"
          href={register ? "/driver/login" : "/driver/apply"}
        >
          {register ? "Sign in" : "Apply to drive"}
        </Link>
      </p>
    </form>
  );
}
