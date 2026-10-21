import { resolveUserGate } from "@starter/api/services/user-utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { VerifyEmailForm } from "@/components/verify-email-form";
import { getSession } from "@/server/session";
import { api } from "@/server/trpc";

const emailParam = z.email();

/**
 * "Check your inbox" screen. Signed-in but unverified users land here from the dashboard guard;
 * freshly signed-up users (not signed in until they verify) arrive with ?email= so they can resend.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const [session, settings, params] = await Promise.all([getSession(), (await api()).settings.public(), searchParams]);

  let email: string;
  if (session) {
    const gate = resolveUserGate({ user: session.user, settings });
    if (gate === "/maintenance") redirect(gate);
    if (gate !== "/verify-email") redirect("/dashboard");
    email = session.user.email;
  } else {
    const parsed = emailParam.safeParse(params.email);
    if (!settings.emailVerificationEnabled || !parsed.success) redirect("/login");
    email = parsed.data;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 flex h-12 items-center justify-between">
          <Link href="/" className="text-[11px] font-semibold tracking-widest uppercase">
            {settings.appName}
          </Link>
          <Link href="/login" className="text-[11px] text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-lg font-semibold tracking-tight">Verify your email</h1>
          <p className="text-xs text-muted-foreground mt-2">
            We sent a verification link to <strong>{email}</strong>. Click the link to verify your account and access
            the app.
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-4">
            Didn&apos;t receive the email? Check your spam folder or resend below.
          </p>
          <VerifyEmailForm email={email} />
        </div>
      </main>
    </div>
  );
}
