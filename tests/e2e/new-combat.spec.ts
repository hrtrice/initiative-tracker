import {
  expect,
  test,
  addNpc,
  createSession,
  expectRows,
  joinSession,
  turnBanner,
} from "./helpers";

test("New combat keeps players, clears rolls and NPCs, and players re-roll", async ({ newDevice }) => {
  const dm = await newDevice();
  const aragorn = await newDevice();
  const gimli = await newDevice();
  const code = await createSession(dm);
  await joinSession(aragorn, code, "Aragorn", 15);
  await joinSession(gimli, code, "Gimli", 8);
  await addNpc(dm, "Goblin", 20);
  await dm.getByRole("button", { name: /End Turn/ }).click();
  await dm.getByRole("button", { name: /End Turn/ }).click();

  await dm.getByRole("button", { name: "New Encounter" }).click();
  await expectRows(dm, ["— Aragorn", "— Gimli"]);
  await expect(turnBanner(dm)).toContainText("Round 1");
  await expect(dm.locator(".initiative-prompt")).toHaveCount(0);

  await addNpc(dm, "Orc", 3);
  await expect(gimli.getByText("Roll for Initiative!")).toBeVisible();
  await gimli.getByLabel("Your initiative", { exact: true }).fill("17");
  await gimli.getByRole("button", { name: "Take My Place" }).click();
  await expect(gimli.locator(".initiative-prompt")).toHaveCount(0);

  // Rolled entries sort by roll; anyone still pending waits at the bottom.
  await expectRows(dm, ["17 Gimli", "3 Orc", "— Aragorn"]);
  await expect(turnBanner(aragorn)).toContainText("Gimli");
});
