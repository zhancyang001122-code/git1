import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3000", 10);
const baseURL = `http://127.0.0.1:${port}`;
const demoAdminToken = "playwright-demo-admin-token-000001";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "auth-preferences.spec.ts",
  fullyParallel: true,
  workers: 6,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_ENABLE_AI_DEBUG: "true",
      DEMO_ADMIN_TOKEN: demoAdminToken,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
