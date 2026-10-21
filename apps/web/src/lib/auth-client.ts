/**
 * SOURCE OF TRUTH KEYWORDS: authClient, signIn, signUp, signOut, useSession, organization client, admin client
 * WHAT:  Browser Better Auth client with the admin and organization plugins.
 * WHERE: client components (forms, user menu, org pages, admin users page).
 */
import { ac, roles } from "@starter/auth/permissions";
import { adminClient, inferAdditionalFields, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    adminClient({ ac, roles }),
    organizationClient(),
    inferAdditionalFields({
      user: {
        bio: { type: "string", required: false },
        onboardingCompleted: { type: "boolean", required: false },
      },
    }),
  ],
});
