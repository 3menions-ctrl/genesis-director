import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end tests.
 *
 * Default base URL points at the live preview. Override with PLAYWRIGHT_BASE_URL
 * (e.g., http://localhost:8080) when running locally against `bun dev`.
 *
 * Auth: tests that hit /admin require an authenticated admin session. Provide
 * a Playwright storage state JSON via PLAYWRIGHT_STORAGE_STATE pointing at a
 * file produced by `playwright codegen` after logging in, or set
 * ADMIN_EMAIL / ADMIN_PASSWORD to let the spec sign in via the in-app form.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://id-preview--6f11c231-5f8b-4575-aa71-63351711b5cd.lovable.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});