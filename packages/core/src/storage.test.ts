import { describe, expect, it } from "vitest";

import { buildObjectKey, checkUpload, isStorageFolder } from "./storage";

describe("storage rules", () => {
  it("accepts only known folders", () => {
    expect(isStorageFolder("avatars")).toBe(true);
    expect(isStorageFolder("../etc")).toBe(false);
  });

  it("enforces size, type and admin-only folders", () => {
    expect(checkUpload("avatars", { size: 1000, type: "image/png" }, false)).toEqual({ ok: true });
    expect(checkUpload("avatars", { size: 6 * 1024 * 1024, type: "image/png" }, false)).toMatchObject({
      ok: false,
      status: 413,
    });
    expect(checkUpload("avatars", { size: 10, type: "application/pdf" }, false)).toMatchObject({
      ok: false,
      status: 415,
    });
    expect(checkUpload("attachments", { size: 10, type: "image/png" }, false)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(checkUpload("attachments", { size: 10, type: "image/png" }, true)).toEqual({ ok: true });
  });

  it("namespaces keys by user and strips unsafe characters", () => {
    const key = buildObjectKey("uploads", "user_1", "../../My File (1).PNG");
    expect(key.startsWith("uploads/user_1/")).toBe(true);
    expect(key).not.toContain("..");
    expect(key.endsWith("my-file-1-.png")).toBe(true);
  });
});
