import { test, expect } from "@playwright/test";

test.describe("Error Handling", () => {
  test("AC-16: Empty name shows validation error", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    const code = await page.locator("[data-testid='room-code']").textContent() || "";

    const playerPage = await page.context().newPage();
    await playerPage.goto("/");
    await playerPage.locator("input[placeholder*='code' i]").or(playerPage.locator("#roomCode")).fill(code);
    await playerPage.locator("input[placeholder*='name' i]").or(playerPage.locator("#characterName")).fill("");
    await playerPage.locator("input[placeholder*='initiative' i]").or(playerPage.locator("#initiative")).fill("10");
    await playerPage.getByRole("button", { name: /join/i }).click();
    await expect(playerPage.locator("text=/invalid name|error/i")).toBeVisible({ timeout: 5000 });
  });

  test("AC-17: Non-numeric initiative shows error", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    const code = await page.locator("[data-testid='room-code']").textContent() || "";

    const playerPage = await page.context().newPage();
    await playerPage.goto("/");
    await playerPage.locator("input[placeholder*='code' i]").or(playerPage.locator("#roomCode")).fill(code);
    await playerPage.locator("input[placeholder*='name' i]").or(playerPage.locator("#characterName")).fill("Test");
    await playerPage.locator("input[placeholder*='initiative' i]").or(playerPage.locator("#initiative")).fill("abc");
    await playerPage.getByRole("button", { name: /join/i }).click();
    await expect(playerPage.locator("text=/invalid|error/i")).toBeVisible({ timeout: 5000 });
  });

  test("AC-04: Invalid code shows 'Session not found' (repeat coverage)", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[placeholder*='code' i]").or(page.locator("#roomCode")).fill("NOPE");
    await page.locator("input[placeholder*='name' i]").or(page.locator("#characterName")).fill("Test");
    await page.locator("input[placeholder*='initiative' i]").or(page.locator("#initiative")).fill("10");
    await page.getByRole("button", { name: /join/i }).click();
    await expect(page.locator("text=Session not found")).toBeVisible({ timeout: 5000 });
  });
});
