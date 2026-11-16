import { DriverPwa } from "@/components/driver-pwa";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Driver workspace",
  manifest: "/driver/manifest.webmanifest",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DriverPwa />
      {children}
    </>
  );
}
