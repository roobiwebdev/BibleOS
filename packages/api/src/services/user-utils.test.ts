import { describe, expect, it } from "vitest";

import { describeProfileChanges, resolveUserGate } from "./user-utils";

describe("describeProfileChanges", () => {
  it("lists provided fields in Batman's order", () => {
    expect(describeProfileChanges({ image: "https://x/y.png", name: "Ada", bio: "hi" })).toEqual([
      "name",
      "bio",
      "avatar",
    ]);
  });
  it("ignores empty or cleared values", () => {
    expect(describeProfileChanges({ name: "", bio: null, image: null })).toEqual([]);
  });
});

describe("resolveUserGate", () => {
  const settings = { maintenanceMode: false, emailVerificationEnabled: false, onboardingEnabled: false };
  const user = { role: "user", emailVerified: true, onboardingCompleted: true };

  it("lets a finished user through", () => {
    expect(resolveUserGate({ user, settings })).toBeNull();
  });
  it("sends non-admins to maintenance first", () => {
    const s = { maintenanceMode: true, emailVerificationEnabled: true, onboardingEnabled: true };
    expect(resolveUserGate({ user: { ...user, emailVerified: false }, settings: s })).toBe("/maintenance");
  });
  it("lets admins past maintenance", () => {
    expect(
      resolveUserGate({ user: { ...user, role: "admin" }, settings: { ...settings, maintenanceMode: true } }),
    ).toBeNull();
  });
  it("requires verification only when enabled", () => {
    const unverified = { ...user, emailVerified: false };
    expect(resolveUserGate({ user: unverified, settings })).toBeNull();
    expect(resolveUserGate({ user: unverified, settings: { ...settings, emailVerificationEnabled: true } })).toBe(
      "/verify-email",
    );
  });
  it("requires onboarding only when enabled", () => {
    const fresh = { ...user, onboardingCompleted: false };
    expect(resolveUserGate({ user: fresh, settings })).toBeNull();
    expect(resolveUserGate({ user: fresh, settings: { ...settings, onboardingEnabled: true } })).toBe("/onboarding");
  });
});
