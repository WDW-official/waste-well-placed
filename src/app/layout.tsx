import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteMotion } from "@/components/site-motion";
import { FloatingActions } from "@/components/basket";
import { Toaster } from "sonner";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Waste Well Placed | Responsible UK Waste Collection",
    template: "%s | Waste Well Placed",
  },
  description:
    "Book rubbish removal, furniture and appliance collections, and request clearance quotes with Waste Well Placed.",
  openGraph: { type: "website", siteName: "Waste Well Placed" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        <SiteMotion />
        <FloatingActions />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
