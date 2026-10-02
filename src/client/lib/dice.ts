import { MIN_INITIATIVE, MAX_INITIATIVE } from "./types";

export const MIN_BONUS = -10;
export const MAX_BONUS = 20;

const BONUS_KEY = "initiativeTracker.initiativeBonus";

/** A uniform integer from 1 to 20. Uses the browser's crypto source, so rolls can't be predicted. */
export function rollD20(randomUint32: () => number = cryptoUint32): number {
  // Rejection sampling: 2^32 isn't a multiple of 20, so drop the top sliver to stay uniform.
  const limit = Math.floor(0x1_0000_0000 / 20) * 20;
  let n: number;
  do {
    n = randomUint32();
  } while (n >= limit);
  return (n % 20) + 1;
}

/** The die plus the bonus, kept inside the range the server accepts. */
export function initiativeFromRoll(roll: number, bonus: number): number {
  return Math.min(MAX_INITIATIVE, Math.max(MIN_INITIATIVE, roll + bonus));
}

export function clampBonus(bonus: number): number {
  if (!Number.isFinite(bonus)) return 0;
  return Math.min(MAX_BONUS, Math.max(MIN_BONUS, Math.trunc(bonus)));
}

/** "+3", "-1", "+0": how a bonus is written on a character sheet. */
export function formatBonus(bonus: number): string {
  return bonus < 0 ? `−${-bonus}` : `+${bonus}`;
}

/** The bonus is a property of the character, so remember it on this device between encounters. */
export function loadBonus(storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage()): number {
  try {
    const raw = storage?.getItem(BONUS_KEY);
    return raw === null || raw === undefined ? 0 : clampBonus(Number(raw));
  } catch {
    return 0;
  }
}

export function saveBonus(
  bonus: number,
  storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage()
): void {
  try {
    storage?.setItem(BONUS_KEY, String(clampBonus(bonus)));
  } catch {
    // Storage unavailable (private mode); the bonus just won't be remembered.
  }
}

function cryptoUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
