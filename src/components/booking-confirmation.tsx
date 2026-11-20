"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { clearDraft } from "@/lib/booking-client";
export function BookingConfirmation({ reference }: { reference: string }) {
  const [status, setStatus] = useState("pending");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      try {
        const response = await fetch(
          `/api/bookings/reference/${encodeURIComponent(reference)}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const { booking } = await response.json();
          if (stopped) return;
          if (booking.paymentStatus === "paid") {
            setStatus(booking.status === "payment_review" ? "review" : "paid");
            if (sessionStorage.getItem("wwp_pending_booking") === booking.id)
              clearDraft();
            return;
          }
          if (["cancelled", "expired"].includes(booking.status)) {
            setStatus(booking.status);
            return;
          }
        }
      } catch {
        /* Keep the account link available while the webhook is pending. */
      }
      if (!stopped && ++attempts < 30) timer = setTimeout(check, 2000);
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reference]);
  return (
    <div className="card p-8" role="status">
      <h2 className="text-xl font-bold">
        {status === "paid"
          ? "Your payment is confirmed"
          : status === "review"
            ? "Payment received — collection review needed"
            : ["cancelled", "expired"].includes(status)
              ? "Your reservation is no longer active"
              : "Your booking is being confirmed"}
      </h2>
      <p className="mt-4">
        Reference: <strong>{reference}</strong>
      </p>
      <p className="muted mt-4">
        {status === "paid"
          ? "Your collection is in the dispatch queue. View your account for updates."
          : status === "review"
            ? "Our team will contact you to arrange a collection or refund."
            : "Please view your account for the latest booking and payment status."}
      </p>
      <Link className="btn btn-primary mt-5" href="/account/bookings">
        View my bookings
      </Link>
    </div>
  );
}
