"use client";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { request } from "@/lib/booking-client";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [form, setForm] = useState({
      name: "",
      email: "",
      phone: "",
      password: "",
    }),
    [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [nextPath, setNextPath] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    if (value && (value.startsWith("/book/") || value.startsWith("/quote/")))
      setNextPath(value);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ user?: { role?: string } }>(
        `/api/auth/${mode}`,
        mode === "login"
          ? { email: form.email, password: form.password }
          : form,
      );
      toast.success(mode === "login" ? "Welcome back" : "Account created");
      router.refresh();
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(
        next &&
          (next.startsWith("/book/") || next.startsWith("/quote/")) &&
          !next.startsWith("//")
          ? next
          : result.user?.role === "driver"
            ? "/driver"
            : [
                  "admin",
                  "superadmin",
                  "dispatcher",
                  "finance",
                  "compliance",
                ].includes(result.user?.role ?? "")
              ? "/admin"
              : "/account",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="access-card access-form"
      aria-labelledby="auth-title"
      aria-busy={busy}
    >
      <div className="access-card-title">
        <div className="access-card-icon">
          <LockKeyhole size={23} aria-hidden="true" />
        </div>
        <h2 id="auth-title">
          {mode === "login" ? "Welcome back" : "Welcome"}
        </h2>
      </div>
      <p className="access-card-description">
        {mode === "login"
          ? "Log in to pick up where you left off."
          : "Create an account for your next fresh start."}
      </p>
      <nav className="access-tabs" aria-label="Account access">
        <Link
          href={`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          aria-current={mode === "login" ? "page" : undefined}
        >
          Log in
        </Link>
        <Link
          href={`/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          aria-current={mode === "register" ? "page" : undefined}
        >
          Create account
        </Link>
      </nav>
      {mode === "register" && (
        <div className="access-field">
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            autoComplete="name"
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
          />
        </div>
      )}
      <div className="access-field">
        <label className="label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm((x) => ({ ...x, email: e.target.value }))}
        />
      </div>
      {mode === "register" && (
        <div className="access-field">
          <label className="label" htmlFor="phone">
            Phone (optional)
          </label>
          <PhoneInput
            id="phone"
            className="access-phone"
            disabled={busy}
            value={form.phone}
            onValueChange={(phone) =>
              setForm((current) => ({ ...current, phone }))
            }
          />
        </div>
      )}
      <div className="access-field">
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="access-password">
          <input
            id="password"
            className="input"
            type={showPassword ? "text" : "password"}
            minLength={mode === "register" ? 12 : 1}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            value={form.password}
            onChange={(e) =>
              setForm((x) => ({ ...x, password: e.target.value }))
            }
          />
          <button
            type="button"
            className="access-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>
      {mode === "login" && (
        <Link className="access-forgot" href="/forgot-password">
          Forgot your password?
        </Link>
      )}
      <p className="access-password-hint">
        {mode === "register"
          ? "Minimum 12 characters."
          : "Keep your password secure."}
      </p>
      {error && (
        <p className="access-error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn access-submit">
        {busy ? (
          <>
            <LoaderCircle size={18} className="animate-spin" /> Please wait…
          </>
        ) : (
          <>
            {mode === "login" ? "Log in" : "Create account"}
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className="access-switch">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              className="access-text-link"
              href={`/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              className="access-text-link"
              href={`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              Log in
            </Link>
          </>
        )}
      </p>
      {mode === "login" && (
        <Link className="access-driver-link" href="/driver/login">
          Here to drive with us?{" "}
          <span>
            Driver sign in <ArrowRight size={14} />
          </span>
        </Link>
      )}
    </form>
  );
}
