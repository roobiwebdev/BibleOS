/**
 * SOURCE OF TRUTH KEYWORDS: BRANDING, appName default, logo, supportEmail, seo defaults, rebrand
 * WHAT:  Build-time brand defaults for a new project.
 * WHY:   Rebranding a new product starts here. Admin > General can still override the name,
 *        description and SEO at runtime (stored in app_settings); these values are the fallback
 *        when the database is unavailable. New databases start from the column defaults in
 *        packages/db/src/schema/app.ts; keep the two in sync when rebranding.
 * WHERE: apps/web layout metadata, emails, seed script, native app header.
 */
export const BRANDING = {
  appName: "Project Starter",
  tagline: "Ship your next product without rebuilding the plumbing.",
  description: "A production-ready starter with auth, admin, organizations, billing and more.",
  logoPath: "/logo.svg",
  supportEmail: "",
  defaultTheme: "default",
} as const;
