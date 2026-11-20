"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
import { gbp } from "@/lib/utils";
export function BusinessReports() {
  const [from, setFrom] = useState(
      new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [data, setData] = useState<{
      records: {
        reference: string;
        date: string;
        totalMinor: number;
        weightKg: number | null;
      }[];
      summary: { collections: number; totalMinor: number; weightKg: number };
    } | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api(`/api/business/reports?from=${from}&to=${to}`));
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load");
    }
  }, [from, to]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="card p-7 platform-form">
      <div className="platform-form-grid">
        <label>
          From
          <input
            className="input"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            className="input"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      <a
        className="btn btn-outline"
        href={`/api/business/reports?from=${from}&to=${to}&format=csv`}
      >
        Download CSV report
      </a>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {data.summary.collections} verified collections ·{" "}
            {gbp(data.summary.totalMinor)} · {data.summary.weightKg} kg recorded
            weight
          </p>
          <p className="muted">
            Only verified collections are included. No recycling or diversion
            rates are inferred. Up to 1,000 records are shown; narrow the date
            range for larger histories.
          </p>
          {data.records.map((row) => (
            <p key={row.reference}>
              {row.reference} · {new Date(row.date).toLocaleDateString("en-GB")}{" "}
              · {gbp(row.totalMinor)}
              {row.weightKg != null ? ` · ${row.weightKg} kg` : ""}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
