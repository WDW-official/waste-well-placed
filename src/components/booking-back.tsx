"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BookingBack({ fallback }: { fallback: string }) {
  const router = useRouter();

  return (
    <Link
      href={fallback}
      className="booking-back"
      aria-label="Go back"
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          window.history.length <= 1
        ) {
          return;
        }
        event.preventDefault();
        router.back();
      }}
    >
      <ArrowLeft size={23} aria-hidden="true" />
    </Link>
  );
}
