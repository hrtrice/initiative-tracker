import type { Health, HealthState, HealthView, HealthVisibility, Player } from "../shared/types";
import type { HealthChange } from "../shared/messages";
import { MAX_HP, MAX_HP_CHANGE, ErrorCode } from "../shared/constants";
import { ServerError } from "./errors";

export const HEALTH_VISIBILITIES: readonly HealthVisibility[] = ["hidden", "bar", "number", "both"];

export function validateVisibility(raw: unknown): HealthVisibility {
  if (!HEALTH_VISIBILITIES.includes(raw as HealthVisibility)) {
    throw new ServerError(ErrorCode.INVALID_HEALTH, "Unknown health visibility");
  }
  return raw as HealthVisibility;
}

function wholeNumber(raw: unknown, min: number, max: number, what: string): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new ServerError(ErrorCode.INVALID_HEALTH, `${what} must be a whole number from ${min} to ${max}`);
  }
  return raw;
}

/** Max HP for a new NPC: optional, so a blank or missing value means "not tracked". */
export function validateOptionalMaxHp(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  return wholeNumber(raw, 1, MAX_HP, "Max HP");
}

/** The health after a change, following 5e rules. Returns null when tracking stops. */
export function applyHealthChange(health: Health | null, change: HealthChange): Health | null {
  if (!change || typeof change !== "object") {
    throw new ServerError(ErrorCode.INVALID_HEALTH, "Invalid health change");
  }
  if (change.kind === "max") {
    if (change.amount === null) return null;
    const max = wholeNumber(change.amount, 1, MAX_HP, "Max HP");
    // Setting max the first time starts at full health; later changes keep current HP within it.
    if (!health) return { current: max, max, temp: 0 };
    return { ...health, max, current: Math.min(health.current, max) };
  }
  if (change.kind !== "damage" && change.kind !== "heal" && change.kind !== "temp") {
    throw new ServerError(ErrorCode.INVALID_HEALTH, "Invalid health change");
  }
  if (!health) {
    throw new ServerError(ErrorCode.INVALID_HEALTH, "Set a max HP first");
  }
  const min = change.kind === "temp" ? 0 : 1;
  const amount = wholeNumber(change.amount, min, MAX_HP_CHANGE, "The amount");
  switch (change.kind) {
    case "damage": {
      const absorbed = Math.min(health.temp, amount);
      return {
        ...health,
        temp: health.temp - absorbed,
        current: Math.max(0, health.current - (amount - absorbed)),
      };
    }
    case "heal":
      return { ...health, current: Math.min(health.max, health.current + amount) };
    case "temp":
      return { ...health, temp: amount };
  }
}

export function healthState(health: Health): HealthState {
  if (health.current <= 0) return "down";
  return health.current * 2 <= health.max ? "bloodied" : "healthy";
}

/**
 * A bar-only view must not give the numbers away, so its fill is rounded to 5% steps.
 * Anyone above 0 keeps at least one step, so "nearly dead" never looks like "down".
 */
export function roundedRatio(health: Health): number {
  if (health.current <= 0) return 0;
  return Math.max(0.05, Math.round((health.current / health.max) * 20) / 20);
}

/**
 * What one viewer may see of a character's health. The DM sees everything. Players see
 * player characters in full and NPCs as the NPC's visibility allows, and nothing at all
 * while the table has health switched off.
 */
export function healthView(player: Player, viewerIsDM: boolean, enabled: boolean): HealthView | null {
  const health = player.health;
  if (!health) return null;
  const full = { current: health.current, max: health.max, temp: health.temp };
  const state = healthState(health);
  if (viewerIsDM) {
    return { ratio: health.current / health.max, state, showBar: true, ...full };
  }
  if (!enabled) return null;
  const visibility: HealthVisibility = player.isNpc ? player.healthVisibility : "both";
  switch (visibility) {
    case "hidden":
      return null;
    case "bar":
      return { ratio: roundedRatio(health), state, showBar: true };
    case "number":
      return { ratio: health.current / health.max, state, showBar: false, ...full };
    case "both":
      return { ratio: health.current / health.max, state, showBar: true, ...full };
  }
}
