/**
 * Contract test: every entry in src/refine/pages/ops/_registry.ts MUST be
 *   1. lazy-imported in src/admin/AdminApp.tsx by its declared `file` name, and
 *   2. registered as a <Route> at its declared `/admin/<slug>` path.
 *
 * The admin console was extracted out of App.tsx into a self-contained,
 * lazy-loaded module (src/admin/AdminApp.tsx) mounted at `/admin/*`. Its child
 * routes are written with RELATIVE paths (e.g. `path="audit"`) under a single
 * pathless layout <Route>, so we normalise them back to absolute `/admin/...`.
 *
 * This is a pure source-text check — no React rendering — so it stays fast
 * and resilient to lazy-loading / context wiring.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPS_PAGES } from "@/refine/pages/ops/_registry";

const APP_SRC = readFileSync(resolve(__dirname, "../../admin/AdminApp.tsx"), "utf8");

/** All `const X = lazy(() => import("..."))` declarations in AdminApp.tsx. */
const LAZY_IMPORTS = new Map<string, string>(
  Array.from(
    APP_SRC.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)/g),
    (m) => [m[1], m[2]] as const,
  ),
);

/** Build the full set of admin-scoped route paths (normalised to /admin/...). */
function collectAdminRoutes(): Set<string> {
  const routes = new Set<string>(["/admin"]);
  for (const m of APP_SRC.matchAll(/<Route\s+path="([^"]+)"/g)) {
    const p = m[1];
    if (p === "/admin") continue;
    routes.add(p.startsWith("/admin") ? p : "/admin/" + p.replace(/^\//, ""));
  }
  return routes;
}
const ADMIN_ROUTES = collectAdminRoutes();

describe("ops registry ↔ AdminApp.tsx", () => {
  it("every registry entry has a matching lazy import in AdminApp.tsx", () => {
    const missing = OPS_PAGES.filter((p) => !LAZY_IMPORTS.has(p.file));
    expect(
      missing,
      `Missing lazy imports in AdminApp.tsx:\n${missing.map((m) => `  - ${m.file}`).join("\n")}`,
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
    const adminBlock = APP_SRC;
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