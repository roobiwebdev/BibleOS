import { describe, expect, it } from "vitest";

import { foldEthiopic, hasEthiopic, normalizeForSearch } from "./normalize";

describe("normalizeForSearch", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalizeForSearch("  “For God so LOVED—the world,” ")).toBe("for god so loved the world");
    expect(normalizeForSearch("Naïve café")).toBe("naive cafe");
  });

  it("treats Ethiopic word separators and punctuation as spaces", () => {
    expect(normalizeForSearch("እግዚአብሔር፡ዓለሙን።ወዶአልና፤")).toBe(normalizeForSearch("እግዚአብሔር ዓለሙን ወዶአልና"));
  });

  it("folds homophone families in every vowel order", () => {
    expect(foldEthiopic("ኃጢአት")).toBe(foldEthiopic("ሀጢአት"));
    expect(foldEthiopic("ሐ")).toBe("ሀ");
    expect(foldEthiopic("ሓ")).toBe("ሀ"); // ሓ, ሃ and ሀ all sound alike
    expect(foldEthiopic("ሖ")).toBe("ሆ"); // other orders keep their vowel
    expect(foldEthiopic("ሠ")).toBe("ሰ");
    expect(foldEthiopic("ዓለም")).toBe("አለም");
    expect(foldEthiopic("ፀሐይ")).toBe("ጸሀይ");
  });

  it("detects Ethiopic text", () => {
    expect(hasEthiopic("ዮሐንስ 3:16")).toBe(true);
    expect(hasEthiopic("John 3:16")).toBe(false);
  });
});
