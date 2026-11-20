import { getSession } from "@/lib/auth";
import { permitted } from "@/lib/operations/policy";
import { PlatformShell } from "@/components/platform-shell";
export async function OperationsLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const user = await getSession();
  const role = user?.role ?? "";
  const links = [
    ...((["operations", "verify", "finance"] as const).some((permission) =>
      permitted(role, permission),
    )
      ? [{ name: "Jobs", href: "/admin/jobs" }]
      : []),
    ...(permitted(role, "operations")
      ? [
          { name: "Overview", href: "/admin" },
          { name: "Quotes", href: "/admin/quotes" },
          { name: "Issues", href: "/admin/issues" },
          { name: "Business enquiries", href: "/admin/enquiries" },
          { name: "Organisations", href: "/admin/organizations" },
          { name: "Company & launch", href: "/admin/settings" },
        ]
      : []),
    ...(permitted(role, "drivers")
      ? [{ name: "Drivers", href: "/admin/drivers" }]
      : []),
    ...(permitted(role, "verify")
      ? [{ name: "Facilities", href: "/admin/facilities" }]
      : []),
    ...(permitted(role, "finance")
      ? [{ name: "Payouts", href: "/admin/payouts" }]
      : []),
    ...(permitted(role, "policy")
      ? [{ name: "Operational policy", href: "/admin/operations-settings" }]
      : []),
    ...(permitted(role, "operations")
      ? [
          { name: "Tariffs & areas", href: "/admin/pricing" },
          { name: "Notifications", href: "/admin/notifications" },
          { name: "Reviews", href: "/admin/reviews" },
          { name: "Catalog", href: "/admin/catalog" },
          { name: "Slots", href: "/admin/slots" },
          { name: "Areas", href: "/admin/areas" },
          { name: "Content", href: "/admin/content" },
        ]
      : []),
  ];
  return (
    <PlatformShell
      title={title}
      subtitle="London and surrounding areas · Operations workspace"
      links={links}
    >
      {children}
    </PlatformShell>
  );
}
