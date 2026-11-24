"use client";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { loadDraft, saveDraft, type BookingDraft } from "@/lib/booking-client";

export function useCurrentEstimate(
  setDraft: Dispatch<SetStateAction<BookingDraft | null>>,
) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      const pending = new AbortController();
      controller = pending;
      const draft = loadDraft();
      setChecking(true);
      try {
        const response = await fetch("/api/quotes/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: pending.signal,
          body: JSON.stringify({
            kind: draft.kind,
            postcode: draft.address?.postcode || draft.postcode,
            stairs: draft.stairs,
            longCarry: draft.longCarry,
            specialHandling: draft.specialHandling,
            ...(draft.kind === "load"
              ? { loadKey: draft.loadKey }
              : { items: draft.items }),
          }),
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "Unable to refresh your price.");
        if (active && !pending.signal.aborted) {
          const updated = { ...loadDraft(), estimate: result.estimate };
          saveDraft(updated);
          setDraft(updated);
          setError("");
        }
      } catch (failure) {
        if (active && !pending.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to refresh your price.",
          );
      } finally {
        if (active && !pending.signal.aborted) setChecking(false);
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("focus", visible);
    window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("focus", visible);
      window.removeEventListener("pageshow", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [setDraft]);
  return { checking, error };
}
