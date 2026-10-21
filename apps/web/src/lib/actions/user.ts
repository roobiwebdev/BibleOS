"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: user actions, getMe, updateProfile, completeOnboarding
 * WHAT:  Server-action adapters over the user router (no logic here).
 * WHY:   App settings, auth config and storage URLs moved to lib/actions/settings.ts and the
 *        upload route; only profile actions remain here.
 * WHERE: profile settings page, onboarding wizard.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

export async function getMe() {
  return (await api()).user.me();
}

export async function updateProfile(input: RouterInputs["user"]["updateProfile"]) {
  return (await api()).user.updateProfile(input);
}

export async function completeOnboarding() {
  return (await api()).user.completeOnboarding();
}
