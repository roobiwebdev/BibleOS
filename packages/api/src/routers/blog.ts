/**
 * SOURCE OF TRUTH KEYWORDS: blogRouter, blog.adminList, blog.byId, blog.create, blog.update, blog.delete, blog.publishedList, blog.bySlug, post, slug, publishedAt, SEO
 * WHAT:  Blog posts: admin CRUD (with SEO fields and publish state) and public read endpoints.
 * WHY:   Port of Batman's lib/actions/blog.ts. Admin endpoints go through adminProcedure (audited);
 *        public endpoints only ever return published posts. Post content is stored as the editor's
 *        HTML and is sanitized by the web app on the server before rendering.
 * WHERE: apps/web/src/lib/actions/blog.ts, app/admin/blog, app/blog (Server Components).
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { schema } from "@starter/db";
import { z } from "zod";

import * as blogService from "../services/blog";
import { pageCount, resolvePublishedAt, slugify } from "../services/blog-utils";
import { adminProcedure, publicProcedure, router } from "../trpc";

const postFields = {
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200),
  excerpt: z.string().trim().max(1000),
  content: z.string().max(500_000),
  metaTitle: z.string().trim().max(200),
  metaDescription: z.string().trim().max(500),
  ogImage: z.string().trim().max(1000),
  published: z.boolean(),
};

export const blogCreateInput = z.object({
  title: postFields.title,
  content: postFields.content,
  slug: postFields.slug.optional(),
  excerpt: postFields.excerpt.optional(),
  metaTitle: postFields.metaTitle.optional(),
  metaDescription: postFields.metaDescription.optional(),
  ogImage: postFields.ogImage.optional(),
  published: postFields.published.optional(),
});

export const blogUpdateInput = z.object({
  id: z.string().min(1),
  data: z.object(postFields).partial(),
});

const pageInput = (defaultLimit: number) =>
  z.object({
    page: z.number().int().min(1).max(10_000).default(1),
    limit: z.number().int().min(1).max(100).default(defaultLimit),
  });

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

export const blogRouter = router({
  /** Admin list, newest first, optionally filtered by published state. */
  adminList: adminProcedure()
    .input(pageInput(15).extend({ published: z.boolean().nullable().default(null) }))
    .query(async ({ ctx, input }) => {
      const { posts, total } = await blogService.listPosts(ctx.db, {
        published: input.published,
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      });
      return { posts, total, pages: pageCount(total, input.limit), currentPage: input.page };
    }),

  byId: adminProcedure()
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => (await blogService.findPostById(ctx.db, input.id)) ?? null),

  create: adminProcedure()
    .input(blogCreateInput)
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.slug || "") || slugify(input.title) || `post-${Date.now()}`;
      // Batman's rule: a taken slug gets a timestamp suffix instead of failing.
      const slug = (await blogService.slugExists(ctx.db, base)) ? `${base}-${Date.now()}` : base;
      const published = input.published ?? false;
      const [created] = await ctx.db
        .insert(schema.post)
        .values({
          title: input.title,
          slug,
          excerpt: input.excerpt ?? "",
          content: input.content,
          metaTitle: input.metaTitle || null,
          metaDescription: input.metaDescription || null,
          ogImage: input.ogImage || null,
          published,
          publishedAt: resolvePublishedAt(published, null),
          authorId: ctx.session.user.id,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create post" });
      return created;
    }),

  update: adminProcedure()
    .input(blogUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, data } = input;
      const existing = await blogService.findPostById(ctx.db, id);
      if (!existing) throw notFound();

      let slug: string | undefined;
      if (data.slug !== undefined) {
        slug = slugify(data.slug) || existing.slug;
        if (slug !== existing.slug && (await blogService.slugExists(ctx.db, slug, id))) {
          throw new TRPCError({ code: "CONFLICT", message: "Another post already uses this slug." });
        }
      }

      const [updated] = await ctx.db
        .update(schema.post)
        .set({
          title: data.title,
          slug,
          excerpt: data.excerpt,
          content: data.content,
          metaTitle: data.metaTitle === undefined ? undefined : data.metaTitle || null,
          metaDescription: data.metaDescription === undefined ? undefined : data.metaDescription || null,
          ogImage: data.ogImage === undefined ? undefined : data.ogImage || null,
          published: data.published,
          publishedAt:
            data.published === undefined ? undefined : resolvePublishedAt(data.published, existing.publishedAt),
        })
        .where(eq(schema.post.id, id))
        .returning();
      if (!updated) throw notFound();
      return { ...updated, previousSlug: existing.slug };
    }),

  delete: adminProcedure()
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(schema.post)
        .where(eq(schema.post.id, input.id))
        .returning({ id: schema.post.id, slug: schema.post.slug });
      if (!deleted) throw notFound();
      return deleted;
    }),

  /** Public list of published posts, newest publish date first. */
  publishedList: publicProcedure()
    .input(pageInput(10))
    .query(async ({ ctx, input }) => {
      const { posts, total } = await blogService.listPublishedPosts(ctx.db, {
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      });
      return { posts, total, pages: pageCount(total, input.limit), currentPage: input.page };
    }),

  /** Public single post; null when missing or unpublished. Content is unsanitized HTML. */
  bySlug: publicProcedure()
    .input(z.object({ slug: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => (await blogService.findPublishedPostBySlug(ctx.db, input.slug)) ?? null),
});
