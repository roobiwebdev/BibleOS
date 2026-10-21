"use client";
/**
 * Account settings: change password, review and revoke signed-in sessions, delete the account.
 * Everything here goes straight to Better Auth through authClient (it owns credentials and
 * sessions); the "Password changed" notification is added by the auth hook on the server.
 */
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";

import { AccountSettingsSkeleton } from "@/components/skeletons";
import { FieldErrors } from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

const SESSIONS_KEY = ["auth", "sessions"] as const;

type SessionRow = { id: string; token: string; ipAddress?: string | null; userAgent?: string | null; updatedAt: Date };

function describeDevice(userAgent: string | null | undefined) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : (userAgent.split(" ")[0] ?? "Browser");
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return os ? `${browser} on ${os}` : browser;
}

export default function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message || "Failed to load sessions");
      return data;
    },
  });
  const sessions = sessionsQuery.data ?? [];
  const loadSessions = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });

  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      });
      if (error) {
        toast.error("Failed to change password. Check your current password.");
        return;
      }
      toast.success("Password updated");
      formApi.reset();
    },
  });

  if (isPending) return <AccountSettingsSkeleton />;
  if (!session) return null;

  const currentToken = session.session.token;

  async function handleRevoke(token: string) {
    setRevoking(token);
    const { error } = await authClient.revokeSession({ token });
    setRevoking(null);
    if (error) {
      toast.error("Failed to sign out that session");
      return;
    }
    toast.success("Session signed out");
    await loadSessions();
  }

  async function handleRevokeOthers() {
    setRevoking("others");
    const { error } = await authClient.revokeOtherSessions();
    setRevoking(null);
    if (error) {
      toast.error("Failed to sign out other sessions");
      return;
    }
    toast.success("Signed out of all other sessions");
    await loadSessions();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await authClient.deleteUser();
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Failed to delete account");
      return;
    }
    toast.success("Account deleted");
    router.push("/");
  }

  const sorted = sessions.toSorted((a, b) =>
    a.token === currentToken ? -1 : b.token === currentToken ? 1 : +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
  const otherCount = sessions.filter((s) => s.token !== currentToken).length;

  return (
    <div className="max-w-md space-y-8">
      {/* Change password */}
      <section>
        <SectionHeader title="Password" description="Update your password to keep your account secure." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-3"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="text-[11px]">
                  Current Password
                </Label>
                <Input
                  id={field.name}
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-8 text-xs"
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="newPassword">
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

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="text-[11px]">
                  Confirm New Password
                </Label>
                <Input
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-8 text-xs"
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-2">
            <form.Subscribe
              selector={(s) => ({
                isSubmitting: s.isSubmitting,
                filled: Boolean(s.values.currentPassword && s.values.newPassword),
              })}
            >
              {({ isSubmitting, filled }) => (
                <Button
                  type="submit"
                  disabled={isSubmitting || !filled}
                  size="sm"
                  className="text-xs h-8 bg-foreground text-background hover:bg-foreground/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </section>

      {/* Active sessions */}
      <section>
        <SectionHeader title="Sessions" description="Manage your active sessions." />
        <div className="space-y-1.5">
          {(sorted.length > 0 ? sorted : [{ ...session.session }]).map((s) => {
            const isCurrent = s.token === currentToken;
            return (
              <div key={s.token} className="flex items-center justify-between border border-border/40 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium">
                    {isCurrent ? "Current Session" : describeDevice(s.userAgent)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 truncate">
                    {s.ipAddress || "Unknown IP"} &middot;{" "}
                    {isCurrent
                      ? describeDevice(s.userAgent)
                      : `Last active ${new Date(s.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="text-[9px] font-medium text-primary">Active</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    disabled={revoking !== null}
                    onClick={() => handleRevoke(s.token)}
                  >
                    {revoking === s.token ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sign out"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {otherCount > 0 && (
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              disabled={revoking !== null}
              onClick={handleRevokeOthers}
            >
              {revoking === "others" ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Sign out other sessions
            </Button>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section>
        <div className="mb-3 pb-2 border-b border-destructive/20">
          <h3 className="text-xs font-semibold text-destructive">Danger Zone</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Irreversible actions. Proceed with caution.</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="text-xs h-8" disabled={deleting}>
              {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                This action cannot be undone. This will permanently delete your account and remove all of your data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="text-xs h-8">
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3 pb-2 border-b border-border/30">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{description}</p>
    </div>
  );
}
