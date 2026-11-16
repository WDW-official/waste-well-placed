import type { Metadata } from "next";
import { CustomerQuote } from "@/components/customer-quote";
export const metadata: Metadata = {
  title: "Your quotation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <CustomerQuote
      id={(await params).id}
      token={(await searchParams).token ?? ""}
    />
  );
}
