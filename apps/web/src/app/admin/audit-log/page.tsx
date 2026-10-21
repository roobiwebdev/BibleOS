"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: AdminAuditLogPage, audit log viewer, activity history, who did what, audit filter
 * WHAT:  Paginated table of audit_log rows (every successful mutation), filterable by entity.
 * WHY:   The procedure builder writes an audit row for each mutation; admins need to read them
 *        without opening the database.
 * WHERE: /admin/audit-log (Core module nav).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import type { RouterOutputs } from "@starter/api";

import { getAuditLog } from "@/lib/actions/admin";
import { AuditLogSkeleton } from "@/components/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@starter/ui/components/avatar";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@starter/ui/components/table";

type AuditLogPage = RouterOutputs["admin"]["auditLog"];

const PAGE_SIZE = 25;
const ALL = "all";

function formatTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState(ALL);
  const queryKey = `${page}|${entity}`;
  const [result, setResult] = useState<{ key: string; data: AuditLogPage } | null>(null);
  const data = result?.data ?? null;
  // Keep showing the previous page (dimmed) until the new one arrives.
  const loading = result?.key !== queryKey;

  useEffect(() => {
    let cancelled = false;
    getAuditLog({ page, limit: PAGE_SIZE, ...(entity !== ALL ? { entity } : {}) })
      .then((next) => {
        if (!cancelled) setResult({ key: `${page}|${entity}`, data: next });
      })
      .catch(() => toast.error("Failed to load the audit log"));
    return () => {
      cancelled = true;
    };
  }, [page, entity]);

  if (!data) return <AuditLogSkeleton />;

  const { rows, total, totalPages, entities } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Audit Log</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {total} event{total !== 1 ? "s" : ""} &middot; every change made through the app, newest first
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          <Select
            value={entity}
            onValueChange={(v) => {
              setEntity(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-[11px] w-40">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">
                All entities
              </SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`border border-border/30 overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Time", "User", "Entity", "Action", "Entity ID", "Description", "IP"].map((h) => (
                <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-wider">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-10">
                  No audit events yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatTime(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    {row.user ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={row.user.image ?? ""} />
                          <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                            {row.user.name.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium truncate max-w-40">{row.user.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-40">{row.user.email}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">System / anonymous</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[9px]">
                      {row.entity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] font-medium">{row.action}</TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">
                    <span className="block truncate max-w-28" title={row.entityId ?? undefined}>
                      {row.entityId ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    <span className="block truncate max-w-64" title={row.description ?? undefined}>
                      {row.description ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-[10px] font-mono text-muted-foreground whitespace-nowrap"
                    title={row.userAgent ?? undefined}
                  >
                    {row.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Page {page} of {totalPages} &middot; {total} total
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
