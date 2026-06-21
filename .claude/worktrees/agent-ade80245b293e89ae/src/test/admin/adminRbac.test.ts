import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPS_PAGES } from "@/refine/pages/ops/_registry";
import { PATH_SCOPE, OPS_SCOPES, scopeForPath } from "@/refine/rbac/scopes";

describe("Admin RBAC — scope coverage", () => {
  it("maps every ops registry path to a known scope", () => {
    for (const p of OPS_PAGES) {
      expect(PATH_SCOPE[p.path], `no scope mapped for ${p.path}`).toBeDefined();
      expect(OPS_SCOPES).toContain(PATH_SCOPE[p.path]);
    }
  });

  it("scopeForPath() falls back to 'system' for unknown paths", () => {
    expect(scopeForPath("/admin/__nonexistent__")).toBe("system");
  });

  it("groups registry sections under matching scopes", () => {
    const expectations: Record<string, string> = {
      Observability: "observability",
      Access: "access",
      Money: "money",
      Content: "content",
      Growth: "growth",
      Comms: "comms",
      System: "system",
    };
    for (const p of OPS_PAGES) {
      expect(scopeForPath(p.path), `${p.path} (${p.section})`).toBe(expectations[p.section]);
    }
  });
});

describe("Admin RBAC — guard wiring", () => {
  const layout = readFileSync(resolve(__dirname, "../../refine/AdminLayout.tsx"), "utf8");

  it("wraps the admin Outlet in OpsRouteGuard", () => {
    expect(layout).toMatch(/<OpsRouteGuard>[\s\S]*<Outlet\s*\/>[\s\S]*<\/OpsRouteGuard>/);
  });

  it("provides OpsAccessProvider around the admin layout", () => {
    expect(layout).toMatch(/<OpsAccessProvider>[\s\S]*RefineAdminLayoutInner[\s\S]*<\/OpsAccessProvider>/);
  });

  it("filters sidebar items via hasScope", () => {
    expect(layout).toContain("hasScope(scopeForPath(path))");
  });
});