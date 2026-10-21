/**
 * SOURCE OF TRUTH KEYWORDS: feedbackService, insertFeedback, listUserFeedback, listFeedback, updateFeedback, feedbackStats, feedback queries
 * WHAT:  Reusable database queries for user feedback and admin triage (no auth, no business rules).
 * WHY:   One place decides which user columns the admin triage list exposes and how the status
 *        counters are computed.
 * WHERE: packages/api/src/routers/feedback.ts.
 */
import "server-only";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

const f = schema.feedback;

export async function insertFeedback(db: DbExecutor, values: { userId: string; category: string; message: string }) {
  const [row] = await db.insert(f).values(values).returning();
  return row;
}

export function listUserFeedback(db: DbExecutor, userId: string, limit: number) {
  return db.select().from(f).where(eq(f.userId, userId)).orderBy(desc(f.createdAt)).limit(limit);
}

export type FeedbackFilter = { category: string | null; status: string | null };

export async function listFeedback(db: DbExecutor, filter: FeedbackFilter, page: { limit: number; offset: number }) {
  const parts: SQL[] = [];
  if (filter.category) parts.push(eq(f.category, filter.category));
  if (filter.status) parts.push(eq(f.status, filter.status));
  const where = parts.length > 0 ? and(...parts) : undefined;
  const [items, total] = await Promise.all([
    db
      .select({
        id: f.id,
        userId: f.userId,
        category: f.category,
        message: f.message,
        status: f.status,
        adminNote: f.adminNote,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        user: { id: schema.user.id, name: schema.user.name, email: schema.user.email, image: schema.user.image },
      })
      .from(f)
      .leftJoin(schema.user, eq(f.userId, schema.user.id))
      .where(where)
      .orderBy(desc(f.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.$count(f, where),
  ]);
  return { items, total };
}

export async function updateFeedback(db: DbExecutor, id: string, patch: { status: string; adminNote?: string }) {
  const [row] = await db.update(f).set(patch).where(eq(f.id, id)).returning();
  return row;
}

/** Totals per status in one query. */
export async function feedbackStats(db: DbExecutor) {
  const rows = await db.select({ status: f.status, n: count() }).from(f).groupBy(f.status);
  const by = new Map(rows.map((row) => [row.status, row.n]));
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return {
    total,
    open: by.get("open") ?? 0,
    reviewed: by.get("reviewed") ?? 0,
    planned: by.get("planned") ?? 0,
    resolved: by.get("resolved") ?? 0,
  };
}
