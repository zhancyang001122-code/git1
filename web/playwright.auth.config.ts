import { defineConfig, devices } from "@playwright/test";

import { readLocalSupabaseEnvironment } from "./scripts/local-supabase-env.mjs";

const local = readLocalSupabaseEnvironment();
const port = Number.parseInt(process.env.PLAYWRIGHT_AUTH_PORT ?? "3101", 10);
const baseURL = `http://127.0.0.1:${port}`;
const authTestEmail = "playwright-auth@example.test";

process.env.SUPABASE_AUTH_TEST_MAILPIT_URL = local.MAILPIT_URL;
process.env.SUPABASE_AUTH_TEST_EMAIL = authTestEmail;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-preferences.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_ENABLE_AI_DEBUG: "false",
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
      AUTH_ALLOWED_EMAIL: authTestEmail,
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      DASHSCOPE_API_KEY: "",
      AMAP_WEB_SERVICE_KEY: "",
      HOUSING_API_BASE_URL: "",
      HOUSING_API_KEY: "",
    },
  },
  projects: [
    {
      name: "auth-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
