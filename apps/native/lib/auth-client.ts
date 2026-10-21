/**
 * SOURCE OF TRUTH KEYWORDS: native authClient, expoClient, SecureStore, mobile auth
 * WHAT:  Better Auth client for the Expo app; talks to the web app's /api/auth.
 * WHY:   The web server's auth config trusts the `project-starter://` scheme (server/services.ts).
 *        Keep APP_SCHEME in sync with app.json "scheme".
 */
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { ENV } from "../src/env";

const APP_SCHEME = "project-starter";

export const authClient = createAuthClient({
  baseURL: ENV.EXPO_PUBLIC_SERVER_URL,
  plugins: [expoClient({ scheme: APP_SCHEME, storagePrefix: APP_SCHEME, storage: SecureStore })],
});
