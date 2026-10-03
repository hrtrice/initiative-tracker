import type { Page } from "@playwright/test";
import { expect, test, createSession, joinSession } from "./helpers";

const row = (page: Page, name: string) => page.locator(".player-row", { hasText: name });
const healthOf = (page: Page, name: string) => row(page, name).getByRole("img", { name: /^Health:/ });

async function summon(dm: Page, name: string, initiative: number, hp?: number) {
  await dm.getByPlaceholder("Foe's name").fill(name);
  await dm.getByPlaceholder("Init").fill(String(initiative));
  if (hp !== undefined) await dm.getByLabel("Foe's max HP (optional)").fill(String(hp));
  await dm.getByRole("button", { name: "Summon", exact: true }).click();
}

async function hit(page: Page, name: string, kind: "Damage" | "Heal", amount: number) {
  await page.getByLabel(`Amount for ${name}`).fill(String(amount));
  await page.getByRole("button", { name: kind, exact: true }).click();
}

test("the DM tracks a foe's HP and chooses what players see of it", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);

  // HP is optional: a foe without it shows no health at all.
  await summon(dm, "Rat", 3);
  await summon(dm, "Goblin", 12, 13);
  await expect(row(dm, "Rat").locator(".health")).toHaveCount(0);

  // New foes default to a bar for players: no numbers.
  await expect(healthOf(player, "Goblin")).toHaveAccessibleName("Health: about 100% health");
  await dm.getByRole("button", { name: "Edit health for Goblin" }).click();
  await hit(dm, "Goblin", "Damage", 7);
  await expect(healthOf(dm, "Goblin")).toHaveAccessibleName("Health: 6 of 13 HP, Bloodied");
  await expect(healthOf(player, "Goblin")).toHaveAccessibleName("Health: about 45% health, Bloodied");
  await expect(row(player, "Goblin")).not.toContainText("6/13");

  await dm.getByLabel("What players see of Goblin's health").selectOption("both");
  await expect(healthOf(player, "Goblin")).toHaveAccessibleName("Health: 6 of 13 HP, Bloodied");
  await dm.getByLabel("What players see of Goblin's health").selectOption("hidden");
  await expect(row(player, "Goblin").locator(".health")).toHaveCount(0);

  await hit(dm, "Goblin", "Damage", 20);
  await expect(healthOf(dm, "Goblin")).toHaveAccessibleName("Health: 0 of 13 HP, Down");
});

test("players track their own HP, everyone sees it, and the DM can switch health off", async ({
  newDevice,
}) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);

  await player.getByRole("button", { name: "Edit health for Aragorn" }).click();
  await player.getByLabel("Max HP for Aragorn").fill("30");
  await player.getByLabel("Max HP for Aragorn").press("Enter");
  await hit(player, "Aragorn", "Damage", 18);
  await player.getByLabel("Amount for Aragorn").fill("5");
  await player.getByRole("button", { name: "Temp", exact: true }).click();
  await expect(healthOf(dm, "Aragorn")).toHaveAccessibleName(
    "Health: 12 of 30 HP, plus 5 temporary, Bloodied"
  );
  await expect(row(dm, "Aragorn")).toContainText("12/30");

  await dm.getByLabel("Show health to players").uncheck();
  await expect(row(player, "Aragorn").locator(".health")).toHaveCount(0);
  await expect(player.getByRole("button", { name: "Edit health for Aragorn" })).toHaveCount(0);
  await expect(healthOf(dm, "Aragorn")).toBeVisible();

  await dm.getByLabel("Show health to players").check();
  await expect(healthOf(player, "Aragorn")).toBeVisible();
});
