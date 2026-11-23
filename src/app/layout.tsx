import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteFrame } from "@/components/site-frame";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Toaster } from "sonner";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Waste Well Placed | London Waste Collection",
    template: "%s | Waste Well Placed",
  },
  description:
    "Book rubbish removal, furniture and appliance collections in London and surrounding areas with Waste Well Placed.",
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
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <SiteFrame header={<Header />} footer={<Footer />}>
          {children}
        </SiteFrame>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
