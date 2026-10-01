import {
  expect,
  test,
  addNpc,
  createSession,
  expectRows,
  joinSession,
  turnBanner,
} from "./helpers";

test("the order sorts by initiative and Next loops back to the top", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);

  await addNpc(dm, "Goblin", 20);
  await expectRows(dm, ["20 Goblin", "15 Aragorn"]);
  await expectRows(player, ["20 Goblin", "15 Aragorn"]);
  await expect(dm.locator(".player-row .badge", { hasText: "NPC" })).toBeVisible();
  await expect(player.locator(".player-row .badge", { hasText: "NPC" })).toHaveCount(0);
  await expect(player.locator(".dm-toolbar")).toHaveCount(0);

  await expect(turnBanner(dm)).toContainText("NPC turn: you're up");
  await dm.getByRole("button", { name: /Next/ }).click();
  await expect(turnBanner(player)).toContainText("Your turn!");
  await dm.getByRole("button", { name: /Next/ }).click();
  await expect(turnBanner(player)).toContainText("Goblin");
  await expect(turnBanner(player)).toContainText("Round 2");
  await dm.getByRole("button", { name: /Previous/ }).click();
  await expect(turnBanner(player)).toContainText("Round 1");
});

test("DM reorders and edits initiative; the turn stays with the same person", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);
  await addNpc(dm, "Goblin", 20);
  await dm.getByRole("button", { name: /Next/ }).click(); // Aragorn's turn

  await dm.getByRole("button", { name: "Move Aragorn up" }).click();
  await expectRows(player, ["15 Aragorn", "20 Goblin"]);
  await expect(turnBanner(player)).toContainText("Your turn!");

  await dm.getByRole("button", { name: "Edit initiative for Goblin" }).click();
  const input = dm.getByLabel("Initiative for Goblin");
  await input.fill("25");
  await input.press("Enter");
  await expectRows(player, ["25 Goblin", "15 Aragorn"]);
  await expect(turnBanner(player)).toContainText("Your turn!");

  await expect(player.getByRole("button", { name: /Edit initiative/ })).toHaveCount(0);
});

test("removing a player sends them to the lobby for good", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);

  let sockets = 0;
  player.on("websocket", () => sockets++);
  await dm.getByRole("button", { name: "Remove Aragorn" }).click();
  await expect(player.locator(".error-banner")).toContainText("removed you");
  await expect(player.getByRole("button", { name: "Create New Session" })).toBeVisible();
  await expectRows(dm, []);
  await player.waitForTimeout(2_500);
  expect(sockets).toBe(0); // no reconnect loop
});
