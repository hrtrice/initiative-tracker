import { describe, it, expect } from "vitest";
import {
  rollD20,
  initiativeFromRoll,
  clampBonus,
  formatBonus,
  loadBonus,
  saveBonus,
  MIN_BONUS,
  MAX_BONUS,
} from "../../../src/client/lib/dice";
import { MIN_INITIATIVE, MAX_INITIATIVE } from "../../../src/client/lib/types";

describe("rollD20", () => {
  it("maps the random source onto 1 to 20", () => {
    expect(rollD20(() => 0)).toBe(1);
    expect(rollD20(() => 19)).toBe(20);
    expect(rollD20(() => 20)).toBe(1);
  });

  it("rerolls values from the uneven top of the range, so every face is equally likely", () => {
    const values = [0xffff_ffff, 0xffff_fff0, 5];
    expect(rollD20(() => values.shift()!)).toBe(6);
  });

  it("only ever lands on a face of the die with the real random source", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rollD20());
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe("initiativeFromRoll", () => {
  it("adds the bonus to the die", () => {
    expect(initiativeFromRoll(17, 2)).toBe(19);
    expect(initiativeFromRoll(3, -1)).toBe(2);
  });

  it("stays inside the range the server accepts", () => {
    expect(initiativeFromRoll(1, MIN_BONUS)).toBeGreaterThanOrEqual(MIN_INITIATIVE);
    expect(initiativeFromRoll(20, MAX_BONUS)).toBeLessThanOrEqual(MAX_INITIATIVE);
  });
});

describe("bonus helpers", () => {
  it("clamps and truncates bonuses, and treats junk as +0", () => {
    expect(clampBonus(99)).toBe(MAX_BONUS);
    expect(clampBonus(-99)).toBe(MIN_BONUS);
    expect(clampBonus(2.7)).toBe(2);
    expect(clampBonus(NaN)).toBe(0);
  });

  it("writes bonuses the way a character sheet does", () => {
    expect(formatBonus(3)).toBe("+3");
    expect(formatBonus(0)).toBe("+0");
    expect(formatBonus(-2)).toBe("−2");
  });

  it("remembers the bonus, and copes with missing or broken storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(loadBonus(storage)).toBe(0);
    saveBonus(4, storage);
    expect(loadBonus(storage)).toBe(4);
    store.set("initiativeTracker.initiativeBonus", "garbage");
    expect(loadBonus(storage)).toBe(0);
    expect(loadBonus(undefined)).toBe(0);
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadBonus(throwing)).toBe(0);
    expect(() => saveBonus(1, throwing)).not.toThrow();
  });
});
