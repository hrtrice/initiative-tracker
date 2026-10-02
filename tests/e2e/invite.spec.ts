import { expect, test, createSession, expectRows, joinSession, lobby } from "./helpers";

test("the DM's table QR links to an invite that pre-fills the table number", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);

  await dm.getByRole("button", { name: "Show Table QR" }).click();
  const dialog = dm.getByRole("dialog", { name: "Scan to Join the Party" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: `QR code linking to Table ${code}` })).toBeVisible();
  const link = await dialog.locator(".table-qr-link").getAttribute("href");
  expect(new URL(link!).search).toBe(`?table=${code}`);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await player.goto(`/?table=${code}`);
  await expect(player.locator(".invite-note")).toContainText(`Table ${code}`);
  await expect(player.locator("#roomCode")).toHaveValue(code);
  await expect(player.locator("#name")).toBeFocused();
  // Used up: a refresh shouldn't keep re-filling the invite.
  await expect(player).toHaveURL(/\/$/);

  await player.locator("#name").fill("Frodo");
  await player.locator("#initiative").fill("11");
  await player.getByRole("button", { name: "Join the Party", exact: true }).click();
  await expectRows(dm, ["11 Frodo"]);
});

test("scanning another table's invite leaves the old table first", async ({ newDevice }) => {
  const oldDm = await newDevice();
  const newDm = await newDevice();
  const player = await newDevice();
  const oldCode = await createSession(oldDm);
  const newCode = await createSession(newDm);
  await joinSession(player, oldCode, "Sam", 9);
  await expectRows(oldDm, ["9 Sam"]);

  // The "leave Table X?" confirm is accepted automatically by newDevice.
  await player.goto(`/?table=${newCode}`);
  await expect(lobby(player)).toBeVisible();
  await expect(player.locator("#roomCode")).toHaveValue(newCode);
  await expectRows(oldDm, []);
});

test("scanning the invite for the table you're already at just rejoins it", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Merry", 7);

  let asked = false;
  player.on("dialog", () => (asked = true));
  await player.goto(`/?table=${code}`);
  await expect(player.locator(".player-row .badge")).toHaveText("You");
  expect(asked).toBe(false);
  await expectRows(dm, ["7 Merry"]);
});
