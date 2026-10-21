"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: OrganizationsView, organizations page, create organization, switch organization, invite member, remove member, Better Auth organization client
 * WHAT:  Lists the user's organizations, switches the active one, shows its members, invites by
 *        email (when invites are enabled) and removes members.
 * WHY:   Everything goes through Better Auth's organization plugin (it enforces owner/admin roles);
 *        the server page decides whether the feature is on.
 * WHERE: app/dashboard/organizations/page.tsx.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Building2, Plus, Users, Mail, Crown, UserMinus } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@starter/ui/components/dialog";
import { OrganizationsSkeleton } from "@/components/skeletons";

type Org = typeof authClient.$Infer.Organization;
type FullOrg = typeof authClient.$Infer.ActiveOrganization;
type InviteRole = "member" | "admin";

const ORGS_KEY = ["auth", "organizations"] as const;

const INVITE_ROLES: readonly InviteRole[] = ["member", "admin"];
const toInviteRole = (v: string): InviteRole | null => INVITE_ROLES.find((r) => r === v) ?? null;
const inviteEmailSchema = z.email();

export function OrganizationsView({
  invitesEnabled,
  currentUserId,
}: {
  invitesEnabled: boolean;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");

  const orgsQuery = useQuery({
    queryKey: ORGS_KEY,
    queryFn: async (): Promise<Org[]> => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message || "Failed to load organizations");
      return data;
    },
  });
  const orgs = orgsQuery.data ?? [];
  // Batman opens the first organization until the user picks another.
  const shownOrgId = selectedOrgId ?? orgs[0]?.id ?? null;

  const orgQuery = useQuery({
    queryKey: [...ORGS_KEY, shownOrgId],
    enabled: shownOrgId !== null,
    queryFn: async (): Promise<FullOrg | null> => {
      if (!shownOrgId) return null;
      const { data, error } = await authClient.organization.getFullOrganization({
        query: { organizationId: shownOrgId },
      });
      if (error) throw new Error(error.message || "Failed to load organization");
      return data;
    },
  });
  const activeOrg = orgQuery.data ?? null;
  const loading = orgsQuery.isPending || (shownOrgId !== null && orgQuery.isPending);

  const loadData = () => queryClient.invalidateQueries({ queryKey: ORGS_KEY });
  const loadOrgDetails = (orgId: string) => queryClient.invalidateQueries({ queryKey: [...ORGS_KEY, orgId] });

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) return;
    startTransition(async () => {
      const { data, error } = await authClient.organization.create({
        name: newName.trim(),
        slug: newSlug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-"),
      });
      if (error || !data) {
        toast.error(error?.message || "Failed to create organization");
        return;
      }
      toast.success("Organization created");
      setCreateOpen(false);
      setNewName("");
      setNewSlug("");
      await loadData();
    });
  }

  async function handleSwitchOrg(orgId: string) {
    startTransition(async () => {
      const { error } = await authClient.organization.setActive({ organizationId: orgId });
      if (error) {
        toast.error(error.message || "Failed to switch organization");
        return;
      }
      setSelectedOrgId(orgId);
      toast.success("Switched organization");
    });
  }

  async function handleInvite() {
    if (!activeOrg) return;
    const email = inviteEmailSchema.safeParse(inviteEmail.trim());
    if (!email.success) {
      toast.error("Enter a valid email address");
      return;
    }
    const orgId = activeOrg.id;
    startTransition(async () => {
      const { error } = await authClient.organization.inviteMember({
        email: email.data,
        role: inviteRole,
        organizationId: orgId,
      });
      if (error) {
        toast.error(error.message || "Failed to send invitation");
        return;
      }
      toast.success(`Invitation sent to ${email.data}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      await loadOrgDetails(orgId);
    });
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeOrg) return;
    const orgId = activeOrg.id;
    startTransition(async () => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: orgId,
      });
      if (error) {
        toast.error(error.message || "Failed to remove member");
        return;
      }
      toast.success("Member removed");
      await loadOrgDetails(orgId);
    });
  }

  if (loading) return <OrganizationsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Create and manage your teams.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs gap-1.5">
              <Plus className="h-3 w-3" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-sm">Create Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                placeholder="Organization name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
                }}
                className="text-sm"
              />
              <Input
                placeholder="slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="text-sm text-muted-foreground"
              />
              <Button
                onClick={handleCreate}
                disabled={isPending || !newName.trim()}
                size="sm"
                className="w-full text-xs"
              >
                {isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Org list */}
      {orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <Building2 className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <h3 className="text-sm font-medium">No organizations</h3>
          <p className="text-xs text-muted-foreground mt-1">Create your first organization to start collaborating.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {orgs.map((org) => {
            const isActive = activeOrg?.id === org.id;
            return (
              <button
                key={org.id}
                onClick={() => handleSwitchOrg(org.id)}
                className={`w-full text-left border p-3 transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">{org.name}</p>
                    <p className="text-[10px] text-muted-foreground">/{org.slug}</p>
                  </div>
                  {isActive && (
                    <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active org details */}
      {activeOrg && (
        <div className="border border-border">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{activeOrg.name}</h2>
              <p className="text-[10px] text-muted-foreground">
                {activeOrg.members?.length ?? 0} member{(activeOrg.members?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-1.5">
              {invitesEnabled && (
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7">
                      <Mail className="h-3 w-3" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-sm">Invite Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <Input
                        placeholder="Email address"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="text-sm"
                      />
                      <Select
                        value={inviteRole}
                        onValueChange={(v) => {
                          const role = toInviteRole(v);
                          if (role) setInviteRole(role);
                        }}
                      >
                        <SelectTrigger className="text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleInvite}
                        disabled={isPending || !inviteEmail.trim()}
                        size="sm"
                        className="w-full text-xs"
                      >
                        {isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div className="divide-y divide-border">
            {activeOrg.members?.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 bg-primary/10 border border-border flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary">
                      {member.user.name.charAt(0).toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{member.user.name || "Unnamed"}</p>
                      {member.role === "owner" && <Crown className="h-2.5 w-2.5 text-primary" />}
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1 py-px">
                        {member.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                </div>
                {member.userId !== currentUserId && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isPending}
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            {(!activeOrg.members || activeOrg.members.length === 0) && (
              <div className="p-6 text-center">
                <Users className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No members yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
