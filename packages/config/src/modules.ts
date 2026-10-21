/**
 * SOURCE OF TRUTH KEYWORDS: MODULES, ModuleKey, isModuleEnabled, DASHBOARD_NAV, ADMIN_NAV, NavItem, module registry, add module, remove module
 * WHAT:  The module registry: which prebuilt modules this project ships, and the navigation
 *        entries each one contributes to the user dashboard and the admin panel.
 * WHY:   Single source of truth for "what features does this product have". To drop a module
 *        from a new project set `enabled: false` here (nav disappears and its routes return 404
 *        via apps/web/src/proxy.ts), then optionally delete its folders (docs/engineering/modules.md).
 *        Runtime on/off switches that admins flip live in app_settings, not here.
 * WHERE: apps/web dashboard shell, admin sidebar, proxy.ts.
 */
export type NavIcon =
  | "home"
  | "bell"
  | "settings"
  | "card"
  | "building"
  | "mail"
  | "users"
  | "chart"
  | "file"
  | "message"
  | "sliders"
  | "globe"
  | "toggle"
  | "key"
  | "rocket"
  | "layout";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Only show when this app_settings boolean is on (runtime toggle). */
  requiresSetting?: "organizationsEnabled" | "invitesEnabled";
  exact?: boolean;
};

type ModuleDef = {
  label: string;
  description: string;
  enabled: boolean;
  /** Route prefixes owned by the module; blocked by proxy.ts when disabled. */
  routes: readonly string[];
  dashboardNav?: readonly NavItem[];
  adminNav?: readonly NavItem[];
};

export const MODULES = {
  core: {
    label: "Core",
    description: "Dashboard home, settings, users and site configuration. Always on.",
    enabled: true,
    routes: [],
    dashboardNav: [
      { label: "Dashboard", href: "/dashboard", icon: "home", exact: true },
      { label: "Settings", href: "/dashboard/settings", icon: "settings" },
    ],
    adminNav: [
      { label: "Overview", href: "/admin", icon: "layout", exact: true },
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "General", href: "/admin/general", icon: "sliders" },
      { label: "Features", href: "/admin/features", icon: "toggle" },
      { label: "API Keys", href: "/admin/api-keys", icon: "key" },
      { label: "Audit Log", href: "/admin/audit-log", icon: "file" },
      { label: "Deployment", href: "/admin/deployment", icon: "rocket" },
    ],
  },
  notifications: {
    label: "Notifications",
    description: "In-app inbox plus admin broadcast with tags and attachments.",
    enabled: true,
    routes: ["/dashboard/notifications", "/admin/notifications"],
    dashboardNav: [{ label: "Notifications", href: "/dashboard/notifications", icon: "bell" }],
    adminNav: [{ label: "Notifications", href: "/admin/notifications", icon: "bell" }],
  },
  organizations: {
    label: "Organizations",
    description: "Teams with owner/admin/member roles and email invitations.",
    enabled: true,
    routes: ["/dashboard/organizations", "/dashboard/invitations"],
    dashboardNav: [
      {
        label: "Organizations",
        href: "/dashboard/organizations",
        icon: "building",
        requiresSetting: "organizationsEnabled",
      },
      { label: "Invitations", href: "/dashboard/invitations", icon: "mail", requiresSetting: "invitesEnabled" },
    ],
  },
  billing: {
    label: "Billing (Polar)",
    description: "Pricing page, checkout, subscription-gated Pro area, product management.",
    enabled: true,
    routes: ["/pricing", "/subscribe", "/dashboard/pro", "/admin/products", "/api/webhooks/polar"],
    dashboardNav: [{ label: "Pro", href: "/dashboard/pro", icon: "card" }],
    adminNav: [{ label: "Products", href: "/admin/products", icon: "card" }],
  },
  blog: {
    label: "Blog",
    description: "Rich-text blog with SEO fields and public pages.",
    enabled: true,
    routes: ["/blog", "/admin/blog"],
    adminNav: [{ label: "Blog", href: "/admin/blog", icon: "file" }],
  },
  feedback: {
    label: "Feedback",
    description: "In-app feedback dialog and admin triage.",
    enabled: true,
    routes: ["/admin/feedback"],
    adminNav: [{ label: "Feedback", href: "/admin/feedback", icon: "message" }],
  },
  analytics: {
    label: "Analytics",
    description: "Admin charts: sign-ups, activity, countries.",
    enabled: true,
    routes: ["/admin/analytics"],
    adminNav: [{ label: "Analytics", href: "/admin/analytics", icon: "chart" }],
  },
  launch: {
    label: "Launch modes",
    description: "Waitlist and countdown landing modes.",
    enabled: true,
    routes: ["/admin/site-settings"],
    adminNav: [{ label: "Site Settings", href: "/admin/site-settings", icon: "globe" }],
  },
} as const satisfies Record<string, ModuleDef>;

export type ModuleKey = keyof typeof MODULES;

export function isModuleEnabled(key: ModuleKey): boolean {
  return MODULES[key].enabled;
}

const ADMIN_NAV_ORDER = [
  "/admin",
  "/admin/users",
  "/admin/analytics",
  "/admin/blog",
  "/admin/notifications",
  "/admin/products",
  "/admin/feedback",
  "/admin/general",
  "/admin/site-settings",
  "/admin/features",
  "/admin/api-keys",
  "/admin/audit-log",
  "/admin/deployment",
];

function collect(kind: "dashboardNav" | "adminNav"): NavItem[] {
  const items: NavItem[] = [];
  for (const mod of Object.values(MODULES)) {
    if (!mod.enabled) continue;
    const list: readonly NavItem[] | undefined = kind in mod ? (mod as ModuleDef)[kind] : undefined;
    if (list) items.push(...list);
  }
  return items;
}

export const DASHBOARD_NAV: readonly NavItem[] = collect("dashboardNav");
export const ADMIN_NAV: readonly NavItem[] = collect("adminNav").toSorted(
  (a, b) => ADMIN_NAV_ORDER.indexOf(a.href) - ADMIN_NAV_ORDER.indexOf(b.href),
);

/** Route prefixes that belong to disabled modules (used by proxy.ts to 404 them). */
export const DISABLED_ROUTE_PREFIXES: readonly string[] = Object.values(MODULES)
  .filter((m) => !m.enabled)
  .flatMap((m) => [...m.routes]);
