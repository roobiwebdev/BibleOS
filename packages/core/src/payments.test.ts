import { describe, expect, it } from "vitest";

import { buildProductDescription, parseProductDescription } from "./payments";

describe("product descriptions", () => {
  it("round-trips description and features", () => {
    const text = buildProductDescription("Best plan", ["Unlimited projects", " ", "Priority support"]);
    expect(parseProductDescription(text)).toEqual({
      description: "Best plan",
      features: ["Unlimited projects", "Priority support"],
    });
  });

  it("handles plain and empty descriptions", () => {
    expect(parseProductDescription("Just text")).toEqual({ description: "Just text", features: [] });
    expect(parseProductDescription(null)).toEqual({ description: "", features: [] });
  });
});
