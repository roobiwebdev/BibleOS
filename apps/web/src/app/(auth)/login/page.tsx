import { Suspense } from "react";

import { LoginPageContent } from "@/components/login-page-content";
import { getAuthConfig } from "@/lib/actions/settings";

import { toAuthScreenConfig } from "../_components/auth-config";

export default async function LoginPage() {
  const authConfig = await getAuthConfig();

  return (
    <Suspense fallback={<div className="h-8" />}>
      <LoginPageContent signupsEnabled={authConfig.signupsEnabled} config={toAuthScreenConfig(authConfig)} />
    </Suspense>
  );
}
