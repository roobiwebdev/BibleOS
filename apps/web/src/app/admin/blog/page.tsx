"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  ImagePlus,
} from "lucide-react";
import { getAdminPosts, createPost, updatePost, deletePost } from "@/lib/actions/blog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@starter/ui/components/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";
import { Switch } from "@starter/ui/components/switch";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BlogSkeleton } from "@/components/skeletons";
import { uploadFile } from "@/lib/upload";
import type { RouterOutputs } from "@starter/api";

type PostList = RouterOutputs["blog"]["adminList"];
type Post = PostList["posts"][number];

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  published: false,
};

async function handleRteImageUpload(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    toast.error("Please select an image file");
    throw new Error("Invalid file type");
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.error("Image must be under 2MB");
    throw new Error("File too large");
  }
  const result = await uploadFile("uploads", file);
  if ("error" in result) {
    toast.error(result.error);
    throw new Error(result.error);
  }
  return result.url;
}

export default function AdminBlogPage() {
  const [data, setData] = useState<PostList | null>(null);
  const [page, setPage] = useState(1);
  const [filterPublished, setFilterPublished] = useState<boolean | "all">("all");
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ogImageUploading, setOgImageUploading] = useState(false);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  function loadData() {
    startTransition(async () => {
      const result = await getAdminPosts({
        page,
        limit: 12,
        published: filterPublished === "all" ? null : filterPublished,
      });
      setData(result);
    });
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterPublished]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(post: Post) {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      metaTitle: post.metaTitle ?? "",
      metaDescription: post.metaDescription ?? "",
      ogImage: post.ogImage ?? "",
      published: post.published,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Empty SEO fields clear the stored value; an empty slug keeps the current one.
        await updatePost(editingId, {
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          content: form.content,
          metaTitle: form.metaTitle,
          metaDescription: form.metaDescription,
          ogImage: form.ogImage,
          published: form.published,
        });
        toast.success("Post updated");
      } else {
        await createPost({
          title: form.title,
          slug: form.slug.trim() || undefined,
          excerpt: form.excerpt,
          content: form.content,
          metaTitle: form.metaTitle.trim() || undefined,
          metaDescription: form.metaDescription.trim() || undefined,
          ogImage: form.ogImage.trim() || undefined,
          published: form.published,
        });
        toast.success("Post created");
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deletePost(deleteId);
      toast.success("Post deleted");
      setDeleteId(null);
      loadData();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleOgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setOgImageUploading(true);
    try {
      const result = await uploadFile("uploads", file);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setForm((f) => ({ ...f, ogImage: result.url }));
      toast.success("OG image uploaded");
    } catch {
      toast.error("Failed to upload");
    } finally {
      setOgImageUploading(false);
    }
  }

  if (isPending && !data) return <BlogSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Blog</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Write SEO-friendly blog posts for your site.</p>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="text-xs h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <Plus className="h-3 w-3" />
          New Post
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Status:</span>
        <div className="flex gap-1">
          {(["all", true, false] as const).map((v) => (
            <button
              key={String(v)}
              onClick={() => {
                setFilterPublished(v);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-[10px] border transition-colors ${
                filterPublished === v
                  ? "border-foreground/40 bg-foreground/5 text-foreground"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "all" ? "All" : v ? "Published" : "Draft"}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-border/40">
        {!data?.posts.length ? (
          <div className="px-6 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">No posts yet.</p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">Create your first blog post to get started.</p>
            <Button size="sm" variant="outline" className="mt-4 text-xs h-8" onClick={openCreate}>
              New Post
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {data.posts.map((post) => (
              <div key={post.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{post.title}</span>
                    {post.published ? (
                      <span className="text-[9px] text-primary shrink-0">Published</span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground shrink-0">Draft</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/50">
                    <span>/blog/{post.slug}</span>
                    <span>·</span>
                    <span>
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString()
                        : new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {post.published && (
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      title="View"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  <button
                    onClick={() => openEdit(post)}
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeleteId(post.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Page {data.currentPage} of {data.pages} · {data.total} total
          </p>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[50vw]! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingId ? "Edit Post" : "New Post"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="title" className="text-[11px]">
                  Title *
                </Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Post title"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-[11px]">
                  Slug
                </Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="url-friendly-slug"
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[9px] text-muted-foreground/50">Leave empty to auto-generate from title</p>
              </div>
              <div className="space-y-1.5 flex items-end">
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    id="published"
                    checked={form.published}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))}
                  />
                  <Label htmlFor="published" className="text-[11px]">
                    Publish
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="excerpt" className="text-[11px]">
                Excerpt (meta description)
              </Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="Short summary for SEO and previews"
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content" className="text-[11px]">
                Content
              </Label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                placeholder="Write your post content..."
                minHeight={280}
                onUploadImage={handleRteImageUpload}
              />
            </div>

            <div className="border-t border-border/30 pt-4 space-y-3">
              <p className="text-[10px] font-medium text-muted-foreground">SEO overrides (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="metaTitle" className="text-[11px]">
                    Meta title
                  </Label>
                  <Input
                    id="metaTitle"
                    value={form.metaTitle}
                    onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
                    placeholder="Override &lt;title&gt;"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ogImage" className="text-[11px]">
                    OG image
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => ogImageInputRef.current?.click()}
                      disabled={ogImageUploading}
                      className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      {ogImageUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3 w-3" />
                      )}
                      {ogImageUploading ? "Uploading..." : "Upload image"}
                    </button>
                    <input
                      ref={ogImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleOgImageUpload}
                    />
                    {form.ogImage && (
                      <div className="relative w-12 h-12 rounded overflow-hidden border border-border/40 shrink-0">
                        <Image src={form.ogImage} alt="OG preview" fill className="object-cover" unoptimized />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="metaDescription" className="text-[11px]">
                  Meta description
                </Label>
                <Input
                  id="metaDescription"
                  value={form.metaDescription}
                  onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
                  placeholder="Override meta description"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs h-8 bg-foreground text-background hover:bg-foreground/90"
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This cannot be undone. The post will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
