"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: ForgotPasswordForm, request password reset, reset link
 * WHAT:  Asks for an email and requests a password reset link from Better Auth.
 * WHERE: app/(auth)/forgot-password/page.tsx.
 */
import { useForm } from "@tanstack/react-form";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";

import { FieldErrors } from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";

const schema = z.object({ email: z.email("Invalid email address") });

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.requestPasswordReset({ email: value.email, redirectTo: "/reset-password" });
      if (error) {
        toast.error(error.message || "Failed to send reset link");
        return;
      }
      setSentTo(value.email);
      toast.success("Reset link sent — check your email");
    },
  });

  if (sentTo) {
    return (
      <div className="text-center py-4">
        <div className="h-9 w-9 mx-auto bg-muted/40 border border-border/40 flex items-center justify-center mb-4">
          <Mail className="h-3.5 w-3.5 text-foreground/60" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">Check your email</h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          We sent a password reset link to <strong className="text-foreground">{sentTo}</strong>.
        </p>
        <Button asChild variant="ghost" size="sm" className="text-[11px] h-7 gap-1.5 mt-5">
          <Link href="/login">
            <ArrowLeft className="h-3 w-3" />
            Back to login
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Reset password</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Enter your email and we&apos;ll send you a reset link</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Email
              </Label>
              <Input
                id={field.name}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-8 text-xs"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting, email: s.values.email })}>
          {({ isSubmitting, email }) => (
            <Button
              type="submit"
              className="w-full h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
