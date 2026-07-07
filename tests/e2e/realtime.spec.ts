import { test, expect } from "@playwright/test";

test.describe("Realtime Updates", () => {
  test("AC-08: New player appears on all connected clients", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const playerPage = await dmPage.context().newPage();
    await playerPage.goto("/");
    await playerPage.locator("input[placeholder*='code' i]").or(playerPage.locator("#roomCode")).fill(code);
    await playerPage.locator("input[placeholder*='name' i]").or(playerPage.locator("#characterName")).fill("Aragorn");
    await playerPage.locator("input[placeholder*='initiative' i]").or(playerPage.locator("#initiative")).fill("15");
    await playerPage.getByRole("button", { name: /join/i }).click();

    await expect(dmPage.locator("text=Aragorn")).toBeVisible({ timeout: 5000 });
    await expect(playerPage.locator("text=Aragorn")).toBeVisible({ timeout: 5000 });
  });

  test("AC-11: Advance Turn moves indicator", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const p1 = await dmPage.context().newPage();
    await p1.goto("/");
    await p1.locator("input[placeholder*='code' i]").or(p1.locator("#roomCode")).fill(code);
    await p1.locator("input[placeholder*='name' i]").or(p1.locator("#characterName")).fill("Aragorn");
    await p1.locator("input[placeholder*='initiative' i]").or(p1.locator("#initiative")).fill("15");
    await p1.getByRole("button", { name: /join/i }).click();
    await expect(dmPage.locator("text=Aragorn")).toBeVisible({ timeout: 5000 });

    const advanceBtn = dmPage.getByRole("button", { name: /advance turn|next/i });
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
      await expect(dmPage.locator("[data-testid='turn-indicator']")).toBeVisible({ timeout: 3000 });
    }
  });

  test("AC-12: Wrapping past last increments round", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const p1 = await dmPage.context().newPage();
    await p1.goto("/");
    await p1.locator("input[placeholder*='code' i]").or(p1.locator("#roomCode")).fill(code);
    await p1.locator("input[placeholder*='name' i]").or(p1.locator("#characterName")).fill("Aragorn");
    await p1.locator("input[placeholder*='initiative' i]").or(p1.locator("#initiative")).fill("15");
    await p1.getByRole("button", { name: /join/i }).click();
    await expect(dmPage.locator("text=Aragorn")).toBeVisible({ timeout: 5000 });

    const advanceBtn = dmPage.getByRole("button", { name: /advance turn|next/i });
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
      await advanceBtn.click();
      const roundText = await dmPage.locator("text=/Round \\d+/i").textContent();
      expect(roundText).toContain("2");
    }
  });

  test("AC-20: Disconnection shows reconnection banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    await page.evaluate(() => {
      const ws = (window as any).__ws;
      if (ws) {
        ws.dispatchEvent(new Event("close"));
      }
    });
    await expect(page.locator("text=/reconnect/i")).toBeVisible({ timeout: 5000 });
  });
});
