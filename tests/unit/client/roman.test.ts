import { describe, it, expect } from "vitest";
import { toRoman } from "../../../src/client/lib/roman";

describe("toRoman", () => {
  it.each([
    [1, "I"], [3, "III"], [4, "IV"], [9, "IX"], [14, "XIV"],
    [40, "XL"], [99, "XCIX"], [2024, "MMXXIV"], [3999, "MMMCMXCIX"],
  ])("writes %i as %s", (n, expected) => {
    expect(toRoman(n)).toBe(expected);
  });

  it.each([0, -2, 2.5, 4000])("falls back to digits for %s", (n) => {
    expect(toRoman(n)).toBe(String(n));
  });
});
