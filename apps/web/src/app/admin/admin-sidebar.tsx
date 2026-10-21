"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ADMIN_NAV, type NavIcon } from "@starter/config/modules";
import { Button } from "@starter/ui/components/button";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileText,
  Globe,
  Home,
  Key,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  MessageSquare,
  Moon,
  Rocket,
  Settings,
  Settings2,
  Sun,
  ToggleRight,
  Users,
} from "lucide-react";

/** Maps the registry's icon names (packages/config/src/modules.ts) to lucide components. */
const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  bell: Bell,
  settings: Settings,
  card: CreditCard,
  building: Building2,
  mail: Mail,
  users: Users,
  chart: BarChart3,
  file: FileText,
  message: MessageSquare,
  sliders: Settings2,
  globe: Globe,
  toggle: ToggleRight,
  key: Key,
  rocket: Rocket,
  layout: LayoutDashboard,
};

const adminNav = ADMIN_NAV.map((item) => ({
  name: item.label,
  href: item.href,
  icon: NAV_ICONS[item.icon],
  exact: item.exact ?? false,
}));

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // False during SSR and hydration, true on the client: avoids a theme-dependent hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function cycle() {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      onClick={cycle}
      title={mounted ? `Theme: ${theme}` : undefined}
    >
      <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0 border-r border-border bg-card/30 hidden md:flex flex-col fixed inset-y-0 left-0 z-40">
      <div className="p-3 border-b border-border">
        <Link
          href={"/dashboard" as never}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to app
        </Link>
      </div>

      <div className="px-3 pt-4 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Admin</p>
      </div>

      <nav className="px-2 space-y-px flex-1">
        {adminNav.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={`
                flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium transition-colors
                ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden flex items-center gap-2 border-b border-border/30 pb-px mb-4 -mx-1 px-1">
      <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
        {adminNav.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={`
              shrink-0 px-2.5 py-1.5 text-[10px] font-medium transition-colors -mb-px
              ${isActive ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}
            `}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
    </div>
  );
}
