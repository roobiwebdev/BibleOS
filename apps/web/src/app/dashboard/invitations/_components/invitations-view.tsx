"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: InvitationsView, accept invitation, decline invitation, invitation link, user.myInvitations, getInvitation
 * WHAT:  Lists the user's pending organization invitations with Accept / Decline, and highlights
 *        the one named in `?id=` (the link in the invitation email).
 * WHY:   The emailed link carries the invitation id. Opening it by id works even when the user's
 *        email is not verified (Better Auth only requires verification to *list* invitations).
 * WHERE: app/dashboard/invitations/page.tsx.
 */
import { Check, Mail, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@starter/ui/components/button";

import { InvitationsSkeleton } from "@/components/skeletons";
import { authClient } from "@/lib/auth-client";

const INVITES_KEY = ["auth", "user-invitations"] as const;

type InvitationRow = {
  id: string;
  organizationName: string;
  role: string;
  expiresAt: Date | string;
  inviterEmail?: string;
};

export function InvitationsView({ organizationsEnabled }: { organizationsEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedId = searchParams.get("id");
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const trpc = useTRPC();
  const listQuery = useQuery({
    ...trpc.user.myInvitations.queryOptions(),
    select: (rows): InvitationRow[] =>
      rows.map((i) => ({
        id: i.id,
        organizationName: i.organizationName,
        role: i.role ?? "member",
        expiresAt: i.expiresAt,
      })),
    retry: false,
  });

  const activeLinkId = linkedId && linkedId !== dismissedId ? linkedId : null;
  const linkedQuery = useQuery({
    queryKey: [...INVITES_KEY, activeLinkId],
    enabled: activeLinkId !== null,
    retry: false,
    queryFn: async (): Promise<InvitationRow> => {
      if (!activeLinkId) throw new Error("No invitation");
      const { data, error } = await authClient.organization.getInvitation({ query: { id: activeLinkId } });
      if (error || !data) throw new Error(error?.message || "This invitation is no longer available.");
      return {
        id: data.id,
        organizationName: data.organizationName,
        role: data.role,
        expiresAt: data.expiresAt,
        inviterEmail: data.inviterEmail,
      };
    },
  });

  const invitations = listQuery.data ?? [];
  const listError = listQuery.error?.message ?? null;
  const linked = activeLinkId ? (linkedQuery.data ?? null) : null;
  const linkedError = activeLinkId ? (linkedQuery.error?.message ?? null) : null;
  const loading = listQuery.isPending || (activeLinkId !== null && linkedQuery.isPending);

  const loadInvitations = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
      queryClient.invalidateQueries({ queryKey: trpc.user.myInvitations.queryKey() }),
    ]);

  function clearLink() {
    if (!linkedId) return;
    setDismissedId(linkedId);
    router.replace("/dashboard/invitations" as never);
  }

  function handleAccept(invitationId: string) {
    startTransition(async () => {
      const { error } = await authClient.organization.acceptInvitation({ invitationId });
      if (error) {
        toast.error(error.message || "Failed to accept invitation");
        return;
      }
      toast.success("Invitation accepted");
      if (invitationId === linkedId) clearLink();
      await loadInvitations();
      if (organizationsEnabled) router.push("/dashboard/organizations" as never);
    });
  }

  function handleReject(invitationId: string) {
    startTransition(async () => {
      const { error } = await authClient.organization.rejectInvitation({ invitationId });
      if (error) {
        toast.error(error.message || "Failed to decline invitation");
        return;
      }
      toast.success("Invitation declined");
      if (invitationId === linkedId) clearLink();
      await loadInvitations();
    });
  }

  if (loading) return <InvitationsSkeleton />;

  // The linked invitation is shown on its own card; avoid listing it twice.
  const others = linked ? invitations.filter((i) => i.id !== linked.id) : invitations;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Invitations</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Pending invitations to join organizations.</p>
      </div>

      {linked && (
        <div className="border border-primary bg-primary/5 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">You&apos;re invited</p>
            <p className="text-xs font-semibold truncate">{linked.organizationName}</p>
            <p className="text-[10px] text-muted-foreground">
              {linked.inviterEmail ? <>From {linked.inviterEmail} · </> : null}
              Invited as <span className="font-medium">{linked.role}</span> — expires{" "}
              {new Date(linked.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <InvitationActions id={linked.id} disabled={isPending} onAccept={handleAccept} onReject={handleReject} />
        </div>
      )}

      {linkedError && (
        <div className="border border-dashed border-destructive/40 p-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-destructive">{linkedError}</p>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearLink}>
            Dismiss
          </Button>
        </div>
      )}

      {listError && !linked && (
        <p className="text-[11px] text-muted-foreground">
          {listError} Open the link from your invitation email to respond to it.
        </p>
      )}

      {others.length === 0 && !linked ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <Mail className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <h3 className="text-sm font-medium">No pending invitations</h3>
          <p className="text-xs text-muted-foreground mt-1">
            You&apos;ll see invitations here when someone invites you to an organization.
          </p>
        </div>
      ) : others.length > 0 ? (
        <div className="border border-border divide-y divide-border">
          {others.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">{inv.organizationName}</p>
                <p className="text-[10px] text-muted-foreground">
                  Invited as <span className="font-medium">{inv.role}</span> — expires{" "}
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <InvitationActions id={inv.id} disabled={isPending} onAccept={handleAccept} onReject={handleReject} />
            </div>
          ))}
        </div>
      ) : null}

      {organizationsEnabled && (
        <p className="text-[10px] text-muted-foreground">
          Accepted invitations appear under{" "}
          <Link href={"/dashboard/organizations" as never} className="underline hover:text-foreground">
            Organizations
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function InvitationActions({
  id,
  disabled,
  onAccept,
  onReject,
}: {
  id: string;
  disabled: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 shrink-0">
      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onAccept(id)} disabled={disabled}>
        <Check className="h-2.5 w-2.5" />
        Accept
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => onReject(id)}
        disabled={disabled}
      >
        <X className="h-2.5 w-2.5" />
        Decline
      </Button>
    </div>
  );
}
