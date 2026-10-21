"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: SignInForm, SocialSignInButtons, AuthScreenConfig, email sign in, Google login, GitHub login, social login
 * WHAT:  Email + password sign-in form, plus the social provider buttons shared with sign-up.
 * WHY:   Which providers and links show is decided on the server (getAuthConfig) and passed in,
 *        so the form never flashes buttons that are switched off. Google and GitHub appear only
 *        when an admin enabled social login and saved that provider's keys.
 * WHERE: components/login-page-content.tsx, components/sign-up-form.tsx (SocialSignInButtons).
 */
import { useForm } from "@tanstack/react-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";

import { authClient } from "@/lib/auth-client";

export type AuthScreenConfig = {
  googleEnabled: boolean;
  githubEnabled: boolean;
  forgotPasswordEnabled: boolean;
  emailVerificationEnabled: boolean;
};

type SocialProvider = "google" | "github";

const PROVIDER_LABELS: Record<SocialProvider, string> = { google: "Google", github: "GitHub" };

function GoogleMark() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

/** Google / GitHub buttons followed by an "or" divider. Renders nothing when no provider is on. */
export function SocialSignInButtons({ config }: { config: Pick<AuthScreenConfig, "googleEnabled" | "githubEnabled"> }) {
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const providers: SocialProvider[] = [];
  if (config.googleEnabled) providers.push("google");
  if (config.githubEnabled) providers.push("github");
  if (providers.length === 0) return null;

  async function handleSocialLogin(provider: SocialProvider) {
    setSocialLoading(provider);
    const { error } = await authClient.signIn.social({ provider, callbackURL: "/dashboard" });
    if (error) {
      toast.error(error.message || `Failed to sign in with ${PROVIDER_LABELS[provider]}`);
      setSocialLoading(null);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            className="flex-1 h-8 text-[11px] border border-border/40 hover:border-border/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            onClick={() => handleSocialLogin(provider)}
            disabled={socialLoading !== null}
          >
            {provider === "google" ? <GoogleMark /> : <GitHubMark />}
            {socialLoading === provider ? <Loader2 className="h-3 w-3 animate-spin" /> : PROVIDER_LABELS[provider]}
          </button>
        ))}
      </div>
      <div className="relative flex items-center">
        <div className="flex-1 h-px bg-border/40" />
        <span className="px-2.5 text-[10px] text-muted-foreground/40">or</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
    </>
  );
}

/** Field error list in the auth forms' style. */
export function FieldErrors({ errors }: { errors: ReadonlyArray<{ message?: string } | undefined> }) {
  return (
    <>
      {errors.map((error, i) =>
        error?.message ? (
          <p key={`${error.message}-${i}`} className="text-[10px] text-destructive">
            {error.message}
          </p>
        ) : null,
      )}
    </>
  );
}

const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function SignInForm({ config }: { config: AuthScreenConfig }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email({ email: value.email, password: value.password });
      if (error) {
        if (error.status === 403) {
          toast.error("Please verify your email before signing in. Check your inbox for the verification link.");
          if (config.emailVerificationEnabled) {
            router.push(`/verify-email?email=${encodeURIComponent(value.email)}` as never);
          }
          return;
        }
        toast.error(error.message || error.statusText);
        return;
      }
      toast.success("Sign in successful");
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
              <div className="flex items-center justify-between">
                <Label htmlFor={field.name} className="text-[11px]">
                  Password
                </Label>
                {config.forgotPasswordEnabled && (
                  <Link
                    href={"/forgot-password" as never}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
