"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Moon, Sun } from "lucide-react";
export function PlatformShell({
  title,
  subtitle,
  links = [],
  children,
}: {
  title: string;
  subtitle?: string;
  links?: { name: string; href: string }[];
  children: React.ReactNode;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(localStorage.getItem("wwp_workspace_theme") === "dark");
  }, []);
  return (
    <div className="platform-shell" data-theme={dark ? "dark" : "light"}>
      <div className="platform-header">
        <Link href="/" className="platform-brand">
          <Image
            className="platform-brand-logo"
            src="https://res.cloudinary.com/cfgipbsv/image/upload/v1794313846/Waste_Well_Placed_Logo.png"
            alt="Waste Well Placed"
            width={1448}
            height={1086}
          />
        </Link>
        <button
          type="button"
          className="platform-theme"
          onClick={() => {
            setDark(!dark);
            localStorage.setItem(
              "wwp_workspace_theme",
              dark ? "light" : "dark",
            );
          }}
          aria-label={dark ? "Use light theme" : "Use dark theme"}
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <div className="platform-container">
        <div className="platform-heading">
          <span className="eyebrow">WASTE, WELL PLACED</span>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {!!links.length && (
          <nav className="platform-nav" aria-label="Workspace navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.name}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </div>
    </div>
  );
}
