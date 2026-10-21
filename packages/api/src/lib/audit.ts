/**
 * SOURCE OF TRUTH KEYWORDS: writeAudit, AuditEntry, audit log, activity log, who did what
 * WHAT:  Writes one audit_log row. Called by the procedure builder inside the mutation's
 *        transaction, so the audit row and the change commit or roll back together.
 * WHY:   Guardrail rule: every successful protected mutation is audited automatically.
 *        Metadata is a flat map of primitives to keep rows small and free of nested PII.
 * WHERE: trpc.ts (automatic), routers needing an extra explicit entry.
 */
import "server-only";
import { schema, type DbExecutor } from "@starter/db";
import type { AuditMetadata } from "@starter/db/schema";

import type { RequestInfo } from "../context";

export type AuditEntry = {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: AuditMetadata | null;
};

export async function writeAudit(db: DbExecutor, entry: AuditEntry, request: RequestInfo): Promise<void> {
  await db.insert(schema.auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    description: entry.description ?? null,
    metadata: entry.metadata ?? null,
    ipAddress: request.ipAddress,
    userAgent: request.userAgent,
  });
}

/** Pulls an id out of a handler's output or input when present. */
export function pickEntityId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("id" in value)) return null;
  const id = value.id;
  return typeof id === "string" ? id : null;
}
