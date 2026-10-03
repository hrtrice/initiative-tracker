import { describe, it, expect } from "vitest";
import {
  applyHealthChange,
  healthState,
  healthView,
  roundedRatio,
  validateOptionalMaxHp,
} from "../../../src/server/health";
import { ServerError } from "../../../src/server/errors";
import type { Health, HealthVisibility, Player } from "../../../src/shared/types";

const hp = (current: number, max: number, temp = 0): Health => ({ current, max, temp });

function character(health: Health | null, isNpc = false, visibility: HealthVisibility = "both"): Player {
  return {
    id: "p1",
    sessionId: "s1",
    name: "Goblin",
    initiative: 10,
    isNpc,
    fields: {},
    health,
    healthVisibility: visibility,
    clientId: null,
    playerToken: null,
    createdAt: 0,
  };
}

describe("applyHealthChange", () => {
  it("setting max HP the first time starts at full health", () => {
    expect(applyHealthChange(null, { kind: "max", amount: 30 })).toEqual(hp(30, 30));
  });

  it("changing max HP keeps current HP within it", () => {
    expect(applyHealthChange(hp(25, 30), { kind: "max", amount: 20 })).toEqual(hp(20, 20));
    expect(applyHealthChange(hp(10, 30), { kind: "max", amount: 40 })).toEqual(hp(10, 40));
  });

  it("clearing max HP stops tracking health", () => {
    expect(applyHealthChange(hp(10, 30), { kind: "max", amount: null })).toBeNull();
  });

  it("damage comes off temp HP first and stops at 0", () => {
    expect(applyHealthChange(hp(20, 30, 5), { kind: "damage", amount: 3 })).toEqual(hp(20, 30, 2));
    expect(applyHealthChange(hp(20, 30, 5), { kind: "damage", amount: 8 })).toEqual(hp(17, 30, 0));
    expect(applyHealthChange(hp(4, 30), { kind: "damage", amount: 50 })).toEqual(hp(0, 30));
  });

  it("healing stops at max HP, and works from 0", () => {
    expect(applyHealthChange(hp(25, 30), { kind: "heal", amount: 10 })).toEqual(hp(30, 30));
    expect(applyHealthChange(hp(0, 30), { kind: "heal", amount: 4 })).toEqual(hp(4, 30));
  });

  it("temp HP replace rather than stack, and 0 clears them", () => {
    expect(applyHealthChange(hp(20, 30, 5), { kind: "temp", amount: 8 })).toEqual(hp(20, 30, 8));
    expect(applyHealthChange(hp(20, 30, 5), { kind: "temp", amount: 0 })).toEqual(hp(20, 30, 0));
  });

  it("refuses damage or healing before a max HP is set", () => {
    expect(() => applyHealthChange(null, { kind: "damage", amount: 3 })).toThrow("Set a max HP first");
  });

  it("refuses amounts that aren't positive whole numbers in range", () => {
    for (const amount of [0, -3, 2.5, 1000, NaN]) {
      expect(() => applyHealthChange(hp(10, 10), { kind: "damage", amount })).toThrow(ServerError);
    }
    expect(() => applyHealthChange(null, { kind: "max", amount: 0 })).toThrow(ServerError);
    expect(() => applyHealthChange(hp(10, 10), { kind: "explode", amount: 1 } as never)).toThrow(
      ServerError
    );
  });
});

describe("validateOptionalMaxHp", () => {
  it("treats blank as not tracked and validates anything else", () => {
    expect(validateOptionalMaxHp(undefined)).toBeNull();
    expect(validateOptionalMaxHp(null)).toBeNull();
    expect(validateOptionalMaxHp("")).toBeNull();
    expect(validateOptionalMaxHp(7)).toBe(7);
    expect(() => validateOptionalMaxHp(0)).toThrow(ServerError);
    expect(() => validateOptionalMaxHp("7")).toThrow(ServerError);
  });
});

describe("healthState and roundedRatio", () => {
  it("is Bloodied at half HP or below, Down at 0", () => {
    expect(healthState(hp(16, 30))).toBe("healthy");
    expect(healthState(hp(15, 30))).toBe("bloodied");
    expect(healthState(hp(0, 30))).toBe("down");
  });

  it("rounds a bar-only fill to 5% steps without showing a living foe as empty", () => {
    expect(roundedRatio(hp(7, 13))).toBe(0.55);
    expect(roundedRatio(hp(1, 200))).toBe(0.05);
    expect(roundedRatio(hp(0, 13))).toBe(0);
  });
});

describe("healthView", () => {
  const numbers = { current: 12, max: 30, temp: 3 };

  it("shows nothing for a character whose health isn't tracked", () => {
    expect(healthView(character(null), true, true)).toBeNull();
  });

  it("the DM always sees everything, even with health switched off or hidden", () => {
    expect(healthView(character(hp(12, 30, 3), true, "hidden"), true, false)).toEqual({
      ratio: 0.4,
      state: "bloodied",
      showBar: true,
      ...numbers,
    });
  });

  it("players see player characters' health in full", () => {
    expect(healthView(character(hp(12, 30, 3)), false, true)).toMatchObject({ showBar: true, ...numbers });
  });

  it("players see an NPC only as its visibility allows", () => {
    const npc = (v: HealthVisibility) => healthView(character(hp(12, 30, 3), true, v), false, true);
    expect(npc("hidden")).toBeNull();
    expect(npc("bar")).toEqual({ ratio: 0.4, state: "bloodied", showBar: true });
    expect(npc("number")).toEqual({ ratio: 0.4, state: "bloodied", showBar: false, ...numbers });
    expect(npc("both")).toEqual({ ratio: 0.4, state: "bloodied", showBar: true, ...numbers });
  });

  it("players see no health at all while it's switched off, their own included", () => {
    expect(healthView(character(hp(12, 30)), false, false)).toBeNull();
    expect(healthView(character(hp(12, 30), true, "both"), false, false)).toBeNull();
  });
});
