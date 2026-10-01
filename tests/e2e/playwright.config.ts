import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";

export const E2E_PORT = 4173;

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // A flaky test is a bug to fix, not to retry past.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    // Phones are the primary target.
    ...devices["Pixel 7"],
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    launchOptions: {
      // Lets environments with a preinstalled Chromium skip `playwright install`.
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  // Tests run against the production build (`npm run build` first).
  webServer: {
    command: "node dist/server/index.cjs",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: `http://127.0.0.1:${E2E_PORT}/health`,
    env: { PORT: String(E2E_PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
