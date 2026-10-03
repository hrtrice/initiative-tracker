import type { HealthVisibility } from "./types";

/** How each NPC visibility reads in the DM's menus ("Players see: ..."). */
export const HEALTH_VISIBILITY_OPTIONS: ReadonlyArray<[HealthVisibility, string]> = [
  ["hidden", "Nothing"],
  ["bar", "Bar only"],
  ["number", "Number only"],
  ["both", "Bar and number"],
];
