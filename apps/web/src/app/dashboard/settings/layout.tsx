"use client";
/** Settings sub-navigation (Profile / Account / Appearance). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsNav = [
  { name: "Profile", href: "/dashboard/settings" },
  { name: "Account", href: "/dashboard/settings/account" },
  { name: "Appearance", href: "/dashboard/settings/appearance" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your account settings and preferences.</p>
      </div>

      <div className="flex gap-0.5 border-b border-border/40 mb-6">
        {settingsNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={cn(
                "px-3 py-2 text-[11px] font-medium transition-colors -mb-px",
                isActive
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
