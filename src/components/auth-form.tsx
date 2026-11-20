"use client";
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
  const router = useRouter();
  const [nextPath, setNextPath] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    if (value && (value.startsWith("/book/") || value.startsWith("/quote/")))
      setNextPath(value);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await request<{ user?: { role?: string } }>(
        `/api/auth/${mode}`,
        form,
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
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card p-8 max-w-md w-full mx-auto">
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            className="input mb-4"
            required
            value={form.name}
            onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
          />
        </div>
      )}
      <label className="label" htmlFor="email">
        Email address
      </label>
      <input
        id="email"
        className="input mb-4"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(e) => setForm((x) => ({ ...x, email: e.target.value }))}
      />
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="phone">
            Phone (optional)
          </label>
          <PhoneInput
            id="phone"
            className="mb-4"
            disabled={busy}
            value={form.phone}
            onValueChange={(phone) =>
              setForm((current) => ({ ...current, phone }))
            }
          />
        </div>
      )}
      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        className="input"
        type="password"
        minLength={mode === "register" ? 12 : 1}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        value={form.password}
        onChange={(e) => setForm((x) => ({ ...x, password: e.target.value }))}
      />
      {mode === "login" && (
        <Link className="text-sm underline mt-3 block" href="/forgot-password">
          Forgot your password?
        </Link>
      )}
      <p className="text-xs muted mt-2">
        {mode === "register"
          ? "Minimum 12 characters."
          : "Keep your password secure."}
      </p>
      <button disabled={busy} className="btn btn-primary w-full mt-6">
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="text-sm mt-5 text-center">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              className="text-green-800 underline"
              href={`/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              className="text-green-800 underline"
              href={`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
