"use client";

import { useCallback, useEffect, useState } from "react";

export function usePriceCatalog<T>(kind: "loads" | "items") {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let controller: AbortController | undefined;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      const pending = new AbortController();
      controller = pending;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/catalog/${kind}`, {
          cache: "no-store",
          signal: pending.signal,
        });
        if (!response.ok)
          throw Error("Unable to load current prices. Please try again.");
        const result = await response.json();
        if (active && !pending.signal.aborted) {
          setData(result[kind]);
          setError("");
        }
      } catch (failure) {
        if (active && !pending.signal.aborted) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load current prices.",
          );
        }
      } finally {
        inFlight = false;
        if (active && !pending.signal.aborted) setLoading(false);
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
  }, [kind, version]);
  return { data, error, loading, retry };
}
