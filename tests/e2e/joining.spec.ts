import {
  expect,
  test,
  createSession,
  errorBanner,
  expectRows,
  fillJoinForm,
  joinSession,
} from "./helpers";

test("DM creates a session and a player joins it", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await expect(dm.locator(".turn-indicator")).toContainText("The party gathers");

  await joinSession(player, code, "Aragorn", 15);
  expect(new URL(player.url()).search).toBe(""); // the form did not submit a page load
  await expect(player.locator(".player-row .badge")).toHaveText("You");
  await expectRows(dm, ["15 Aragorn"]);
});

test("joining with an unknown code shows an error, and retrying works", async ({ newDevice }) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);

  await player.goto("/");
  await fillJoinForm(player, "9999", "Gimli", 8);
  await expect(errorBanner(player)).toContainText("No table with that number");

  await fillJoinForm(player, code, "Gimli", 8);
  await expect(player.locator(".player-list")).toBeVisible();
});

test("a name already in the session is refused", async ({ newDevice }) => {
  const dm = await newDevice();
  const code = await createSession(dm);
  await joinSession(await newDevice(), code, "Legolas", 20);

  const second = await newDevice();
  await second.goto("/");
  await fillJoinForm(second, code, "legolas", 12);
  await expect(errorBanner(second)).toContainText("already at this table");
});
