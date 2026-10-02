import type { Page } from "@playwright/test";
import { expect, test, createSession, expectRows } from "./helpers";

/** Reads "You rolled 14 + 3 = 17" back as numbers, once the die has landed. */
async function readRoll(page: Page): Promise<{ roll: number; bonus: number; total: number }> {
  const result = page.locator(".roller-result");
  await expect(result).toContainText(/You rolled \d+ [+−] \d+ = \d+/);
  const [, roll, sign, bonus, total] = (await result.innerText()).match(
    /You rolled (\d+) ([+−]) (\d+) = (\d+)/
  )!;
  return { roll: Number(roll), bonus: (sign === "−" ? -1 : 1) * Number(bonus), total: Number(total) };
}

test("players can roll a d20 to join, and again for a new encounter, with their bonus remembered", async ({
  newDevice,
}) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);

  // Joining: set a +3 bonus, roll, and the total lands in the initiative box.
  await player.goto("/");
  await player.locator("#roomCode").fill(code);
  await player.locator("#name").fill("Legolas");
  for (let i = 0; i < 3; i++) {
    await player.getByRole("button", { name: "Raise initiative bonus" }).click();
  }
  await expect(player.locator(".bonus-value")).toHaveText("+3");
  await player.getByRole("button", { name: "Roll the d20" }).click();
  const first = await readRoll(player);
  expect(first.roll).toBeGreaterThanOrEqual(1);
  expect(first.roll).toBeLessThanOrEqual(20);
  expect(first).toMatchObject({ bonus: 3, total: first.roll + 3 });
  await expect(player.locator("#initiative")).toHaveValue(String(first.total));
  await player.getByRole("button", { name: "Join the Party", exact: true }).click();
  await expectRows(dm, [`${first.total} Legolas`]);

  // A new encounter: the bonus is remembered, and the roll becomes "Claim N".
  await dm.getByRole("button", { name: "New Encounter" }).click();
  await expect(player.getByText("Roll for Initiative!")).toBeVisible();
  await expect(player.locator(".initiative-prompt .bonus-value")).toHaveText("+3");
  await player.getByRole("button", { name: "Roll the d20" }).click();
  const second = await readRoll(player);
  expect(second.total).toBe(second.roll + 3);
  await player.getByRole("button", { name: `Claim ${second.total}` }).click();
  await expect(player.locator(".initiative-prompt")).toHaveCount(0);
  await expectRows(dm, [`${second.total} Legolas`]);
});
