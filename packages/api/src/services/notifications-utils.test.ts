import { describe, expect, it } from "vitest";

import { pageCount, toPageWindow } from "./notifications-utils";

describe("toPageWindow", () => {
  it("defaults to page 1 and the default limit", () => {
    expect(toPageWindow(undefined, undefined)).toEqual({ page: 1, limit: 20, offset: 0 });
  });
  it("computes the offset from a 1-based page", () => {
    expect(toPageWindow(3, 10)).toEqual({ page: 3, limit: 10, offset: 20 });
  });
  it("clamps invalid values", () => {
    expect(toPageWindow(0, 0)).toEqual({ page: 1, limit: 1, offset: 0 });
    expect(toPageWindow(-2, 5.7)).toEqual({ page: 1, limit: 5, offset: 0 });
  });
});

describe("pageCount", () => {
  it("rounds up", () => {
    expect(pageCount(41, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
  });
  it("is 0 for no rows or a bad limit", () => {
    expect(pageCount(0, 20)).toBe(0);
    expect(pageCount(10, 0)).toBe(0);
  });
});
