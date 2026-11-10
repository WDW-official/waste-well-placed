"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Animate the existing elements, keeping grid layouts and sticky columns intact.
const revealSelector = [
  ".hero-intro",
  ".hero-photo",
  ".hero-booking-wrap",
  ".brand-strip",
  ".section-top",
  ".home-services > *",
  ".photo-quote-banner",
  ".home-steps > *",
  ".editorial-row > *",
  ".expectation-grid > *",
  ".planet-panel",
  ".faq-layout > *",
  ".closing-panel",
  ".quote-request-intro > *",
  ".quote-request-form",
  ".booking-page-title",
  ".load-categories",
  ".load-tip",
  ".load-card",
  ".load-sidebar > *",
  ".quote-step",
  ".quote-sidebar > *",
  ".items-search",
  ".item-card",
  ".items-basket",
].join(",");
const staggerGroups = ".home-services,.home-steps,.expectation-grid,.item-grid";

export function SiteMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.getElementById("main-content");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || !window.IntersectionObserver) return;
    const seen = new WeakSet<HTMLElement>();
    const pending = new Set<HTMLElement>();
    const playing = new Map<HTMLElement, Animation>();
    let observer: IntersectionObserver | undefined;
    let mutations: MutationObserver | undefined;
    let frame = 0;

    function reveal(element: HTMLElement, delay = 0) {
      element.removeAttribute("data-motion-pending");
      pending.delete(element);
      observer?.unobserve(element);
      if (preference.matches || typeof element.animate !== "function") return;
      const animation = element.animate(
        [
          { opacity: 0, translate: "0 20px" },
          { opacity: 1, translate: "0 0" },
        ],
        {
          duration: 680,
          delay,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "backwards",
        },
      );
      playing.set(element, animation);
      animation.finished
        .then(() => {
          if (playing.get(element) === animation) playing.delete(element);
        })
        .catch(() => {
          /* Cancellation on navigation or a motion preference change. */
        });
    }

    function scan(node: HTMLElement) {
      const elements = [
        ...(node.matches(revealSelector) ? [node] : []),
        ...node.querySelectorAll<HTMLElement>(revealSelector),
      ];
      for (const element of elements) {
        if (seen.has(element) || preference.matches) continue;
        seen.add(element);
        // Never hide the focused control or a panel containing it.
        if (element.contains(document.activeElement)) continue;
        element.setAttribute("data-motion-pending", "");
        pending.add(element);
        observer?.observe(element);
      }
    }

    function stop() {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      mutations?.disconnect();
      for (const element of pending)
        element.removeAttribute("data-motion-pending");
      pending.clear();
      for (const animation of playing.values()) animation.cancel();
      playing.clear();
    }

    function start() {
      stop();
      if (preference.matches) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target as HTMLElement;
            const parent = element.parentElement;
            const siblings = parent?.matches(staggerGroups)
              ? Array.from(parent.children)
              : [];
            const index = siblings.indexOf(element);
            reveal(element, index >= 0 ? Math.min(index % 6, 4) * 65 : 0);
          }
        },
        { threshold: 0.06, rootMargin: "0px 0px -18px 0px" },
      );
      frame = requestAnimationFrame(() => scan(root!));
      mutations = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes)
            if (node instanceof HTMLElement) scan(node);
        }
      });
      mutations.observe(root!, { childList: true, subtree: true });
    }

    function focus(event: FocusEvent) {
      if (!(event.target instanceof HTMLElement)) return;
      for (const element of pending)
        if (element.contains(event.target)) reveal(element);
      // A keyboard user should never wait for a focused form to fade in.
      for (const [element, animation] of playing)
        if (element.contains(event.target)) {
          animation.cancel();
          playing.delete(element);
        }
    }

    start();
    preference.addEventListener("change", start);
    root.addEventListener("focusin", focus);
    return () => {
      stop();
      preference.removeEventListener("change", start);
      root.removeEventListener("focusin", focus);
    };
  }, [pathname]);

  return null;
}
