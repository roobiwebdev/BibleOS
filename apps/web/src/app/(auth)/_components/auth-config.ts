/**
 * SOURCE OF TRUTH KEYWORDS: toAuthScreenConfig, auth screen config mapper
 * WHAT:  Picks the fields the sign-in / sign-up forms need from settings.authConfig.
 * WHERE: login and signup pages.
 */
import type { RouterOutputs } from "@starter/api";

import type { AuthScreenConfig } from "@/components/sign-in-form";

export function toAuthScreenConfig(c: RouterOutputs["settings"]["authConfig"]): AuthScreenConfig {
  return {
    googleEnabled: c.googleEnabled,
    githubEnabled: c.githubEnabled,
    forgotPasswordEnabled: c.forgotPasswordEnabled,
    emailVerificationEnabled: c.emailVerificationEnabled,
  };
}
