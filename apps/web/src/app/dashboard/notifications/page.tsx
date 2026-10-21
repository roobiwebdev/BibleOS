"use client";
/** The signed-in user's notification inbox: tag / unread filters, expand to read, attachments. */
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { NOTIFICATION_TAGS } from "@starter/core/types";
import { Button } from "@starter/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Bell, Paperclip, Check, CheckCheck, Download, ChevronLeft, ChevronRight, Inbox, Filter } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { notificationTagClass, toNotificationTag } from "./_components/tag-styles";

type TagFilter = (typeof NOTIFICATION_TAGS)[number] | "all";

function timeAgo(date: Date) {
  const d = new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data } = useQuery({
    ...trpc.notifications.list.queryOptions({ tag: tagFilter, unreadOnly, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
  const notifications = data?.notifications ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const currentPage = data?.currentPage ?? page;

  async function afterChange() {
    await queryClient.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() });
    // Refresh the layout so the header's unread badge drops too.
    router.refresh();
  }

  const markRead = useMutation(trpc.notifications.markRead.mutationOptions({ onSuccess: afterChange }));
  const markAll = useMutation(trpc.notifications.markAllRead.mutationOptions({ onSuccess: afterChange }));
  const isPending = markRead.isPending || markAll.isPending;

  function handleMarkRead(id: string) {
    markRead.mutate({ id });
  }

  function handleMarkAllRead() {
    markAll.mutate();
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} notification{total !== 1 ? "s" : ""}{" "}
            {unreadCount > 0 && <span className="text-primary font-medium">— {unreadCount} unread</span>}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-7"
            onClick={handleMarkAllRead}
            disabled={isPending}
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Filter</span>
        </div>
        <Select
          value={tagFilter}
          onValueChange={(v) => {
            setTagFilter(toNotificationTag(v) ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {NOTIFICATION_TAGS.map((t) => (
              <SelectItem key={t} value={t}>
                <span className="capitalize">{t}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => {
            setUnreadOnly(!unreadOnly);
            setPage(1);
          }}
        >
          <Bell className="h-3 w-3" />
          Unread only
        </Button>
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border">
          <Inbox className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <h3 className="text-sm font-medium">No notifications</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {unreadOnly ? "You've read all your notifications." : "You're all caught up. Nothing to see here."}
          </p>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border">
          {notifications.map((n) => {
            const isExpanded = expandedId === n.id;
            return (
              <div key={n.id} className={`transition-colors ${!n.read ? "bg-primary/2" : ""}`}>
                <button
                  onClick={() => {
                    toggleExpand(n.id);
                    if (!n.read) handleMarkRead(n.id);
                  }}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    <div className="pt-1 shrink-0">
                      {!n.read ? <div className="h-2 w-2 bg-primary" /> : <div className="h-2 w-2" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3
                          className={`text-xs truncate ${!n.read ? "font-semibold" : "font-medium text-muted-foreground"}`}
                        >
                          {n.title}
                        </h3>
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wider px-1 py-px shrink-0 ${notificationTagClass(n.tag)}`}
                        >
                          {n.tag}
                        </span>
                        {n.attachmentUrl && <Paperclip className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{n.description}</p>
                    </div>

                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pl-11 space-y-3">
                    <div className="border-l-2 border-border pl-3">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{n.description}</p>
                    </div>

                    {n.attachmentUrl && (
                      <a
                        href={n.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                      >
                        <Download className="h-3 w-3 text-muted-foreground" />
                        <span>{n.attachmentName ?? "Download attachment"}</span>
                      </a>
                    )}

                    <div className="flex items-center gap-2">
                      {!n.read ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          disabled={isPending}
                        >
                          <Check className="h-2.5 w-2.5" />
                          Mark as read
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Check className="h-2.5 w-2.5" />
                          Read
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Page {currentPage} of {pages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
