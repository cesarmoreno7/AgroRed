import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // serial for shared DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/report", open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    headless: true,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Auto-start servers in development
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: "npm run dev:gateway",
          url: "http://localhost:8082/ping",
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          command: "npm run dev:dashboard",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
