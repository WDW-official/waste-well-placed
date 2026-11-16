import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
import { getSession, isStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSession();
  if (!u) redirect("/login");
  if (u.role !== "crew" && !isStaff(u.role)) redirect("/account");
  return children;
}
