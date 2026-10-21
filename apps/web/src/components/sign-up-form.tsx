"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: SignUpForm, create account, register, email sign up
 * WHAT:  Name + email + password registration form with the shared social buttons.
 * WHY:   When email verification is on, Better Auth does not sign the user in until they click
 *        the emailed link, so we send them to /verify-email with their address (to allow resends).
 * WHERE: app/(auth)/signup/page.tsx.
 */
import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";

import { authClient } from "@/lib/auth-client";

import { type AuthScreenConfig, FieldErrors, SocialSignInButtons } from "./sign-in-form";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function SignUpForm({ config }: { config: AuthScreenConfig }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.name.trim(),
        callbackURL: "/onboarding",
      });
      if (error) {
        toast.error(error.message || error.statusText);
        return;
      }
      if (config.emailVerificationEnabled) {
        toast.success("Check your email to verify your account");
        router.push(`/verify-email?email=${encodeURIComponent(value.email)}` as never);
        return;
      }
      toast.success("Account created");
      router.push("/dashboard");
      router.refresh();
    },
  });

  return (
    <div className="space-y-4">
      <SocialSignInButtons config={config} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-3"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Full Name
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-8 text-xs"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Email
              </Label>
              <Input
                id={field.name}
                name={field.name}
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

        <form.Field name="password">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-8 text-xs pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
          {(state) => (
            <Button
              type="submit"
              className="w-full h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
