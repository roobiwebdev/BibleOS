/**
 * SOURCE OF TRUTH KEYWORDS: blogService, listPosts, findPostById, findPublishedPostBySlug, slugExists, post queries, authorColumns
 * WHAT:  Reusable database queries for blog posts (no auth, no business rules).
 * WHY:   The blog router composes these for both the admin editor and the public blog so the
 *        column selection (what the public may see) lives in one place.
 * WHERE: packages/api/src/routers/blog.ts.
 */
import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

const adminAuthor = { columns: { id: true, name: true, email: true, image: true } } as const;
const publicAuthor = { columns: { id: true, name: true, image: true } } as const;

export async function listPosts(db: DbExecutor, opts: { published: boolean | null; limit: number; offset: number }) {
  const where = opts.published === null ? {} : { published: opts.published };
  const [posts, total] = await Promise.all([
    db.query.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      limit: opts.limit,
      offset: opts.offset,
      with: { author: adminAuthor },
    }),
    opts.published === null
      ? db.$count(schema.post)
      : db.$count(schema.post, eq(schema.post.published, opts.published)),
  ]);
  return { posts, total };
}

export function findPostById(db: DbExecutor, id: string) {
  return db.query.post.findFirst({ where: { id }, with: { author: adminAuthor } });
}

export async function listPublishedPosts(db: DbExecutor, opts: { limit: number; offset: number }) {
  const [posts, total] = await Promise.all([
    db.query.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      limit: opts.limit,
      offset: opts.offset,
      columns: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
      },
      with: { author: { columns: { name: true, image: true } } },
    }),
    db.$count(schema.post, eq(schema.post.published, true)),
  ]);
  return { posts, total };
}

export function findPublishedPostBySlug(db: DbExecutor, slug: string) {
  return db.query.post.findFirst({ where: { slug, published: true }, with: { author: publicAuthor } });
}

/** True when another post (optionally excluding one id) already uses this slug. */
export async function slugExists(db: DbExecutor, slug: string, excludeId?: string): Promise<boolean> {
  const condition = excludeId
    ? and(eq(schema.post.slug, slug), ne(schema.post.id, excludeId))
    : eq(schema.post.slug, slug);
  return (await db.$count(schema.post, condition)) > 0;
}
