/**
 * SOURCE OF TRUTH KEYWORDS: slugify, blog slug, resolvePublishedAt, publishedAt, post publishing, pagination, pageCount
 * WHAT:  Pure helpers for the blog router: slug generation, publish-date rules and page maths.
 * WHY:   Kept free of database and server-only imports so the rules (ported from Batman) are
 *        unit tested in isolation.
 * WHERE: packages/api/src/routers/blog.ts, blog-utils.test.ts.
 */

/** Lowercase, URL-safe slug ("Hello, World!" -> "hello-world"). Empty when nothing usable remains. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Batman's publish rule: publishing keeps the first publish date (or stamps now),
 * unpublishing clears it.
 */
export function resolvePublishedAt(published: boolean, previous: Date | null, now: Date = new Date()): Date | null {
  if (!published) return null;
  return previous ?? now;
}

/** Number of pages for a total row count (0 rows -> 0 pages, like Batman). */
export function pageCount(total: number, limit: number): number {
  return limit > 0 ? Math.ceil(total / limit) : 0;
}
