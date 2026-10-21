"use client";
/**
 * Admin > Notifications: compose a message (tag, optional attachment) for every user or a
 * searched selection, and review sent history with delivery and read counts.
 */
import { useState, useEffect, useTransition } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@starter/api";
import { NOTIFICATION_TAGS, type NotificationTag } from "@starter/core/types";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Checkbox } from "@starter/ui/components/checkbox";
import { toast } from "sonner";
import { Send, Paperclip, X, Users, Clock, Eye, ChevronLeft, ChevronRight, Search, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@starter/ui/components/dialog";
import { sendNotification, sendNotificationToAll } from "@/lib/actions/notifications";
import { useTRPC } from "@/lib/trpc/client";
import { uploadFile } from "@/lib/upload";
import { notificationTagClass, toNotificationTag } from "@/app/dashboard/notifications/_components/tag-styles";
import { z } from "zod";

type UserOption = RouterOutputs["notifications"]["searchUsers"][number];
type HistoryItem = RouterOutputs["notifications"]["history"]["notifications"][number];

const composeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().trim().min(1, "Description is required").max(5000, "Description is too long"),
});

export default function AdminNotificationsPage() {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState<NotificationTag>("general");
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    ...trpc.notifications.history.queryOptions({ page: historyPage, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const history: HistoryItem[] = historyQuery.data?.notifications ?? [];
  const historyPages = historyQuery.data?.pages ?? 1;
  const historyTotal = historyQuery.data?.total ?? 0;

  // Debounce typing before searching recipients.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const usersQuery = useQuery({
    ...trpc.notifications.searchUsers.queryOptions({ query: debouncedSearch }),
    enabled: !sendToAll,
  });
  const users: UserOption[] = usersQuery.data ?? [];
  const userSearching = usersQuery.isFetching;

  function loadHistory(page: number) {
    setHistoryPage(page);
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  const filteredUsers = users;

  async function handleSend() {
    const parsed = composeSchema.safeParse({ title, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (!sendToAll && selectedUsers.length === 0) {
      return toast.error("Select at least one recipient");
    }

    startTransition(async () => {
      try {
        let attachmentUrl: string | undefined;
        let attachmentName: string | undefined;

        if (attachment) {
          const result = await uploadFile("attachments", attachment);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          attachmentUrl = result.url;
          attachmentName = attachment.name;
        }

        if (sendToAll) {
          await sendNotificationToAll({
            title: parsed.data.title,
            description: parsed.data.description,
            tag,
            attachmentUrl,
            attachmentName,
          });
        } else {
          await sendNotification({
            title: parsed.data.title,
            description: parsed.data.description,
            tag,
            attachmentUrl,
            attachmentName,
            recipientIds: selectedUsers,
          });
        }

        toast.success("Notification sent");
        setTitle("");
        setDescription("");
        setTag("general");
        setAttachment(null);
        setSelectedUsers([]);
        setSendToAll(true);
        setCreateOpen(false);
        setHistoryPage(1);
        await queryClient.invalidateQueries({ queryKey: trpc.notifications.history.queryKey() });
      } catch {
        toast.error("Failed to send notification");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Notifications</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Compose and send messages to your users.</p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Create message
        </Button>
      </div>

      {/* Create message dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Create message</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="notif-title" className="text-[11px] font-medium">
                  Title
                </Label>
                <Input
                  id="notif-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notif-tag" className="text-[11px] font-medium">
                  Tag
                </Label>
                <Select
                  value={tag}
                  onValueChange={(v) => {
                    const next = toNotificationTag(v);
                    if (next) setTag(next);
                  }}
                >
                  <SelectTrigger id="notif-tag" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TAGS.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        <span className="capitalize">{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-desc" className="text-[11px] font-medium">
                Description
              </Label>
              <Textarea
                id="notif-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write the notification body..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            {/* Attachment */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium">Attachment (optional)</Label>
              {attachment ? (
                <div className="flex items-center gap-2 border border-input rounded-md p-2.5 bg-muted/20">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">{attachment.name}</span>
                  <span className="text-[10px] text-muted-foreground">{(attachment.size / 1024).toFixed(1)} KB</span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border border-dashed border-input rounded-md p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to attach a file</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setAttachment(file);
                    }}
                  />
                </label>
              )}
            </div>

            {/* Recipients */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="send-to-all" checked={sendToAll} onCheckedChange={(c) => setSendToAll(c === true)} />
                <Label htmlFor="send-to-all" className="text-[11px] font-medium cursor-pointer">
                  Send to all users
                </Label>
              </div>

              {!sendToAll && (
                <div className="border border-border/40 rounded-md overflow-hidden">
                  <div className="p-2 border-b border-border/30 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users by name or email..."
                      className="h-8 text-xs pl-8"
                    />
                    {userSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground animate-spin" />
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border/30">
                    {filteredUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 cursor-pointer">
                        <Checkbox checked={selectedUsers.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{u.name || "Unnamed"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </label>
                    ))}
                    {filteredUsers.length === 0 && !userSearching && (
                      <p className="p-3 text-xs text-muted-foreground text-center">
                        {userSearch ? "No users found" : "Type to search users..."}
                      </p>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="p-2 border-t border-border/30 bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">
                        {selectedUsers.length} user
                        {selectedUsers.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSend} disabled={isPending} size="sm" className="h-8 text-xs gap-1.5">
              <Send className="h-3 w-3" />
              {isPending ? "Sending..." : "Send Notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History section */}
      <div className="border border-border/40 bg-card/50">
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
          <div>
            <p className="text-xs font-semibold">Sent History</p>
            <p className="text-[10px] text-muted-foreground">
              {historyTotal} notification{historyTotal !== 1 ? "s" : ""} sent
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Send className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground">No notifications sent yet</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/30">
              {history.map((item) => (
                <div key={item.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xs font-semibold truncate">{item.title}</h3>
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px ${notificationTagClass(item.tag)}`}
                        >
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                      {item.attachmentName && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Paperclip className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{item.attachmentName}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Users className="h-2.5 w-2.5" />
                          {item.recipientCount}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Eye className="h-2.5 w-2.5" />
                          {item.readCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {historyPages > 1 && (
              <div className="border-t border-border/30 px-4 py-2.5 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Page {historyPage} of {historyPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={historyPage <= 1}
                    onClick={() => loadHistory(historyPage - 1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={historyPage >= historyPages}
                    onClick={() => loadHistory(historyPage + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
