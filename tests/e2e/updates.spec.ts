import { expect, test, createSession, expectRows, joinSession } from "./helpers";

test("a page left open across a deploy reloads into the new build, keeping its session", async ({
  newDevice,
}) => {
  const dm = await newDevice();
  const player = await newDevice();
  const code = await createSession(dm);
  await joinSession(player, code, "Aragorn", 15);

  // The server now serves a newer build than the one this page is running.
  await player.route("**/version.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ buildId: "newer" }) })
  );
  let loads = 0;
  player.on("load", () => loads++);

  // Returning to the tab (as a phone does) triggers the check.
  await player.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => loads).toBe(1);
  await expectRows(player, ["15 Aragorn"]); // session restored after the reload

  // Still "newer" than the bundle (the route is faked): it must not reload again.
  await player.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await player.waitForTimeout(1_500);
  expect(loads).toBe(1);
});

test("the server publishes the build id and asks browsers to revalidate entry points", async ({
  request,
}) => {
  const version = await request.get("/version.json");
  expect(version.status()).toBe(200);
  expect((await version.json()).buildId).toEqual(expect.any(String));
  expect(version.headers()["cache-control"]).toBe("no-cache");
  expect((await request.get("/")).headers()["cache-control"]).toBe("no-cache");
});
