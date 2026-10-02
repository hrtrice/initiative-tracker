import { expect, test, addNpc, createSession, joinSession } from "./helpers";
import type { Page } from "@playwright/test";

const row = (page: Page, name: string) => page.locator(".player-row", { hasText: name });
const chips = (page: Page, name: string) => row(page, name).locator(".field-chip");

async function setValue(page: Page, playerName: string, fieldName: string, value: string) {
  const input = page.getByLabel(`${fieldName} for ${playerName}`, { exact: true });
  await input.fill(value);
  await input.press("Enter");
}

test("DM manages custom fields; players fill in their own; NPC values stay secret", async ({
  newDevice,
}) => {
  const dm = await newDevice();
  const aragorn = await newDevice();
  const gimli = await newDevice();
  const code = await createSession(dm);
  await joinSession(aragorn, code, "Aragorn", 15);
  await joinSession(gimli, code, "Gimli", 8);
  await addNpc(dm, "Goblin", 12);

  // Suggested field, then a custom text field.
  await dm.getByRole("button", { name: "+ AC" }).click();
  await expect(dm.getByLabel("Name of field AC")).toBeVisible();
  await expect(dm.getByRole("button", { name: "+ AC" })).toHaveCount(0);
  await dm.getByLabel("New field name").fill("Notes");
  await dm.getByLabel("New field type").selectOption("text");
  await dm.getByRole("button", { name: "Add field" }).click();
  await expect(dm.getByLabel("Name of field Notes")).toBeVisible();

  // Every field shows inline on every player's row, empty ones as "—".
  await expect(chips(gimli, "Aragorn")).toHaveText(["AC —", "Notes —"]);
  await expect(chips(dm, "Goblin")).toHaveText(["AC —", "Notes —"]);

  // Players only manage fields on their own row, and never see the manager.
  await expect(aragorn.locator(".fields-manager")).toHaveCount(0);
  await expect(aragorn.getByRole("button", { name: "Edit fields for Gimli" })).toHaveCount(0);
  await expect(aragorn.getByRole("button", { name: "Edit fields for Goblin" })).toHaveCount(0);

  await aragorn.getByRole("button", { name: "Edit fields for Aragorn" }).click();
  await setValue(aragorn, "Aragorn", "AC", "16");
  await setValue(aragorn, "Aragorn", "Notes", "ranger");
  await expect(chips(dm, "Aragorn")).toHaveText(["AC 16", "Notes ranger"]);
  await expect(chips(gimli, "Aragorn")).toHaveText(["AC 16", "Notes ranger"]); // public

  // The DM sets an NPC's value: visible to the DM only.
  await dm.getByRole("button", { name: "Edit fields for Goblin" }).click();
  await setValue(dm, "Goblin", "AC", "13");
  await expect(chips(dm, "Goblin")).toHaveText(["AC 13", "Notes —"]);
  await expect(chips(aragorn, "Goblin")).toHaveCount(0);

  // Bad values are refused with a readable message.
  await setValue(dm, "Goblin", "AC", "9999");
  await expect(dm.locator(".error-banner")).toContainText("whole number");
  await expect(chips(dm, "Goblin")).toHaveText(["AC 13", "Notes —"]);

  // Rename propagates to everyone.
  const acName = dm.getByLabel("Name of field AC");
  await acName.fill("Armor Class");
  await acName.press("Enter");
  await expect(chips(gimli, "Aragorn")).toHaveText(["Armor Class 16", "Notes ranger"]);

  // Fields and players' values survive a new combat; NPCs (and their values) don't.
  await dm.getByRole("button", { name: "New Encounter" }).click();
  await expect(row(dm, "Goblin")).toHaveCount(0);
  await expect(chips(dm, "Aragorn")).toHaveText(["Armor Class 16", "Notes ranger"]);

  // Deleting a field removes it and its values everywhere.
  await dm.getByRole("button", { name: "Delete field Notes" }).click();
  await expect(chips(aragorn, "Aragorn")).toHaveText(["Armor Class 16"]);

  // Another room is unaffected.
  const otherDm = await newDevice();
  await createSession(otherDm);
  await expect(otherDm.getByRole("button", { name: "+ AC" })).toBeVisible();
  await expect(otherDm.locator(".fields-list")).toHaveCount(0);
});
