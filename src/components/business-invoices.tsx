"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/operations/client";
import { gbp } from "@/lib/utils";
export function BusinessInvoices() {
  const [data, setData] = useState<{
      invoices: { _id: string; number: string; totalMinor: number }[];
      receipts: {
        _id: string;
        reference: string;
        price?: { totalMinor?: number };
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void api<NonNullable<typeof data>>("/api/business/invoices")
      .then(setData)
      .catch((error) => setError(error.message));
  }, []);
  return (
    <div className="card p-7">
      <h2 className="font-bold text-xl">Issued invoices</h2>
      {error && <p role="alert">{error}</p>}
      {data?.invoices.map((row) => (
        <p className="py-3" key={row._id}>
          <a
            className="underline"
            href={`/api/invoices/${row._id}`}
            target="_blank"
            rel="noreferrer"
          >
            {row.number} · {gbp(row.totalMinor)}
          </a>
        </p>
      ))}
      {data && !data.invoices.length && (
        <p>No invoices have been issued yet.</p>
      )}
      <h2 className="font-bold text-xl mt-6">Payment receipts</h2>
      {data?.receipts.map((row) => (
        <p className="py-3" key={row._id}>
          <a
            className="underline"
            href={`/api/bookings/${row._id}/receipt`}
            target="_blank"
            rel="noreferrer"
          >
            {row.reference} · {gbp(row.price?.totalMinor ?? 0)}
          </a>
        </p>
      ))}
    </div>
  );
}
