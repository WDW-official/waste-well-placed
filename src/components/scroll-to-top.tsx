"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let frame = 0;

    function resetScroll() {
      cancelAnimationFrame(frame);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      // Run again after navigation commits and the browser restores its page.
      frame = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        frame = requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        });
      });
    }

    resetScroll();
    window.addEventListener("popstate", resetScroll);
    window.addEventListener("pageshow", resetScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", resetScroll);
      window.removeEventListener("pageshow", resetScroll);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [pathname, searchParams]);

  return null;
}
