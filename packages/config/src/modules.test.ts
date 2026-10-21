import { describe, expect, it } from "vitest";

import { ADMIN_NAV, DASHBOARD_NAV, DISABLED_ROUTE_PREFIXES, MODULES } from "./modules";

describe("module registry", () => {
  it("exposes nav only for enabled modules, without duplicates", () => {
    const hrefs = [...ADMIN_NAV, ...DASHBOARD_NAV].map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(ADMIN_NAV[0]?.href).toBe("/admin");
  });

  it("has every admin route of an enabled module in the nav", () => {
    for (const mod of Object.values(MODULES)) {
      if (!mod.enabled) continue;
      for (const route of mod.routes.filter((r) => r.startsWith("/admin/"))) {
        expect(ADMIN_NAV.some((n) => n.href === route)).toBe(true);
      }
    }
  });

  it("blocks no routes while every module is enabled", () => {
    expect(DISABLED_ROUTE_PREFIXES).toEqual([]);
  });
});
