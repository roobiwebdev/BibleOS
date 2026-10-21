/**
 * SOURCE OF TRUTH KEYWORDS: upload route, POST /api/upload, DELETE /api/upload, file upload, R2, ownership check
 * WHAT:  Receives files from the browser and stores them in R2; deletes files the caller owns.
 * WHY:   One guarded entry point: signed-in users only, rate limited, per-folder size/type
 *        limits, and object keys namespaced by user id so users can only delete their own files
 *        (Batman let any user delete any file).
 * WHERE: lib/upload.ts (client helper).
 */
import { consumeRateLimit, RATE_LIMITS } from "@starter/api/lib/rate-limit";
import { createLogger } from "@starter/core/logger";
import { notifyUser } from "@starter/core/notify";
import { buildObjectKey, checkUpload, isStorageFolder } from "@starter/core/storage";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServices } from "@/server/services";
import { getSession, isAdmin } from "@/server/session";

const log = createLogger("upload");

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { db, storage } = getServices();

  if (!(await consumeRateLimit(db, `upload:${session.user.id}`, RATE_LIMITS.upload))) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const folder = form.get("folder");
  if (!(file instanceof File) || typeof folder !== "string" || !isStorageFolder(folder)) {
    return NextResponse.json({ error: "Missing file or invalid folder" }, { status: 400 });
  }

  const check = checkUpload(folder, file, isAdmin(session));
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  if (!(await storage.isConfigured())) {
    return NextResponse.json(
      { error: "File storage is not configured. Add R2 keys in Admin > API Keys." },
      { status: 503 },
    );
  }

  try {
    const key = buildObjectKey(folder, session.user.id, file.name);
    const { url } = await storage.upload(key, new Uint8Array(await file.arrayBuffer()), file.type);
    if (folder !== "attachments") {
      await notifyUser(db, session.user.id, {
        title: "File uploaded",
        description: `You uploaded "${file.name}".`,
        tag: "update",
        senderId: session.user.id,
      });
    }
    return NextResponse.json({ url });
  } catch (err) {
    log.error("upload failed", { folder }, err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

const deleteBody = z.object({ url: z.url() });

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { db, storage } = getServices();

  const parsed = deleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const key = await storage.keyFromUrl(parsed.data.url);
  if (!key) return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  const ownerId = key.split("/")[1];
  if (ownerId !== session.user.id && !isAdmin(session)) {
    return NextResponse.json({ error: "You can only delete your own files" }, { status: 403 });
  }

  try {
    await storage.remove(key);
    await notifyUser(db, session.user.id, {
      title: "File deleted",
      description: "A file you uploaded was deleted.",
      tag: "update",
      senderId: session.user.id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("delete failed", undefined, err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
