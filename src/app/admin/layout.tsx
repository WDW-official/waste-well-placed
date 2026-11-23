import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
import { getSession } from "@/lib/auth";
import { backoffice } from "@/lib/operations/policy";
import { redirect } from "next/navigation";
import { AdminWorkspace } from "@/components/admin-workspace";
import { adminLinksForRole } from "@/lib/admin-links";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getSession();
  if (!u) redirect("/login");
  if (!backoffice(u.role)) redirect("/account");
  return (
    <AdminWorkspace role={u.role} links={adminLinksForRole(u.role)}>
      {children}
    </AdminWorkspace>
  );
}
