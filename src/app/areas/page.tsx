"use client";
import { useState } from "react";
import { PageTitle } from "@/components/page-title";
export default function Areas() {
  const [postcode, setPostcode] = useState(""),
    [result, setResult] = useState<string | null>(null),
    [loading, setLoading] = useState(false);
  async function check() {
    setLoading(true);
    try {
      const r = await fetch("/api/coverage/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode }),
      });
      const j = await r.json();
      setResult(
        r.ok
          ? j.covered
            ? `We collect at ${j.location.postcode}. You can start a booking and choose an available collection time.`
            : "Check your UK postcode and try again."
          : j.error || "Unable to check right now",
      );
    } catch {
      setResult("Unable to check now");
    }
    setLoading(false);
  }
  return (
    <>
      <PageTitle
        title="We cover all UK postcodes"
        desc="Check your postcode, then choose an available collection time when you book."
      />
      <div className="container section max-w-xl">
        <label className="label" htmlFor="postcode">
          UK postcode
        </label>
        <div className="flex gap-3">
          <input
            id="postcode"
            className="input"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="SW1A 1AA"
          />
          <button
            className="btn btn-primary"
            onClick={check}
            disabled={loading}
          >
            Check
          </button>
        </div>
        {result && (
          <p aria-live="polite" className="card p-5 mt-5">
            {result}
          </p>
        )}
      </div>
    </>
  );
}
