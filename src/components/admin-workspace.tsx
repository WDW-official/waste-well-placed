"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  PoundSterling,
  Settings,
  ShieldCheck,
  Star,
  Truck,
  Users,
  X,
} from "lucide-react";

type LinkItem = { name: string; href: string; group: string };
const icons: Record<string, typeof LayoutDashboard> = {
  "/admin": LayoutDashboard,
  "/admin/jobs": Truck,
  "/admin/quotes": ClipboardList,
  "/admin/issues": CircleHelp,
  "/admin/enquiries": MessageSquare,
  "/admin/drivers": Truck,
  "/admin/customers": Users,
  "/admin/organizations": Building2,
  "/admin/teams": Users,
  "/admin/facilities": Building2,
  "/admin/payouts": PoundSterling,
  "/admin/reports": ChartNoAxesCombined,
  "/admin/pricing": PoundSterling,
  "/admin/catalog": Package,
  "/admin/slots": CalendarDays,
  "/admin/areas": MapPin,
  "/admin/content": FileText,
  "/admin/reviews": Star,
  "/admin/notifications": Bell,
  "/admin/settings": Settings,
  "/admin/operations-settings": ShieldCheck,
};

export function AdminWorkspace({
  links,
  role,
  children,
}: {
  links: LinkItem[];
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const current = links.find((link) =>
    link.href === "/admin"
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`),
  );

  useEffect(() => {
    view.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    dialog.current?.close();
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok)
        throw new Error("Unable to sign out. Please try again.");
      router.replace("/login");
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to sign out.",
      );
      setSigningOut(false);
    }
  }

  function navigation(mobile = false) {
    return (
      <>
        <div className="admin-sidebar-brand">
          <Link
            href="/admin"
            aria-label="Waste Well Placed admin home"
            onClick={() => dialog.current?.close()}
          >
            <Image
              src="https://res.cloudinary.com/cfgipbsv/image/upload/v1794313846/Waste_Well_Placed_Logo.png"
              alt="Waste Well Placed"
              width={1448}
              height={1086}
            />
          </Link>
          <span>ADMIN</span>
          {mobile && (
            <button
              type="button"
              className="admin-icon-button"
              aria-label="Close navigation"
              onClick={() => dialog.current?.close()}
            >
              <X size={21} />
            </button>
          )}
        </div>
        <nav
          className="admin-sidebar-nav"
          aria-label={mobile ? "Mobile admin navigation" : "Admin navigation"}
        >
          {Array.from(new Set(links.map((link) => link.group))).map((group) => (
            <div className="admin-nav-group" key={group}>
              <p>{group}</p>
              {links
                .filter((link) => link.group === group)
                .map((link) => {
                  const Icon = icons[link.href] ?? FileText;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={
                        current?.href === link.href ? "page" : undefined
                      }
                      onClick={() => dialog.current?.close()}
                    >
                      <Icon size={19} aria-hidden="true" />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/" onClick={() => dialog.current?.close()}>
            <ArrowUpRight size={18} aria-hidden="true" />
            View website
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <LogOut size={18} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </>
    );
  }

  return (
    <div className="platform-shell admin-workspace">
      <aside className="admin-sidebar">{navigation()}</aside>
      <dialog
        ref={dialog}
        className="admin-mobile-dialog"
        aria-label="Admin menu"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="admin-mobile-sidebar">{navigation(true)}</div>
      </dialog>
      <div className="admin-main-column">
        <header className="admin-toolbar">
          <button
            type="button"
            className="admin-icon-button admin-menu-button"
            aria-label="Open admin navigation"
            onClick={() => dialog.current?.showModal()}
          >
            <Menu size={23} />
          </button>
          <div>
            <span className="admin-toolbar-label">Waste Well Placed</span>
            <span className="admin-toolbar-current">
              {current?.name ?? "Administration"}
            </span>
          </div>
          <span className="admin-role">
            <ShieldCheck size={15} aria-hidden="true" />
            {role === "superadmin"
              ? "Owner"
              : role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
        </header>
        <main id="main-content" className="admin-view" ref={view} tabIndex={-1}>
          <div className="admin-view-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
