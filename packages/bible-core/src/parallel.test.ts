import { describe, expect, it } from "vitest";

import { alignParallel } from "./parallel";

const v = (verse: number, end = verse) => ({ vid: 43_003_000 + verse, spanEnd: 43_003_000 + end });
const labels = (cells: Array<Array<{ vid: number }>>) => cells.map((c) => c.map((x) => x.vid % 1000).join("+"));

describe("alignParallel", () => {
  it("puts a merged verse beside the verses it covers", () => {
    const english = [v(13), v(14), v(15), v(16), v(17)];
    const amharic = [v(13), v(14, 16), v(17)];
    const rows = alignParallel([english, amharic]);
    expect(rows.map((r) => labels(r.cells))).toEqual([
      ["13", "13"],
      ["14+15+16", "14"],
      ["17", "17"],
    ]);
    expect(rows[1]).toMatchObject({ start: 43_003_014, end: 43_003_016 });
  });

  it("leaves a cell empty where one translation lacks the verse", () => {
    const rows = alignParallel([
      [v(20), v(21), v(22)],
      [v(20), v(22)],
    ]);
    expect(rows.map((r) => labels(r.cells))).toEqual([
      ["20", "20"],
      ["21", ""],
      ["22", "22"],
    ]);
  });

  it("handles one empty column", () => {
    expect(alignParallel([[v(1)], []]).map((r) => labels(r.cells))).toEqual([["1", ""]]);
  });
});
