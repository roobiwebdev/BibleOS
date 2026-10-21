"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: ResetPasswordForm, new password, reset token, password reset
 * WHAT:  Sets a new password using the `token` Better Auth appends to the emailed reset link.
 * WHY:   Batman called resetPassword without the token, which Better Auth rejects; the token is
 *        read from the URL here. An `error=INVALID_TOKEN` query means the link expired.
 * WHERE: app/(auth)/reset-password/page.tsx.
 */
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";

import { FieldErrors } from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const form = useForm({
    defaultValues: { password: "", confirm: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!token) {
        toast.error("Reset link is invalid or expired");
        return;
      }
      const { error } = await authClient.resetPassword({ newPassword: value.password, token });
      if (error) {
        toast.error("Reset link is invalid or expired");
        return;
      }
      toast.success("Password reset — you can now sign in");
      router.push("/login");
    },
  });

  const invalidLink = !token || Boolean(linkError);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">New password</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Choose a new password for your account</p>
        {invalidLink && (
          <p className="text-xs text-destructive mt-2">
            This reset link is invalid or expired.{" "}
            <Link href={"/forgot-password" as never} className="underline">
              Request a new one
            </Link>
            .
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="password">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                New Password
              </Label>
              <Input
                id={field.name}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Min 8 characters"
                className="h-8 text-xs"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Field name="confirm">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Confirm Password
              </Label>
              <Input
                id={field.name}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Repeat password"
                className="h-8 text-xs"
              />
              <FieldErrors errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
        <form.Subscribe
          selector={(s) => ({ isSubmitting: s.isSubmitting, filled: Boolean(s.values.password && s.values.confirm) })}
        >
          {({ isSubmitting, filled }) => (
            <Button
              type="submit"
              className="w-full h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
              disabled={isSubmitting || !filled || invalidLink}
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-5 text-center">
        <Link href="/login" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          Back to login
        </Link>
      </div>
    </div>
  );
}
