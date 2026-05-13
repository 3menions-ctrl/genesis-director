import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
});