"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: Header, public header, top nav, app name, mode toggle, user menu
 * WHAT:  Simple public top bar: logo + app name, Home/Dashboard links, theme and account menus.
 * WHERE: optional public layouts (pass the runtime app name from getPublicSettings()).
 */
import { BRANDING } from "@starter/config/branding";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header({ appName = BRANDING.appName }: { appName?: string }) {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="h-4 w-auto text-primary" />
            <span className="text-xs font-semibold tracking-widest uppercase">{appName}</span>
          </Link>
          <nav className="flex gap-4">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                href={to}
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <div className="border-b border-border/30" />
    </div>
  );
}
