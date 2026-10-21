/**
 * SOURCE OF TRUTH KEYWORDS: toPageWindow, pageCount, PageWindow, pagination, page limit offset, paginate
 * WHAT:  Pure pagination helpers shared by the notifications and feedback routers.
 * WHY:   Batman used 1-based `page` + `limit` with `pages = ceil(total / limit)`; keeping the math in
 *        one tested place means every paginated list returns the same shape.
 * WHERE: routers/notifications.ts, routers/feedback.ts.
 */
export type PageWindow = { page: number; limit: number; offset: number };

/** Normalises a 1-based page request into a limit/offset window. */
export function toPageWindow(page: number | undefined, limit: number | undefined, defaultLimit = 20): PageWindow {
  const safeLimit = Math.max(1, Math.floor(limit ?? defaultLimit));
  const safePage = Math.max(1, Math.floor(page ?? 1));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

/** Number of pages for a total (0 when there are no rows, like Batman). */
export function pageCount(total: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.ceil(total / limit);
}
