"use client";

import { usePathname } from "next/navigation";
import { SiteMotion } from "./site-motion";
import { FloatingActions } from "./basket";

export function SiteFrame({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return children;
  return (
    <>
      {header}
      <main id="main-content">{children}</main>
      {footer}
      <SiteMotion />
      <FloatingActions />
    </>
  );
}
