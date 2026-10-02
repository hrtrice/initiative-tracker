import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import net from "net";

type NewDevice = (baseURL?: string) => Promise<Page>;

/**
 * `newDevice()` opens a separate browser context per person, as if each were on their
 * own phone, with the project's device, baseURL and service-worker settings (contexts
 * made with browser.newContext() directly don't get those). Confirm dialogs are
 * accepted automatically.
 */
export const test = base.extend<{ newDevice: NewDevice }>({
  newDevice: async (
    { browser, baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, serviceWorkers },
    use
  ) => {
    const contexts: BrowserContext[] = [];
    await use(async (url) => {
      const context = await browser.newContext({
        baseURL: url ?? baseURL,
        viewport,
        userAgent,
        isMobile,
        hasTouch,
        deviceScaleFactor,
        serviceWorkers,
      });
      contexts.push(context);
      const page = await context.newPage();
      page.on("dialog", (dialog) => dialog.accept());
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect };

export async function createSession(dm: Page): Promise<string> {
  await dm.goto("/");
  await dm.getByRole("button", { name: "Begin an Encounter" }).click();
  const roomCode = dm.locator(".room-code");
  await expect(roomCode).toHaveText(/^\d{4}$/);
  return (await roomCode.innerText()).trim();
}

export async function fillJoinForm(page: Page, roomCode: string, name: string, initiative: number) {
  await page.locator("#roomCode").fill(roomCode);
  await page.locator("#name").fill(name);
  await page.locator("#initiative").fill(String(initiative));
  await page.getByRole("button", { name: "Join the Party", exact: true }).click();
}

export async function joinSession(page: Page, roomCode: string, name: string, initiative: number) {
  await page.goto("/");
  await fillJoinForm(page, roomCode, name, initiative);
  await expect(page.locator(".player-list")).toBeVisible();
}

export async function addNpc(dm: Page, name: string, initiative: number) {
  await dm.getByPlaceholder("Foe's name").fill(name);
  await dm.getByPlaceholder("Init").fill(String(initiative));
  await dm.getByRole("button", { name: "Summon", exact: true }).click();
}

/** The initiative list as "initiative name" strings, top to bottom, without badges. */
export function rows(page: Page): Promise<string[]> {
  return page.locator(".player-row").evaluateAll((els) =>
    els.map((el) => {
      const initiative = (el.querySelector(".initiative") as HTMLElement).innerText.trim();
      const name = el.querySelector(".name")!.childNodes[0]!.textContent!.trim();
      return `${initiative} ${name}`;
    })
  );
}

export async function expectRows(page: Page, expected: string[]) {
  await expect.poll(() => rows(page)).toEqual(expected);
}

export const turnBanner = (page: Page) => page.locator(".turn-indicator");
export const errorBanner = (page: Page) => page.locator(".error-banner");
export const lobby = (page: Page) => page.getByRole("button", { name: "Begin an Encounter" });

/**
 * A TCP proxy in front of the server whose connections can be cut, to simulate a
 * phone dropping its socket (screen lock, network switch) without reloading the page.
 */
export async function cuttableProxy(targetPort: number) {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
      s.on("error", () => {});
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    cutAll: () => sockets.forEach((s) => s.destroy()),
    close: () =>
      new Promise<void>((resolve) => {
        sockets.forEach((s) => s.destroy());
        server.close(() => resolve());
      }),
  };
}
