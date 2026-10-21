"use client";
/** Admin > Feedback: status counters, category/status filters, and per-item triage (status + note). */
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@starter/api";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_VALUES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
} from "@starter/config/content";
import { MessageSquare, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Button } from "@starter/ui/components/button";
import { Textarea } from "@starter/ui/components/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@starter/ui/components/avatar";
import { FeedbackSkeleton } from "@/components/skeletons";

const STATUS_OPTIONS = FEEDBACK_STATUSES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

const toStatus = (v: string): FeedbackStatus | null => FEEDBACK_STATUSES.find((s) => s === v) ?? null;
const toCategory = (v: string): FeedbackCategory | null => FEEDBACK_CATEGORY_VALUES.find((c) => c === v) ?? null;

const CATEGORY_STYLES: Record<string, string> = {
  "feature-request": "bg-foreground/10 text-foreground",
  bug: "bg-foreground/10 text-foreground",
  improvement: "bg-foreground/10 text-foreground",
  question: "bg-foreground/10 text-foreground",
  other: "bg-foreground/10 text-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-foreground text-background",
  reviewed: "bg-foreground/20 text-foreground",
  planned: "bg-foreground/30 text-foreground",
  resolved: "bg-foreground/15 text-foreground/60",
  closed: "bg-muted text-muted-foreground",
};

function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

type FeedbackList = RouterOutputs["feedback"]["adminList"];
type FeedbackItem = FeedbackList["feedback"][number];
type FeedbackStats = RouterOutputs["feedback"]["stats"];

export default function AdminFeedbackPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const listQuery = useQuery({
    ...trpc.feedback.adminList.queryOptions({ page, limit: 15, category: filterCategory, status: filterStatus }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(trpc.feedback.stats.queryOptions());
  const data: FeedbackList | undefined = listQuery.data;
  const stats: FeedbackStats | undefined = statsQuery.data;
  const isPending = listQuery.isFetching;

  const updateStatus = useMutation(
    trpc.feedback.updateStatus.mutationOptions({
      onSuccess: async () => {
        toast.success("Feedback updated");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.feedback.adminList.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.feedback.stats.queryKey() }),
        ]);
      },
      onError: () => toast.error("Failed to update feedback"),
    }),
  );

  function handleStatusChange(id: string, newStatus: FeedbackStatus, adminNote?: string) {
    updateStatus.mutate({ id, status: newStatus, adminNote });
  }

  if (!data || !stats) return <FeedbackSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Feedback</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">User feedback, feature requests, and bug reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Total", value: stats.total },
          { label: "Open", value: stats.open },
          { label: "Reviewed", value: stats.reviewed },
          { label: "Planned", value: stats.planned },
          { label: "Resolved", value: stats.resolved },
        ].map((s) => (
          <div key={s.label} className="border border-border/40 bg-card/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{s.label}</p>
            <p className="text-lg font-semibold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <Select
          value={filterCategory}
          onValueChange={(v) => {
            setFilterCategory(toCategory(v) ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-7 text-[11px] w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Categories
            </SelectItem>
            {FEEDBACK_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setFilterStatus(toStatus(v) ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-7 text-[11px] w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Statuses
            </SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {data.total} result{data.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Feedback list */}
      {data.feedback.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-6 w-6 text-muted-foreground/30 mb-3" />
          <p className="text-xs text-muted-foreground">No feedback yet</p>
        </div>
      ) : (
        <div className="border border-border/40 divide-y divide-border/30">
          {data.feedback.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Page {data.currentPage} of {data.pages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={page <= 1 || isPending}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={page >= data.pages || isPending}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackRow({
  item,
  expanded,
  onToggle,
  onStatusChange,
}: {
  item: FeedbackItem;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: FeedbackStatus, note?: string) => void;
}) {
  const [note, setNote] = useState(item.adminNote ?? "");
  const categoryLabel = FEEDBACK_CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category;

  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full text-left p-3 hover:bg-muted/20 transition-colors">
        <div className="flex items-start gap-3">
          <Avatar className="h-6 w-6 shrink-0 mt-0.5">
            <AvatarImage src={item.user?.image ?? undefined} />
            <AvatarFallback className="text-[9px] font-bold bg-primary/10">
              {item.user?.name.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium">{item.user?.name || "Unknown"}</span>
              <span
                className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px ${CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.other}`}
              >
                {categoryLabel}
              </span>
              <span
                className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px ${STATUS_STYLES[item.status] ?? STATUS_STYLES.open ?? ""}`}
              >
                {item.status}
              </span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">{timeAgo(item.createdAt)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{item.message}</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 ml-9 space-y-3 border-t border-border/20 mt-0">
          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
              Full Message
            </p>
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">{item.message}</p>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span>{item.user?.email}</span>
            <span>&middot;</span>
            <span>{new Date(item.createdAt).toLocaleString()}</span>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
              Admin Note
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Status</p>
            <div className="flex items-center gap-1.5 ml-auto">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onStatusChange(item.id, s.value, note)}
                  className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-1 transition-colors ${
                    item.status === s.value
                      ? STATUS_STYLES[s.value]
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
