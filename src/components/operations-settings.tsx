"use client";
import { useEffect, useState } from "react";
import { api, moneyInput } from "@/lib/operations/client";
import { Select } from "@/components/select";
export function OperationsSettings() {
  const [mode, setMode] = useState("fixed");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  useEffect(() => {
    void api<{ rows: { version: number }[] }>("/api/operations?view=policy")
      .then((data) => setVersion(data.rows[0]?.version ?? null))
      .catch((failure) => setMessage(failure.message));
  }, []);
  return (
    <form
      className="platform-card platform-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const form = new FormData(event.currentTarget);
        try {
          await api("/api/operations/policy", {
            minAge: Number(form.get("minAge")),
            maxPoints: Number(form.get("maxPoints")),
            minimumMarginMinor: moneyInput(form.get("margin")),
            driverPayMode: mode,
            driverRateBps: Math.round(Number(form.get("rate")) * 100),
            note: String(form.get("note")),
          });
          setMessage("Operational policy approved and versioned.");
        } catch (failure) {
          setMessage(
            failure instanceof Error ? failure.message : "Unable to save",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Owner sign-off</h2>
      <p>
        {version
          ? `Current policy version: ${version}.`
          : "No approved policy yet."}{" "}
        This policy gates driver activation and offers. Confirm the actual
        insurer, operating model and margin requirements before approving.
      </p>
      <div className="platform-form-grid">
        <label>
          Company minimum age
          <input
            type="number"
            name="minAge"
            className="input"
            min="18"
            max="70"
            defaultValue="21"
            required
          />
        </label>
        <label>
          Maximum valid points
          <input
            type="number"
            name="maxPoints"
            className="input"
            min="0"
            max="6"
            defaultValue="6"
            required
          />
        </label>
        <label>
          Minimum contribution margin (£)
          <input
            className="input"
            name="margin"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </label>
        <label>
          Driver pay method
          <Select
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "fixed", label: "Explicit fixed amount per offer" },
              {
                value: "percentage",
                label: "Percentage of eligible net revenue",
              },
            ]}
          />
        </label>
        <label>
          Percentage, if applicable
          <input
            className="input"
            name="rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue="0"
          />
        </label>
      </div>
      <label>
        Basis for approval
        <textarea
          className="input"
          name="note"
          required
          minLength={10}
          maxLength={1000}
        />
      </label>
      <p className="muted">
        Percentage uses revenue excluding VAT, refunds and declared pass-through
        charges. Every offered amount and policy version is frozen on the
        assignment. GPS, AI decisions and automatic payouts remain disabled.
      </p>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Approve policy"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
