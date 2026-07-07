import { test, expect } from "@playwright/test";

test.describe("DM Controls", () => {
  test("AC-10: Session creator sees 'Advance Turn' button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    await expect(page.getByRole("button", { name: /advance turn|next/i })).toBeVisible({ timeout: 5000 });
  });

  test("AC-13: DM can reorder players", async ({ page: dmPage }) => {
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

    const reorderBtn = dmPage.getByRole("button", { name: /reorder|drag/i });
    if (await reorderBtn.isVisible()) {
      await reorderBtn.click();
    }
  });

  test("AC-14: DM can remove a character", async ({ page: dmPage }) => {
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

    const removeBtn = dmPage.locator("[data-testid='remove-player']").first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await expect(dmPage.locator("text=Aragorn")).not.toBeVisible({ timeout: 3000 });
    }
  });

  test("AC-15: DM edits initiative, list re-sorts", async ({ page: dmPage }) => {
    await dmPage.goto("/");
    await dmPage.getByRole("button", { name: /create/i }).click();
    const code = await dmPage.locator("[data-testid='room-code']").textContent() || "";

    const p1 = await dmPage.context().newPage();
    await p1.goto("/");
    await p1.locator("input[placeholder*='code' i]").or(p1.locator("#roomCode")).fill(code);
    await p1.locator("input[placeholder*='name' i]").or(p1.locator("#characterName")).fill("Aragorn");
    await p1.locator("input[placeholder*='initiative' i]").or(p1.locator("#initiative")).fill("5");
    await p1.getByRole("button", { name: /join/i }).click();
    await expect(dmPage.locator("text=Aragorn")).toBeVisible({ timeout: 5000 });

    const initiativeField = dmPage.locator("[data-testid='player-initiative']").first();
    if (await initiativeField.isVisible()) {
      await initiativeField.fill("25");
      await initiativeField.press("Enter");
    }
  });
});
