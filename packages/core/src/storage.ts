/**
 * SOURCE OF TRUTH KEYWORDS: createStorageService, StorageService, uploadFile, deleteFile, R2, S3, STORAGE_FOLDERS, upload limits, publicUrl
 * WHAT:  File storage on Cloudflare R2 (any S3-compatible store works) with per-folder size and
 *        type limits.
 * WHY:   Replaces Batman's Supabase buckets (avatars, uploads, attachments) with folders in one
 *        bucket. All uploads pass through the server, so limits and auth are enforced in one place.
 *        Swap providers by re-implementing this file only.
 * WHERE: apps/web/src/app/api/upload/route.ts, Admin > API Keys "test connection".
 */
import "server-only";
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { SettingsService } from "./settings";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const;
const DOC_TYPES = ["application/pdf", "text/plain", "text/csv", "application/zip"] as const;

export const STORAGE_FOLDERS = {
  avatars: { maxBytes: 5 * 1024 * 1024, types: IMAGE_TYPES, adminOnly: false },
  uploads: { maxBytes: 10 * 1024 * 1024, types: [...IMAGE_TYPES, ...DOC_TYPES], adminOnly: false },
  attachments: { maxBytes: 20 * 1024 * 1024, types: [...IMAGE_TYPES, ...DOC_TYPES], adminOnly: true },
} as const;
export type StorageFolder = keyof typeof STORAGE_FOLDERS;

export function isStorageFolder(value: string): value is StorageFolder {
  return Object.hasOwn(STORAGE_FOLDERS, value);
}

export type UploadCheck = { ok: true } | { ok: false; status: 400 | 403 | 413 | 415; error: string };

export function checkUpload(
  folder: StorageFolder,
  file: { size: number; type: string },
  isAdmin: boolean,
): UploadCheck {
  const rule = STORAGE_FOLDERS[folder];
  if (rule.adminOnly && !isAdmin) return { ok: false, status: 403, error: "Only admins can upload here" };
  if (file.size > rule.maxBytes) {
    return { ok: false, status: 413, error: `File too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB)` };
  }
  const allowed: readonly string[] = rule.types;
  if (!allowed.includes(file.type))
    return { ok: false, status: 415, error: `File type ${file.type || "unknown"} not allowed` };
  return { ok: true };
}

/** Keep object keys predictable and safe: folder/userId/timestamp-name.ext */
export function buildObjectKey(folder: StorageFolder, userId: string, fileName: string): string {
  const clean =
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/^[-.]+|-+$/g, "")
      .slice(-80) || "file";
  return `${folder}/${userId}/${Date.now()}-${clean}`;
}

export function createStorageService(settings: SettingsService) {
  async function client() {
    const k = await settings.getIntegrationKeys();
    if (
      !k.storageAccountId ||
      !k.storageAccessKeyId ||
      !k.storageSecretAccessKey ||
      !k.storageBucket ||
      !k.storagePublicUrl
    ) {
      return null;
    }
    // storageAccountId may be a Cloudflare account id or a full S3 endpoint URL.
    const endpoint = k.storageAccountId.startsWith("http")
      ? k.storageAccountId
      : `https://${k.storageAccountId}.r2.cloudflarestorage.com`;
    return {
      s3: new S3Client({
        region: "auto",
        endpoint,
        credentials: { accessKeyId: k.storageAccessKeyId, secretAccessKey: k.storageSecretAccessKey },
      }),
      bucket: k.storageBucket,
      publicUrl: k.storagePublicUrl.replace(/\/+$/, ""),
    };
  }

  async function isConfigured() {
    return (await client()) !== null;
  }

  async function upload(key: string, body: Uint8Array, contentType: string): Promise<{ url: string; key: string }> {
    const c = await client();
    if (!c) throw new Error("File storage is not configured. Add R2 keys in Admin > API Keys.");
    await c.s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: body, ContentType: contentType }));
    return { url: `${c.publicUrl}/${key}`, key };
  }

  async function remove(key: string): Promise<void> {
    const c = await client();
    if (!c) throw new Error("File storage is not configured.");
    await c.s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
  }

  /** Turns a public URL produced by upload() back into its object key, or null if foreign. */
  async function keyFromUrl(url: string): Promise<string | null> {
    const c = await client();
    if (!c || !url.startsWith(`${c.publicUrl}/`)) return null;
    return url.slice(c.publicUrl.length + 1);
  }

  async function testConnection(): Promise<{ ok: boolean; error?: string }> {
    const c = await client();
    if (!c) return { ok: false, error: "Storage keys are incomplete" };
    try {
      await c.s3.send(new HeadBucketCommand({ Bucket: c.bucket }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  return { isConfigured, upload, remove, keyFromUrl, testConnection };
}

export type StorageService = ReturnType<typeof createStorageService>;
