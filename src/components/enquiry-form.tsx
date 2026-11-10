"use client";
import { useState } from "react";
import { request } from "@/lib/booking-client";
import { toast } from "sonner";
export function EnquiryForm({
  type,
}: {
  type: "business" | "contact" | "coverage";
}) {
  const [f, setF] = useState({
      name: "",
      email: "",
      phone: "",
      company: "",
      message: "",
    }),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await request("/api/enquiries", { ...f, type });
      setDone(true);
      toast.success("Enquiry sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send enquiry");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="card p-8">
        Thank you — we have received your enquiry.
      </div>
    );
  return (
    <form onSubmit={submit} className="card p-7">
      <div className="form-grid">
        {[
          { key: "name", label: "Your name", type: "text" },
          { key: "email", label: "Email address", type: "email" },
          { key: "phone", label: "Phone", type: "tel" },
          ...(type === "business"
            ? [{ key: "company", label: "Company name", type: "text" }]
            : []),
        ].map((x) => (
          <div key={x.key}>
            <label className="label" htmlFor={x.key}>
              {x.label}
            </label>
            <input
              className="input"
              type={x.type}
              required={["name", "email"].includes(x.key)}
              id={x.key}
              value={f[x.key as keyof typeof f]}
              onChange={(e) => setF((s) => ({ ...s, [x.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <label className="label mt-5" htmlFor="message">
        Tell us how we can help
      </label>
      <textarea
        id="message"
        required
        minLength={10}
        maxLength={4000}
        className="input min-h-40"
        value={f.message}
        onChange={(e) => setF((s) => ({ ...s, message: e.target.value }))}
      />
      <button disabled={busy} className="btn btn-primary mt-5">
        {busy ? "Submitting…" : "Send enquiry"}
      </button>
    </form>
  );
}
