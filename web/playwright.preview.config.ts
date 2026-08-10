import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./preview",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", ...devices["Desktop Chrome"] },
  webServer: {
    command: "pnpm start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_ENABLE_AI_DEBUG: "true",
      DEMO_ADMIN_TOKEN: "playwright-demo-admin-token-000001",
    },
  },
});
