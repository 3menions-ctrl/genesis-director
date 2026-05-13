import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * E2E: clicks every AdminLayout sidebar item and asserts the browser
 * navigates to its expected URL without rendering a 404.
 *
 * Sidebar items are extracted directly from src/refine/AdminLayout.tsx so the
 * test stays in lock-step with the canonical NAV definition.
 *
 * Auth: requires a signed-in admin. Either pre-seed storage state via
 * PLAYWRIGHT_STORAGE_STATE, or provide ADMIN_EMAIL + ADMIN_PASSWORD and the
 * spec will sign in through the public /auth form once before the suite runs.
 */

type NavEntry = { label: string; path: string };

function readSidebarEntries(): NavEntry[] {
  const file = resolve(process.cwd(), "src/refine/AdminLayout.tsx");
  const src = readFileSync(file, "utf8");
  // Match: { n: "01", label: "Telemetry", icon: Activity, path: "/admin" }
  const re = /label:\s*"([^"]+)"\s*,\s*icon:\s*\w+\s*,\s*path:\s*"(\/admin[^"]*)"/g;
  const out: NavEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ label: m[1], path: m[2] });
  }
  return out;
}

const ENTRIES = readSidebarEntries();

async function ensureSignedIn(page: Page) {
  if (process.env.PLAYWRIGHT_STORAGE_STATE) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    test.skip(
      true,
      "Set PLAYWRIGHT_STORAGE_STATE or ADMIN_EMAIL+ADMIN_PASSWORD to run the admin sidebar e2e."
    );
  }
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30_000 });
}

test.describe("Admin sidebar navigation", () => {
  test.beforeAll(() => {
    expect(
      ENTRIES.length,
      "Expected to extract sidebar entries from AdminLayout.tsx"
    ).toBeGreaterThan(10);
  });

  test("every sidebar item navigates without a 404", async ({ page }) => {
    const failed404: { path: string; status: number }[] = [];
    page.on("response", (res) => {
      const url = new URL(res.url());
      if (url.origin === new URL(page.url() || "http://x").origin && res.status() === 404) {
        failed404.push({ path: url.pathname, status: res.status() });
      }
    });

    await ensureSignedIn(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);

    const mismatches: string[] = [];
    const notClickable: string[] = [];
    const bodyNotFound: string[] = [];

    for (const { label, path } of ENTRIES) {
      // Sidebar item is a NavLink — match exact href.
      const link = page.locator(`aside a[href="${path}"]`).first();
      if ((await link.count()) === 0) {
        notClickable.push(`${label} (${path})`);
        continue;
      }
      // Skip locked (rbac-disabled) items rather than fail — they are intentionally
      // unreachable for the signed-in admin's scope set.
      const disabled = await link.getAttribute("aria-disabled");
      if (disabled === "true") continue;

      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL(`**${path}`, { timeout: 15_000 }).catch(() => {});

      const u = new URL(page.url());
      if (u.pathname !== path) {
        mismatches.push(`${label}: expected ${path}, got ${u.pathname}`);
        continue;
      }
      // Surface app-level 404s (the SPA renders a NotFound page rather than HTTP 404).
      const body = (await page.textContent("body")) || "";
      if (/404|not found|page not found/i.test(body) && !/admin/i.test(label)) {
        bodyNotFound.push(`${label} (${path})`);
      }
    }

    expect(notClickable, "Sidebar items missing from DOM").toEqual([]);
    expect(mismatches, "Sidebar items navigated to the wrong URL").toEqual([]);
    expect(bodyNotFound, "Sidebar items rendered a NotFound surface").toEqual([]);
    expect(failed404, "Network 404s while navigating sidebar").toEqual([]);
  });
});