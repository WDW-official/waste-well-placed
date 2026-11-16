"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, localDate } from "@/lib/operations/client";
export function CollectionTimeline({ id }: { id: string }) {
  const [booking, setBooking] = useState<{
    status: string;
    paymentStatus: string;
    events: { status: string; at: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void api<{ booking: NonNullable<typeof booking> }>(`/api/bookings/${id}`)
        .then((data) => {
          if (!cancelled) setBooking(data.booking);
        })
        .catch((failure) => {
          if (!cancelled) setError(failure.message);
        });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);
  return (
    <>
      <h2 className="font-bold text-xl">Collection updates</h2>
      {error && <p role="status">{error}</p>}
      {booking && (
        <>
          <p className="mt-3">
            Status: {booking.status.replaceAll("_", " ")} · Payment:{" "}
            {booking.paymentStatus}
          </p>
          <ol className="mt-5 space-y-5">
            {booking.events.map((event, index) => (
              <li className="border-l-4 pl-4 border-green-500" key={index}>
                <strong className="capitalize">
                  {event.status.replaceAll("_", " ")}
                </strong>
                <p className="text-sm muted">{localDate(event.at)}</p>
              </li>
            ))}
          </ol>
          {["collected", "at_facility", "evidence_submitted"].includes(
            booking.status,
          ) && (
            <p className="mt-4 muted">
              Pickup is complete. Facility evidence is awaiting staff
              verification.
            </p>
          )}
          {["verified", "closed"].includes(booking.status) && (
            <Link
              className="btn btn-primary mt-5"
              href={`/api/documents/${id}`}
            >
              Download verified collection record
            </Link>
          )}
        </>
      )}
    </>
  );
}
