/**
 * Standalone admin app — packaging contract.
 *
 * The admin console can be built + deployed as its own app (dist-admin/, its
 * own subdomain) WITHOUT touching the public build. These source-grep checks
 * pin the wiring so a refactor can't silently break the standalone target:
 *
 *   admin.html → src/admin/main-admin.tsx → AdminStandalone → AdminApp @ /admin/*
 *   vite.config.ts has an ADMIN_BUILD branch (separate entry + dist-admin)
 *   package.json exposes build:admin
 *
 * Grep over source is blunt but exactly right here: it fails CI the moment a
 * link in the packaging chain is renamed or removed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf-8");

describe("standalone admin — packaging chain", () => {
  it("admin.html exists, is noindex, and loads the admin entry", () => {
    expect(existsSync(resolve(ROOT, "admin.html"))).toBe(true);
    const html = read("admin.html");
    expect(html).toMatch(/src="\/src\/admin\/main-admin\.tsx"/);
    expect(html).toMatch(/noindex/i);
    expect(html).toMatch(/<div id="root">/);
  });

  it("main-admin.tsx renders AdminStandalone into #root", () => {
    const src = read("src/admin/main-admin.tsx");
    expect(src).toMatch(/AdminStandalone/);
    expect(src).toMatch(/createRoot/);
    expect(src).toMatch(/getElementById\("root"\)/);
  });

  it("AdminStandalone mounts AdminApp at /admin/* and bounces unknown paths to /auth", () => {
    const src = read("src/admin/AdminStandalone.tsx");
    expect(src).toMatch(/AdminApp/);
    expect(src).toMatch(/path="\/admin\/\*"/);
    // A /auth route must exist so the unauthenticated bounce has somewhere to land.
    expect(src).toMatch(/path="\/auth"/);
    // Catch-all → /auth (NOT /admin). Routing unknown paths to /admin made the
    // unauthenticated bounce ping-pong /admin ↔ / forever (the blank-screen
    // loop). Sending them to the login page is the verified fix.
    expect(src).toMatch(/Navigate\s+to="\/auth"/);
    // Must provide the contexts admin pages rely on (useAuth at minimum).
    expect(src).toMatch(/AuthProvider/);
    expect(src).toMatch(/QueryClientProvider/);
  });

  it("vite.config.ts has an ADMIN_BUILD branch → separate entry + dist-admin", () => {
    const src = read("vite.config.ts");
    expect(src).toMatch(/ADMIN_BUILD/);
    expect(src).toMatch(/admin\.html/);
    expect(src).toMatch(/dist-admin/);
  });

  it("package.json exposes the build:admin script", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["build:admin"]).toBeTruthy();
    expect(pkg.scripts["build:admin"]).toMatch(/ADMIN_BUILD=1/);
  });
});
