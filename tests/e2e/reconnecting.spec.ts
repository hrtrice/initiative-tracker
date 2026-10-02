import {
  expect,
  test,
  addNpc,
  createSession,
  cuttableProxy,
  expectRows,
  joinSession,
  turnBanner,
} from "./helpers";
import { E2E_PORT } from "./playwright.config";

test("refreshing restores both the DM and the player", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);
  await addNpc(dm, "Goblin", 20);

  await dm.reload();
  await expect(dm.locator(".dm-toolbar")).toBeVisible();
  await expect(dm.locator(".room-code")).toHaveText(code);
  await expectRows(dm, ["20 Goblin", "15 Aragorn"]);

  await player.reload();
  await expectRows(player, ["20 Goblin", "15 Aragorn"]);
  await expect(player.locator(".player-row .badge")).toHaveText("You");
});

test("reopening a closed tab restores the session", async ({ newDevice }) => {
  const dm = await newDevice();
  const code = await createSession(dm);
  const player = await newDevice();
  await joinSession(player, code, "Aragorn", 15);

  const playerAgain = await player.context().newPage();
  await player.close();
  await playerAgain.goto("/");
  await expectRows(playerAgain, ["15 Aragorn"]);

  const dmAgain = await dm.context().newPage();
  await dm.close();
  await dmAgain.goto("/");
  await expect(dmAgain.locator(".dm-toolbar")).toBeVisible();
});

test("a dropped connection reconnects and keeps receiving updates", async ({ newDevice }) => {
  const proxy = await cuttableProxy(E2E_PORT);
  try {
    const dm = await newDevice(proxy.url);
    const player = await newDevice(proxy.url);
    const code = await createSession(dm);
    await joinSession(player, code, "Aragorn", 15);
    await addNpc(dm, "Goblin", 20);

    proxy.cutAll();
    await expect(dm.locator(".reconnect-banner")).toBeVisible();
    await expect(dm.locator(".reconnect-banner")).toBeHidden({ timeout: 10_000 });
    await expect(player.locator(".reconnect-banner")).toBeHidden({ timeout: 10_000 });

    await dm.getByRole("button", { name: /End Turn/ }).click();
    await expect(turnBanner(player)).toContainText("Your move, adventurer!");
    await expect(dm.locator(".error-banner")).toHaveCount(0);
  } finally {
    await proxy.close();
  }
});
