"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: blog actions, getAdminPosts, getPostById, createPost, updatePost, deletePost, getPublishedPosts, getPostBySlug, revalidate blog
 * WHAT:  Server-action adapters over the blog router (Batman's names), plus cache revalidation
 *        of the public blog pages after admin changes.
 * WHERE: app/admin/blog (client), app/blog (Server Components).
 */
import type { RouterInputs } from "@starter/api";
import { revalidatePath } from "next/cache";

import { api } from "@/server/trpc";

type UpdateData = RouterInputs["blog"]["update"]["data"];

function revalidateBlog(...slugs: string[]) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  for (const slug of new Set(slugs)) revalidatePath(`/blog/${slug}`);
}

export async function getAdminPosts(input: RouterInputs["blog"]["adminList"]) {
  return (await api()).blog.adminList(input);
}

export async function getPostById(id: string) {
  return (await api()).blog.byId({ id });
}

export async function createPost(input: RouterInputs["blog"]["create"]) {
  const post = await (await api()).blog.create(input);
  revalidateBlog(post.slug);
  return post;
}

export async function updatePost(id: string, data: UpdateData) {
  const post = await (await api()).blog.update({ id, data });
  revalidateBlog(post.slug, post.previousSlug);
  return post;
}

export async function deletePost(id: string) {
  const deleted = await (await api()).blog.delete({ id });
  revalidateBlog(deleted.slug);
}

export async function getPublishedPosts(input: RouterInputs["blog"]["publishedList"]) {
  return (await api()).blog.publishedList(input);
}

export async function getPostBySlug(slug: string) {
  return (await api()).blog.bySlug({ slug });
}
