import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end tests.
 *
 * By default we build the app and serve it locally (see `webServer` below), so
 * the suite tests THIS checkout's code. (Previously the default baseURL was a
 * hardcoded Lovable preview URL — that environment was decommissioned when prod
 * moved to Vercel and now 302-redirects, so every CI run hit a dead host and
 * failed regardless of the code. Don't reintroduce an external default.)
 *
 * Override with PLAYWRIGHT_BASE_URL (e.g. http://localhost:8080 against a
 * running `bun dev`, or a deployed preview) to skip the managed server.
 *
 * Auth: tests that hit /admin require an authenticated admin session. Provide
 * a Playwright storage state JSON via PLAYWRIGHT_STORAGE_STATE pointing at a
 * file produced by `playwright codegen` after logging in, or set
 * ADMIN_EMAIL / ADMIN_PASSWORD to let the spec sign in via the in-app form.
 * Without either, the admin specs skip themselves.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  // The editor specs reload the full NLE per assertion and gate on real
  // hydration; on CI hardware a single test runs 15–35s, and the 16-panel
  // sweep reloads 16×. The 30s Playwright default is too tight there (passes
  // locally, times out on CI). 120s global; test.slow() triples it to 360s for
  // the panel sweep. The e2e job's own 20-minute cap still bounds the suite.
  timeout: 120_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined,
  },
  // When no external baseURL is supplied, serve the production build locally so
  // tests exercise real code. `vite preview` needs a prior `bun run build` (CI
  // does this in a dedicated step; locally, build first or rely on
  // reuseExistingServer to attach to a server you already have running).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bunx vite preview --port 8080 --strictPort",
        url: "http://localhost:8080",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});