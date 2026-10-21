"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: LoginPageContent, login screen, welcome back, signups disabled message
 * WHAT:  Login screen body: heading, query-string notices, the sign-in form and the sign-up link.
 * WHERE: app/(auth)/login/page.tsx (wrapped in Suspense for useSearchParams).
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { type AuthScreenConfig, SignInForm } from "@/components/sign-in-form";

export function LoginPageContent({ signupsEnabled, config }: { signupsEnabled: boolean; config: AuthScreenConfig }) {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Enter your credentials to continue</p>
        {message === "signups-disabled" && (
          <p className="text-xs text-destructive mt-2">Registration is currently closed.</p>
        )}
      </div>

      <SignInForm config={config} />

      {signupsEnabled ? (
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-foreground hover:underline font-medium">
            Sign up
          </Link>
        </p>
      ) : (
        <p className="mt-5 text-center text-[11px] text-muted-foreground">Registration is currently closed.</p>
      )}
    </div>
  );
}
