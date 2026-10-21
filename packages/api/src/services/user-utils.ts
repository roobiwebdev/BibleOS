/**
 * SOURCE OF TRUTH KEYWORDS: describeProfileChanges, resolveUserGate, profile change summary, Profile updated notification, user guards
 * WHAT:  Pure user helpers: the "Profile updated" change list and the signed-in redirect rules.
 * WHY:   Batman listed only the fields that were actually provided ("name, bio, avatar").
 * WHERE: routers/user.ts (updateProfile), apps/web layouts (resolveUserGate).
 */
export function describeProfileChanges(patch: { name?: string; bio?: string | null; image?: string | null }): string[] {
  const changes: string[] = [];
  if (patch.name) changes.push("name");
  if (patch.bio) changes.push("bio");
  if (patch.image) changes.push("avatar");
  return changes;
}

export type UserGateInput = {
  user: { role?: string | null; emailVerified: boolean; onboardingCompleted?: boolean | null };
  settings: { maintenanceMode: boolean; emailVerificationEnabled: boolean; onboardingEnabled: boolean };
};

export type UserGateRedirect = "/maintenance" | "/verify-email" | "/onboarding" | null;

/**
 * SOURCE OF TRUTH KEYWORDS: resolveUserGate, UserGateRedirect, dashboard guard, maintenance redirect, verify email redirect, onboarding redirect
 * WHAT:  Decides where a signed-in user must go before reaching the app, in Batman's order:
 *        maintenance (non-admins) -> email verification -> unfinished onboarding.
 * WHY:   The dashboard, auth, verify-email and onboarding layouts all apply the same rules; one
 *        pure function keeps them from drifting apart.
 * WHERE: apps/web dashboard layout, (auth) layout, verify-email page, onboarding layout.
 */
export function resolveUserGate({ user, settings }: UserGateInput): UserGateRedirect {
  if (settings.maintenanceMode && user.role !== "admin") return "/maintenance";
  if (settings.emailVerificationEnabled && !user.emailVerified) return "/verify-email";
  if (settings.onboardingEnabled && !user.onboardingCompleted) return "/onboarding";
  return null;
}
