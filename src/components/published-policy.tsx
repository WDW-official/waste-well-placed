"use client";
import { useEffect, useState } from "react";
export function PublishedPolicy({
  kind,
  children,
}: {
  kind: "privacyText" | "termsText";
  children: React.ReactNode;
}) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/company")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setText(data.company?.[kind] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kind]);
  return text ? (
    <article className="article section px-6 whitespace-pre-line">
      {text}
    </article>
  ) : (
    children
  );
}
