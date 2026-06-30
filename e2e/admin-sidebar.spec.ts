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

type NavEntry = { label: string; path: string; component: string };

/** Hand-wired admin shell pages (non-ops). Mirrors CORE_PATH_TO_COMPONENT in
 *  src/test/admin/adminSidebarRoutes.test.ts — keep both in sync. */
const CORE_PATH_TO_COMPONENT: Record<string, string> = {
  "/admin": "AdminDashboardPage",
  "/admin/users": "AdminUsersPage",
  "/admin/messages": "AdminMessagesPage",
  "/admin/finance": "AdminFinancePage",
  "/admin/credits": "AdminCreditsPage",
  "/admin/projects": "AdminProjectsPage",
  "/admin/moderation": "AdminModerationPage",
  "/admin/production": "AdminProductionPage",
  "/admin/emails": "AdminEmailsPage",
  "/admin/config": "AdminConfigPage",
};

function readSidebarEntries(): NavEntry[] {
  const layoutSrc = readFileSync(
    resolve(process.cwd(), "src/refine/AdminLayout.tsx"),
    "utf8",
  );
  const registrySrc = readFileSync(
    resolve(process.cwd(), "src/refine/pages/ops/_registry.ts"),
    "utf8",
  );
  // path → file from the ops registry
  const opsMap = new Map<string, string>();
  const opsRe = /"file":\s*"([^"]+)"\s*,\s*"path":\s*"([^"]+)"/g;
  for (let m: RegExpExecArray | null; (m = opsRe.exec(registrySrc)) !== null; ) {
    opsMap.set(m[2], m[1]);
  }
  const navRe =
    /label:\s*"([^"]+)"\s*,\s*icon:\s*\w+\s*,\s*path:\s*"(\/admin[^"]*)"/g;
  const out: NavEntry[] = [];
  for (let m: RegExpExecArray | null; (m = navRe.exec(layoutSrc)) !== null; ) {
    const path = m[2];
    const component = CORE_PATH_TO_COMPONENT[path] ?? opsMap.get(path) ?? "";
    out.push({ label: m[1], path, component });
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

// This suite requires a real signed-in admin session (it clicks every /admin
// sidebar item). Without PLAYWRIGHT_STORAGE_STATE or ADMIN_EMAIL+ADMIN_PASSWORD
// it cannot run, so skip the WHOLE describe — including beforeAll. (The skip
// inside ensureSignedIn ran too late: beforeAll fired first and failed in
// credential-less CI.)
const HAS_ADMIN_CREDS = !!(
  process.env.PLAYWRIGHT_STORAGE_STATE ||
  (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
);

test.describe("Admin sidebar navigation", () => {
  test.skip(
    !HAS_ADMIN_CREDS,
    "Set PLAYWRIGHT_STORAGE_STATE or ADMIN_EMAIL+ADMIN_PASSWORD to run the admin sidebar e2e.",
  );
  test.beforeAll(() => {
    expect(
      ENTRIES.length,
      "Expected to extract sidebar entries from AdminLayout.tsx"
    ).toBeGreaterThan(10);
    const orphans = ENTRIES.filter((e) => !e.component).map((e) => e.path);
    expect(orphans, `Sidebar entries with no expected component mapping`).toEqual([]);
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

  test("every sidebar item renders its expected component (not a swap or redirect)", async ({
    page,
  }) => {
    await ensureSignedIn(page);

    // Track every JS request the browser makes. Vite's lazy chunks keep the
    // original module basename in the URL (e.g. `…/AdminUsersPage.tsx` in dev,
    // `…/AdminUsersPage-abcdef.js` in prod), giving us a reliable proof that
    // React.lazy actually resolved the *expected* component module — not a
    // swap, not a redirect target, not a NotFound fallback.
    const requestedScripts = new Set<string>();
    page.on("request", (req) => {
      if (req.resourceType() === "script") requestedScripts.add(req.url());
    });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);

    const wrongComponent: string[] = [];
    const noEvidence: string[] = [];

    for (const { label, path, component } of ENTRIES) {
      const link = page.locator(`aside a[href="${path}"]`).first();
      if ((await link.count()) === 0) continue;
      if ((await link.getAttribute("aria-disabled")) === "true") continue;

      requestedScripts.clear();
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL(`**${path}`, { timeout: 15_000 }).catch(() => {});
      // Let lazy chunk load + React commit.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      const u = new URL(page.url());
      if (u.pathname !== path) {
        wrongComponent.push(
          `${label} (${path}) → URL became ${u.pathname} (redirect intercepted the route)`,
        );
        continue;
      }

      // Evidence #1: Vite chunk URL contains the component name.
      const chunkLoaded = Array.from(requestedScripts).some((u) => u.includes(component));
      // Evidence #2 (fallback): the component module is already in the page's
      // static module graph (loaded earlier in the session). Check via
      // performance.getEntriesByType so we don't miss a same-session re-visit.
      const inPerf = await page.evaluate((name: string) => {
        const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        return entries.some((e) => e.name.includes(name));
      }, component);

      if (!chunkLoaded && !inPerf) {
        noEvidence.push(
          `${label} (${path}) → expected <${component} /> but no matching lazy chunk was requested or cached`,
        );
      }
    }

    expect(
      wrongComponent,
      `Sidebar items whose URL was hijacked by a redirect:\n  ${wrongComponent.join("\n  ")}`,
    ).toEqual([]);
    expect(
      noEvidence,
      `Sidebar items where the expected lazy component was never resolved:\n  ${noEvidence.join("\n  ")}`,
    ).toEqual([]);
  });
});