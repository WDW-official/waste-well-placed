import { permitted, type Permission } from "./operations/policy";

type AdminLink = {
  name: string;
  href: string;
  group: string;
  permissions: Permission[];
};

export const adminLinks: AdminLink[] = [
  {
    name: "Overview",
    href: "/admin",
    group: "Operations",
    permissions: ["operations"],
  },
  {
    name: "Jobs",
    href: "/admin/jobs",
    group: "Operations",
    permissions: ["operations", "verify", "finance"],
  },
  {
    name: "Quotes",
    href: "/admin/quotes",
    group: "Operations",
    permissions: ["operations"],
  },
  {
    name: "Issues",
    href: "/admin/issues",
    group: "Operations",
    permissions: ["operations"],
  },
  {
    name: "Enquiries",
    href: "/admin/enquiries",
    group: "Operations",
    permissions: ["operations"],
  },
  {
    name: "Drivers",
    href: "/admin/drivers",
    group: "People & partners",
    permissions: ["drivers"],
  },
  {
    name: "Customers",
    href: "/admin/customers",
    group: "People & partners",
    permissions: ["operations"],
  },
  {
    name: "Organisations",
    href: "/admin/organizations",
    group: "People & partners",
    permissions: ["operations"],
  },
  {
    name: "Team directory",
    href: "/admin/teams",
    group: "People & partners",
    permissions: ["operations"],
  },
  {
    name: "Facilities",
    href: "/admin/facilities",
    group: "People & partners",
    permissions: ["verify"],
  },
  {
    name: "Payouts",
    href: "/admin/payouts",
    group: "Finance",
    permissions: ["finance"],
  },
  {
    name: "Reports",
    href: "/admin/reports",
    group: "Finance",
    permissions: ["finance"],
  },
  {
    name: "Pricing",
    href: "/admin/pricing",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Catalog",
    href: "/admin/catalog",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Slots",
    href: "/admin/slots",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Areas",
    href: "/admin/areas",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Content",
    href: "/admin/content",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Reviews",
    href: "/admin/reviews",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    group: "Manage",
    permissions: ["operations"],
  },
  {
    name: "Company & launch",
    href: "/admin/settings",
    group: "Settings",
    permissions: ["operations"],
  },
  {
    name: "Operational policy",
    href: "/admin/operations-settings",
    group: "Settings",
    permissions: ["policy"],
  },
];

export function adminLinksForRole(role: string) {
  return adminLinks.filter((link) =>
    link.permissions.some((permission) => permitted(role, permission)),
  );
}
