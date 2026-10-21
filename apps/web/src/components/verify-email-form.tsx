"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: VerifyEmailForm, resend verification email, email verification
 * WHAT:  Button that re-sends the verification email (link lands on /onboarding).
 * WHERE: app/verify-email/page.tsx.
 */
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@starter/ui/components/button";

import { authClient } from "@/lib/auth-client";

export function VerifyEmailForm({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setLoading(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Failed to send. Try again later.");
      return;
    }
    toast.success("Verification email sent. Check your inbox.");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleResend} disabled={loading} className="mt-6">
      {loading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          Sending...
        </>
      ) : (
        "Resend verification email"
      )}
    </Button>
  );
}
