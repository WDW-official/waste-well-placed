import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PlatformShell } from "@/components/platform-shell";
import { DriverWorkspace } from "@/components/driver-workspace";
export default async function DriverPage() {
  const user = await getSession();
  if (!user) redirect("/driver/login");
  if (user.role !== "driver") redirect("/account");
  if (user.driverPasswordPending) redirect("/driver/apply");
  return (
    <PlatformShell
      title="Your driver workspace"
      subtitle="Availability, collections, evidence and earnings."
      links={[
        { name: "Workspace", href: "/driver" },
        { name: "Application", href: "/driver/apply" },
        { name: "Sign out", href: "/driver/logout" },
      ]}
    >
      <DriverWorkspace />
    </PlatformShell>
  );
}
