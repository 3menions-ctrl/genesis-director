import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { OPS_PAGES } from "@/refine/pages/ops/_registry";

const layout = readFileSync(resolve(__dirname, "../../refine/AdminLayout.tsx"), "utf8");
const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

const navStart = layout.indexOf("const NAV");
const navBlock = layout.slice(navStart, layout.indexOf("\n];", navStart));
const navPaths = Array.from(navBlock.matchAll(/path:\s*"(\/admin[^"]*)"/g), (m) => m[1]);

const adminIdx = app.indexOf('path="/admin"');
const adminBlock = app.slice(adminIdx, adminIdx + 30000);
const routePaths = Array.from(
  adminBlock.matchAll(/<Route\s+path="([^"]+)"/g),
  (m) => m[1],
);
const adminRoutes = new Set<string>(["/admin"]);
for (const p of routePaths) {
  if (p === "/admin") continue;
  adminRoutes.add(p.startsWith("/admin") ? p : "/admin/" + p.replace(/^\//, ""));
}

const lazyImports = new Map(
  Array.from(
    app.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)/g),
    (m) => [m[1], m[2]] as const,
  ),
);

/**
 * Build a path → element-component map from the App.tsx /admin block.
 * The index route (no `path="…"`) is recorded under "/admin".
 * Routes whose element is a <Navigate /> are recorded as redirects.
 */
type RouteKind = { kind: "component"; component: string } | { kind: "redirect"; to: string };
const pathToRoute: Map<string, RouteKind> = (() => {
  const out = new Map<string, RouteKind>();
  // React Router uses the FIRST matching route — mirror that with
  // first-write-wins so legacy redirects declared after the real component
  // route don't shadow the real wiring.
  const setOnce = (k: string, v: RouteKind) => { if (!out.has(k)) out.set(k, v); };
  // Index route
  const indexMatch = adminBlock.match(/<Route\s+index\s+element=\{<(\w+)\s*\/?>\}/);
  if (indexMatch) setOnce("/admin", { kind: "component", component: indexMatch[1] });
  // Walk every <Route path="…" element={…} /> in source order.
  for (const m of adminBlock.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^}]+)\}\s*\/>/g)) {
    const full = m[1].startsWith("/admin") ? m[1] : "/admin/" + m[1].replace(/^\//, "");
    const el = m[2].trim();
    const nav = el.match(/<Navigate\s+to="([^"]+)"/);
    if (nav) { setOnce(full, { kind: "redirect", to: nav[1] }); continue; }
    const comp = el.match(/<(\w+)\s*\/?>/);
    if (comp) setOnce(full, { kind: "component", component: comp[1] });
  }
  return out;
})();

/**
 * Expected component for every sidebar path. Ops pages come from the registry;
 * the remaining core paths are the canonical, hand-wired Admin shell pages.
 */
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
const opsPathToComponent = new Map<string, string>(
  OPS_PAGES.map((p) => [p.path as string, p.file as string]),
);
const expectedComponentForPath = (path: string): string | undefined =>
  CORE_PATH_TO_COMPONENT[path] ?? opsPathToComponent.get(path);

describe("AdminLayout sidebar ↔ App routes", () => {
  it("every sidebar path matches an actual <Route> under /admin", () => {
    const orphans = navPaths.filter((p) => !adminRoutes.has(p));
    expect(orphans, `Sidebar paths without a route: ${orphans.join(", ")}`).toEqual([]);
  });

  it("every ops registry page has a lazy import in App.tsx", () => {
    const missing = OPS_PAGES.filter((p) => !lazyImports.has(p.file)).map((p) => p.file);
    expect(missing, `Missing lazy imports: ${missing.join(", ")}`).toEqual([]);
  });

  it("every ops registry page is wired as a route", () => {
    const missing = OPS_PAGES.filter((p) => !adminRoutes.has(p.path)).map((p) => p.path);
    expect(missing, `Missing routes: ${missing.join(", ")}`).toEqual([]);
  });

  // ── Stricter, component-level assertions ─────────────────────────────

  it("every sidebar path has a known expected component", () => {
    const unknown = navPaths.filter((p) => !expectedComponentForPath(p));
    expect(
      unknown,
      `Sidebar paths with no expected component mapping (update CORE_PATH_TO_COMPONENT or _registry.ts): ${unknown.join(", ")}`,
    ).toEqual([]);
  });

  it("every sidebar path renders its expected component (no redirects, no swaps)", () => {
    const mismatches: string[] = [];
    for (const path of navPaths) {
      const expected = expectedComponentForPath(path);
      if (!expected) continue; // covered by the previous test
      const route = pathToRoute.get(path);
      if (!route) {
        mismatches.push(`${path} → no <Route> element found`);
        continue;
      }
      if (route.kind === "redirect") {
        mismatches.push(`${path} → redirects to ${route.to}, expected component <${expected} />`);
        continue;
      }
      if (route.component !== expected) {
        mismatches.push(`${path} → renders <${route.component} />, expected <${expected} />`);
      }
    }
    expect(mismatches, `Sidebar/component mismatches:\n  ${mismatches.join("\n  ")}`).toEqual([]);
  });

  it("every sidebar component is lazy-imported and the import file exists on disk", () => {
    const problems: string[] = [];
    for (const path of navPaths) {
      const expected = expectedComponentForPath(path);
      if (!expected) continue;
      const importPath = lazyImports.get(expected);
      if (!importPath) {
        problems.push(`${expected} (${path}) — no lazy(() => import(...)) declaration`);
        continue;
      }
      // App.tsx lives in src/, so relative imports resolve against src/.
      // "@/foo" also resolves to src/foo via the project's path alias.
      const srcDir = resolve(__dirname, "../../");
      const rel = importPath.startsWith("@/")
        ? importPath.slice(2)
        : importPath.replace(/^\.\//, "");
      const candidates = [rel, `${rel}.tsx`, `${rel}.ts`, `${rel}/index.tsx`, `${rel}/index.ts`];
      const found = candidates.some((c) => existsSync(resolve(srcDir, c)));
      if (!found) {
        problems.push(`${expected} (${path}) — import "${importPath}" does not resolve to a file`);
      }
    }
    expect(problems, `Lazy import problems:\n  ${problems.join("\n  ")}`).toEqual([]);
  });

  it("no two sidebar paths share the same lazy-loaded component (catches copy/paste wiring)", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const path of navPaths) {
      const expected = expectedComponentForPath(path);
      if (!expected) continue;
      const prior = seen.get(expected);
      if (prior) dupes.push(`${expected} is wired to both ${prior} and ${path}`);
      else seen.set(expected, path);
    }
    expect(dupes, `Duplicate component wiring:\n  ${dupes.join("\n  ")}`).toEqual([]);
  });
});