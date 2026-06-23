import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The admin sidebar moved from a flat "one NavLink per ops page" list to a
 * HUB model: the sidebar NAV exposes the dashboard + section hubs (People,
 * Production, Money, Growth, System) + a couple of direct tools (Audit,
 * Config). Individual ops pages (src/refine/pages/ops/_registry.ts) are now
 * reached as tabs inside their hub, while still remaining deep-linkable via
 * their own <Route> in AdminApp.tsx.
 *
 * So the invariant worth guarding is no longer "every ops page is in the
 * sidebar" — it's "every sidebar link resolves to a real admin route" (i.e.
 * the sidebar never renders a dead link) and the NAV has no duplicates.
 */
const layoutSource = readFileSync(
  resolve(__dirname, "../../refine/AdminLayout.tsx"),
  "utf8",
);
const appSource = readFileSync(
  resolve(__dirname, "../../admin/AdminApp.tsx"),
  "utf8",
);

/**
 * Extract every NavLink path declared inside the NAV array of AdminLayout.
 * NAV items are written as `{ ..., path: "/admin/..." }`.
 */
function extractNavPaths(source: string): string[] {
  const navStart = source.indexOf("const NAV");
  expect(navStart).toBeGreaterThan(-1);
  const navEnd = source.indexOf("\n];", navStart);
  const navBlock = source.slice(navStart, navEnd);
  const matches = navBlock.matchAll(/path:\s*"(\/admin[^"]*)"/g);
  return Array.from(matches, (m) => m[1]);
}

/** Normalise AdminApp.tsx's relative child routes back to absolute /admin/... */
function extractAdminRoutes(source: string): Set<string> {
  const routes = new Set<string>(["/admin"]);
  for (const m of source.matchAll(/<Route\s+path="([^"]+)"/g)) {
    const p = m[1];
    routes.add(p.startsWith("/admin") ? p : "/admin/" + p.replace(/^\//, ""));
  }
  return routes;
}

describe("AdminLayout sidebar registry coverage", () => {
  const navPaths = extractNavPaths(layoutSource);
  const routeSet = extractAdminRoutes(appSource);

  it("extracts the hub-model NAV paths", () => {
    // Sanity check the source extraction (dashboard + 5 hubs + audit + config).
    expect(navPaths.length).toBeGreaterThanOrEqual(6);
  });

  it("every sidebar NAV path resolves to a registered admin route", () => {
    const dead = navPaths.filter((p) => !routeSet.has(p));
    expect(dead, `Sidebar links with no matching <Route>: ${dead.join(", ")}`).toEqual([]);
  });

  it("renders each NAV path inside a NavLink (clickable)", () => {
    // AdminLayout maps every NAV item to <NavLink to={path}>.
    expect(layoutSource).toMatch(/<NavLink[\s\S]*?to=\{path\}/);
    expect(navPaths.length).toBeGreaterThan(0);
  });

  it("does not duplicate any sidebar path", () => {
    const dupes = navPaths.filter((p, i) => navPaths.indexOf(p) !== i);
    expect(dupes, `Duplicate sidebar paths: ${dupes.join(", ")}`).toEqual([]);
  });
});
