"use client";
import { useEffect } from "react";
export function DriverPwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      void navigator.serviceWorker
        .register("/driver-sw.js", { scope: "/driver" })
        .catch(() => {});
  }, []);
  return null;
}
