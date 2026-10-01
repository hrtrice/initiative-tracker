import {
  expect,
  test,
  createSession,
  errorBanner,
  expectRows,
  joinSession,
  lobby,
  turnBanner,
} from "./helpers";

test("the DM can take over from another device with the Admin Key", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);
  const adminKey: string = await dm.evaluate(
    () => JSON.parse(sessionStorage.getItem("initiativeTracker.credentials")!).dmToken
  );

  const tablet = await newDevice();
  await tablet.goto("/");
  await tablet.locator("summary", { hasText: "Rejoin as DM" }).click();
  await tablet.locator("#recoverCode").fill(code);
  await tablet.locator("#recoverKey").fill("not-the-key");
  await tablet.getByRole("button", { name: "Rejoin as DM" }).click();
  await expect(errorBanner(tablet)).toContainText("doesn't match");
  await expect(lobby(tablet)).toBeVisible();

  await tablet.locator("#recoverKey").fill(adminKey);
  await tablet.getByRole("button", { name: "Rejoin as DM" }).click();
  await expect(tablet.locator(".dm-toolbar")).toBeVisible();
  await tablet.getByRole("button", { name: /Next/ }).click();
  await expect(turnBanner(player)).toContainText("Round 2");
});

test("players can leave and rejoin; the DM leaving keeps the session", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);

  await player.getByRole("button", { name: "Leave session" }).click();
  await expect(lobby(player)).toBeVisible();
  await expectRows(dm, []);
  await player.reload();
  await expect(lobby(player)).toBeVisible();
  await joinSession(player, code, "Aragorn", 12);

  await dm.getByRole("button", { name: "Leave session" }).click();
  await expect(lobby(dm)).toBeVisible();
  await expect(player.locator(".player-list")).toBeVisible();
  await expectRows(player, ["12 Aragorn"]);
});
