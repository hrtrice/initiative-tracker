const NUMERALS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** 3 -> "III". Anything Roman numerals can't write (0, negatives, fractions, 4000+) stays digits. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  let rest = n;
  let out = "";
  for (const [value, numeral] of NUMERALS) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}
