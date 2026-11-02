import { describe, expect, it } from "vitest";

import { addDays, formatDay, fromEthiopian, toEthiopian, weekday } from "./calendar";

describe("Ethiopian calendar", () => {
  it.each([
    [
      { year: 2023, month: 9, day: 12 },
      { year: 2016, month: 1, day: 1 },
    ], // after a 6-day Pagume
    [
      { year: 2024, month: 9, day: 11 },
      { year: 2017, month: 1, day: 1 },
    ],
    [
      { year: 2025, month: 9, day: 11 },
      { year: 2018, month: 1, day: 1 },
    ],
    [
      { year: 2023, month: 9, day: 11 },
      { year: 2015, month: 13, day: 6 },
    ], // Pagume 6 in a leap year
  ])("%o is %o", (gregorian, ethiopian) => {
    expect(toEthiopian(gregorian)).toEqual(ethiopian);
    expect(fromEthiopian(ethiopian)).toEqual(gregorian);
  });

  it("round-trips every day across several years", () => {
    let key = "2019-01-01";
    for (let i = 0; i < 365 * 6; i++) {
      const [year = 0, month = 0, day = 0] = key.split("-").map(Number);
      expect(fromEthiopian(toEthiopian({ year, month, day }))).toEqual({ year, month, day });
      key = addDays(key, 1);
    }
  });

  it("knows weekdays and formats days", () => {
    expect(weekday("2023-09-12")).toBe(2); // Tuesday
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(formatDay("2024-09-11", "ethiopian", "am")).toBe("መስከረም 1, 2017");
    expect(formatDay("2024-09-11", "ethiopian", "en")).toBe("1 Meskerem 2017");
  });
});
