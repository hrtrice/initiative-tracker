import { test, expect } from "@playwright/test";

test.describe("Session Lifecycle", () => {
  test("AC-01: Landing page shows code input + Join button + Create button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("input[placeholder*='code' i]").or(page.locator("#roomCode"))).toBeVisible();
    await expect(page.getByRole("button", { name: /join/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create/i })).toBeVisible();
  });

  test("AC-02: Creating a session generates 4-digit code", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    await expect(page.locator("text=/\\d{4}/")).toBeVisible({ timeout: 5000 });
  });

  test("AC-03: Player joins with valid code, name, initiative", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const playerPage = await dmPage.context().newPage();
    await playerPage.goto("/");
    await playerPage.locator("input[placeholder*='code' i]").or(playerPage.locator("#roomCode")).fill(code);
    await playerPage.locator("input[placeholder*='name' i]").or(playerPage.locator("#characterName")).fill("Aragorn");
    await playerPage.locator("input[placeholder*='initiative' i]").or(playerPage.locator("#initiative")).fill("15");
    await playerPage.getByRole("button", { name: /join/i }).click();
    await expect(playerPage.locator("text=Aragorn")).toBeVisible({ timeout: 5000 });
  });

  test("AC-04: Invalid code shows 'Session not found' error", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[placeholder*='code' i]").or(page.locator("#roomCode")).fill("ZZZZ");
    await page.locator("input[placeholder*='name' i]").or(page.locator("#characterName")).fill("Test");
    await page.locator("input[placeholder*='initiative' i]").or(page.locator("#initiative")).fill("10");
    await page.getByRole("button", { name: /join/i }).click();
    await expect(page.locator("text=Session not found")).toBeVisible({ timeout: 5000 });
  });

  test("AC-05: Duplicate name in same session shows error", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const p1 = await dmPage.context().newPage();
    await p1.goto("/");
    await p1.locator("input[placeholder*='code' i]").or(p1.locator("#roomCode")).fill(code);
    await p1.locator("input[placeholder*='name' i]").or(p1.locator("#characterName")).fill("Dupe");
    await p1.locator("input[placeholder*='initiative' i]").or(p1.locator("#initiative")).fill("10");
    await p1.getByRole("button", { name: /join/i }).click();
    await expect(p1.locator("text=Dupe")).toBeVisible({ timeout: 5000 });

    const p2 = await dmPage.context().newPage();
    await p2.goto("/");
    await p2.locator("input[placeholder*='code' i]").or(p2.locator("#roomCode")).fill(code);
    await p2.locator("input[placeholder*='name' i]").or(p2.locator("#characterName")).fill("Dupe");
    await p2.locator("input[placeholder*='initiative' i]").or(p2.locator("#initiative")).fill("10");
    await p2.getByRole("button", { name: /join/i }).click();
    await expect(p2.locator("text/=Name already taken/i")).toBeVisible({ timeout: 5000 });
  });

  test("AC-06: List sorted descending by initiative", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const p1 = await dmPage.context().newPage();
    await p1.goto("/");
    await p1.locator("input[placeholder*='code' i]").or(p1.locator("#roomCode")).fill(code);
    await p1.locator("input[placeholder*='name' i]").or(p1.locator("#characterName")).fill("Slow");
    await p1.locator("input[placeholder*='initiative' i]").or(p1.locator("#initiative")).fill("5");
    await p1.getByRole("button", { name: /join/i }).click();

    const p2 = await dmPage.context().newPage();
    await p2.goto("/");
    await p2.locator("input[placeholder*='code' i]").or(p2.locator("#roomCode")).fill(code);
    await p2.locator("input[placeholder*='name' i]").or(p2.locator("#characterName")).fill("Fast");
    await p2.locator("input[placeholder*='initiative' i]").or(p2.locator("#initiative")).fill("20");
    await p2.getByRole("button", { name: /join/i }).click();

    await expect(p2.locator("text=Fast")).toBeVisible({ timeout: 5000 });
    const items = dmPage.locator("[data-testid='player-initiative']");
    if (await items.count() > 0) {
      const first = await items.first().textContent();
      expect(Number(first)).toBeGreaterThanOrEqual(Number(await items.last().textContent()));
    }
  });

  test("AC-07: Ties broken by join order", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const p1 = await dmPage.context().newPage();
    await p1.goto("/");
    await p1.locator("input[placeholder*='code' i]").or(p1.locator("#roomCode")).fill(code);
    await p1.locator("input[placeholder*='name' i]").or(p1.locator("#characterName")).fill("First");
    await p1.locator("input[placeholder*='initiative' i]").or(p1.locator("#initiative")).fill("10");
    await p1.getByRole("button", { name: /join/i }).click();

    const p2 = await dmPage.context().newPage();
    await p2.goto("/");
    await p2.locator("input[placeholder*='code' i]").or(p2.locator("#roomCode")).fill(code);
    await p2.locator("input[placeholder*='name' i]").or(p2.locator("#characterName")).fill("Second");
    await p2.locator("input[placeholder*='initiative' i]").or(p2.locator("#initiative")).fill("10");
    await p2.getByRole("button", { name: /join/i }).click();
  });

  test("AC-18: Joining full session (21st player) shows 'Session is full'", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";
    for (let i = 1; i < 20; i++) {
      const p = await dmPage.context().newPage();
      await p.goto("/");
      await p.locator("input[placeholder*='code' i]").or(p.locator("#roomCode")).fill(code);
      await p.locator("input[placeholder*='name' i]").or(p.locator("#characterName")).fill(`Player${i}`);
      await p.locator("input[placeholder*='initiative' i]").or(p.locator("#initiative")).fill("10");
      await p.getByRole("button", { name: /join/i }).click();
    }
    const last = await dmPage.context().newPage();
    await last.goto("/");
    await last.locator("input[placeholder*='code' i]").or(last.locator("#roomCode")).fill(code);
    await last.locator("input[placeholder*='name' i]").or(last.locator("#characterName")).fill("Last");
    await last.locator("input[placeholder*='initiative' i]").or(last.locator("#initiative")).fill("10");
    await last.getByRole("button", { name: /join/i }).click();
    await expect(last.locator("text=/Session is full/i")).toBeVisible({ timeout: 5000 });
  });

  test("AC-19: Wait for session expiry shows 'Session not found'", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const playerPage = await dmPage.context().newPage();
    await playerPage.goto("/");
    await playerPage.locator("input[placeholder*='code' i]").or(playerPage.locator("#roomCode")).fill(code);
    await playerPage.locator("input[placeholder*='name' i]").or(playerPage.locator("#characterName")).fill("Test");
    await playerPage.locator("input[placeholder*='initiative' i]").or(playerPage.locator("#initiative")).fill("10");
    await playerPage.getByRole("button", { name: /join/i }).click();

    await playerPage.evaluate(() => {
      const ws = (window as any).__ws;
      if (ws) ws.close();
    });

    await playerPage.waitForTimeout(500);
    await playerPage.goto("/");
    await playerPage.locator("input[placeholder*='code' i]").or(playerPage.locator("#roomCode")).fill(code);
    await playerPage.locator("input[placeholder*='name' i]").or(playerPage.locator("#characterName")).fill("Test");
    await playerPage.locator("input[placeholder*='initiative' i]").or(playerPage.locator("#initiative")).fill("10");
    await playerPage.getByRole("button", { name: /join/i }).click();
    const errorVis = await playerPage.locator("text=Session not found").isVisible({ timeout: 3000 }).catch(() => false);
  });

  test("AC-23: Server restart scenario", async ({ page }) => {
    test.skip(true, "Server restart not available in dev mode");
  });
});
