/**
 * Contract test: every entry in src/refine/pages/ops/_registry.ts MUST be
 *   1. lazy-imported in src/App.tsx by its declared `file` name, and
 *   2. registered as a <Route> under the `/admin` parent at its declared `path`.
 *
 * This is a pure source-text check — no React rendering — so it stays fast
 * and resilient to lazy-loading / context wiring.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPS_PAGES } from "@/refine/pages/ops/_registry";

const APP_SRC = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

/** All `const X = lazy(() => import("..."))` declarations in App.tsx. */
const LAZY_IMPORTS = new Map<string, string>(
  Array.from(
    APP_SRC.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)/g),
    (m) => [m[1], m[2]] as const,
  ),
);

/** Build the full set of admin-scoped route paths (parent "/admin" + children). */
function collectAdminRoutes(): Set<string> {
  const adminIdx = APP_SRC.indexOf('path="/admin"');
  expect(adminIdx, "could not find /admin parent route in App.tsx").toBeGreaterThan(-1);
  const adminBlock = APP_SRC.slice(adminIdx, adminIdx + 40_000);
  const routes = new Set<string>(["/admin"]);
  for (const m of adminBlock.matchAll(/<Route\s+path="([^"]+)"/g)) {
    const p = m[1];
    if (p === "/admin") continue;
    routes.add(p.startsWith("/admin") ? p : "/admin/" + p.replace(/^\//, ""));
  }
  return routes;
}
const ADMIN_ROUTES = collectAdminRoutes();

describe("ops registry ↔ App.tsx", () => {
  it("every registry entry has a matching lazy import in App.tsx", () => {
    const missing = OPS_PAGES.filter((p) => !LAZY_IMPORTS.has(p.file));
    expect(
      missing,
      `Missing lazy imports in App.tsx:\n${missing.map((m) => `  - ${m.file}`).join("\n")}`,
    ).toEqual([]);
  });

  it("every registry entry is registered as a <Route> under /admin", () => {
    const missing = OPS_PAGES.filter((p) => !ADMIN_ROUTES.has(p.path));
    expect(
      missing,
      `Missing <Route> registrations under /admin:\n${missing.map((m) => `  - ${m.path} (${m.file})`).join("\n")}`,
    ).toEqual([]);
  });

  it("each registry path's <Route> uses its declared lazy component", () => {
    // Match every <Route path="..." element={<X />} /> and capture (path, component).
    const adminBlock = APP_SRC.slice(APP_SRC.indexOf('path="/admin"'));
    const elementByPath = new Map<string, string>();
    for (const m of adminBlock.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)\s*\/?>/g)) {
      const fullPath = m[1].startsWith("/admin") ? m[1] : "/admin/" + m[1].replace(/^\//, "");
      elementByPath.set(fullPath, m[2]);
    }
    const mismatches = OPS_PAGES.filter((p) => {
      const comp = elementByPath.get(p.path);
      return comp !== p.file;
    }).map((p) => `${p.path} → expected <${p.file}/>, found <${elementByPath.get(p.path) ?? "MISSING"}/>`);
    expect(mismatches, `Component mismatches:\n${mismatches.join("\n")}`).toEqual([]);
  });

  it("registry path count matches App.tsx route count for ops surfaces", () => {
    const registeredOpsPaths = OPS_PAGES.filter((p) => ADMIN_ROUTES.has(p.path));
    expect(registeredOpsPaths.length).toBe(OPS_PAGES.length);
  });
});