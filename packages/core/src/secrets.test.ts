import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, isEncrypted, maskSecret } from "./secrets";

const KEY = "k".repeat(32);

describe("secrets", () => {
  it("round-trips a value", () => {
    const encrypted = encryptSecret("re_live_123", KEY);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toContain("re_live_123");
    expect(decryptSecret(encrypted, KEY)).toBe("re_live_123");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", KEY)).not.toBe(encryptSecret("same", KEY));
  });

  it("rejects a wrong key and tampered data", () => {
    const encrypted = encryptSecret("secret", KEY);
    expect(() => decryptSecret(encrypted, "x".repeat(32))).toThrow();
    const parts = encrypted.split(":");
    const tampered = [parts[0], parts[1], parts[2], "AAAA"].join(":");
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it("refuses short keys", () => {
    expect(() => encryptSecret("x", "short")).toThrow(/32 characters/);
  });

  it("masks for display", () => {
    expect(maskSecret(null)).toBe("");
    expect(maskSecret("abcd")).toBe("••••••••");
    expect(maskSecret("sk_live_abcdefgh")).toBe("sk_l••••••••efgh");
  });
});
