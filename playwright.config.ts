import { defineConfig, devices } from "@playwright/test";

const TEST_PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: "html",
  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Run on a dedicated port so we never collide with another Next.js dev
    // server the developer may have running on the default 3000.
    command: `npx next dev -p ${TEST_PORT}`,
    url: TEST_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
