"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, localDate } from "@/lib/operations/client";
export function AccountUpdates() {
  const [rows, setRows] = useState<
    {
      _id: string;
      subject: string;
      message: string;
      href?: string;
      createdAt: string;
    }[]
  >([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void api<{ rows: typeof rows }>("/api/account/notifications")
        .then((data) => {
          if (!cancelled) setRows(data.rows);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  if (!rows.length) return null;
  return (
    <section className="card p-6 mt-6">
      <h2 className="font-bold text-xl">Your updates</h2>
      {rows.map((row) => (
        <article key={row._id} className="border-t py-4 mt-3">
          <strong>{row.subject}</strong>
          <p className="muted mt-2">{row.message}</p>
          <small>{localDate(row.createdAt)}</small>
          {row.href && (
            <Link className="block underline mt-2" href={row.href}>
              View update
            </Link>
          )}
        </article>
      ))}
    </section>
  );
}
