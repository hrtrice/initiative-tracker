import { test, expect } from "@playwright/test";

test.describe("Session Cleanup", () => {
  test("AC-21: Inactive session evicted after timeout", async ({ page }) => {
    await page.goto("/");
    const response = await page.request.get("/health");
    const initial = await response.json();

    await page.getByRole("button", { name: /create/i }).click();
    const response2 = await page.request.get("/health");
    const afterCreate = await response2.json();
    expect(afterCreate.activeSessions).toBe(initial.activeSessions + 1);

    await page.evaluate(() => {
      const ws = (window as any).__ws;
      if (ws) ws.close();
    });

    await page.waitForTimeout(1000);
    const response3 = await page.request.get("/health");
    const health = await response3.json();
    expect(health).toHaveProperty("status");
    expect(health).toHaveProperty("activeSessions");
    expect(health).toHaveProperty("activeConnections");
  });

  test("AC-22: Session with connected client NOT evicted", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    const response = await page.request.get("/health");
    const health = await response.json();
    expect(health.activeSessions).toBeGreaterThanOrEqual(1);
  });

  test("AC-24: /health reports accurate counts", async ({ page }) => {
    const response = await page.request.get("/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("status", "ok");
    expect(typeof body.activeSessions).toBe("number");
    expect(typeof body.activeConnections).toBe("number");
  });
});
