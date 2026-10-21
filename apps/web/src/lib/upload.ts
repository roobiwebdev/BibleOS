/**
 * SOURCE OF TRUTH KEYWORDS: uploadFile, deleteFile, client upload, StorageFolder, /api/upload
 * WHAT:  Browser helpers that send files to the upload route (which stores them in R2).
 * WHY:   Clients never hold storage credentials; the server checks auth, size and type.
 * WHERE: avatar (settings, onboarding), blog images, notification attachments.
 */
import type { StorageFolder } from "@starter/core/storage";

export async function uploadFile(folder: StorageFolder, file: File): Promise<{ url: string } | { error: string }> {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data: { url?: string; error?: string } = await res.json().catch(() => ({ error: "Upload failed" }));
  if (!res.ok || !data.url) return { error: data.error ?? "Upload failed" };
  return { url: data.url };
}

export async function deleteFile(url: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data: { error?: string } = await res.json().catch(() => ({ error: "Delete failed" }));
  return res.ok ? { success: true } : { success: false, error: data.error ?? "Delete failed" };
}
