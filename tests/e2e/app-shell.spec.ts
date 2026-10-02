import { test, expect } from "@playwright/test";

test("the page loads with no failed requests and installable icons", async ({ page, request }) => {
  const failures: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => failures.push(`failed ${r.url()}`));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Begin an Encounter" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(failures).toEqual([]);

  const manifest = await (await request.get("/manifest.json")).json();
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
});

test("the server bundle is not publicly served", async ({ request }) => {
  expect((await request.get("/server/index.cjs")).status()).toBe(404);
});
