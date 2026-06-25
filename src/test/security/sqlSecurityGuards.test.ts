import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// These tests assert that the security-fix migrations contain the guards we
// rely on. They cannot run against a live DB here, so they pin the SQL text so
// a future edit that silently removes a guard fails CI.

const mig = (name: string) =>
  readFileSync(resolve(__dirname, "../../../supabase/migrations", name), "utf8");

describe("C1 — org credit-pool membership authz", () => {
  const sql = mig("20260705000100_org_pool_membership_authz.sql");

  it("redefines all three credit RPCs", () => {
    expect(sql).toMatch(/FUNCTION public\.reserve_credits/);
    expect(sql).toMatch(/FUNCTION public\.consume_credit_hold/);
    expect(sql).toMatch(/FUNCTION public\.deduct_credits/);
  });

  it("guards every org-pool path with fn_org_has_min_role", () => {
    const guards = sql.match(/NOT public\.fn_org_has_min_role\(/g) ?? [];
    // one guard each in reserve_credits, consume_credit_hold, deduct_credits
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the org-pool debit behind the membership guard", () => {
    // The guard must appear before any organizations.credits_balance debit.
    const guardIdx = sql.indexOf("fn_org_has_min_role");
    const debitIdx = sql.indexOf("UPDATE public.organizations");
    expect(guardIdx).toBeGreaterThan(0);
    expect(guardIdx).toBeLessThan(debitIdx);
  });
});

describe("H1 — profiles sensitive column lockdown", () => {
  const sql = mig("20260705000200_profiles_sensitive_column_lockdown.sql");

  it("revokes the financial/moderation/role columns from anon and authenticated", () => {
    for (const col of [
      "credits_balance",
      "total_credits_purchased",
      "total_credits_used",
      "role",
      "suspension_reason",
      "deactivation_reason",
    ]) {
      expect(sql).toContain(col);
    }
    expect(sql).toMatch(/REVOKE SELECT \(%I\) ON public\.profiles FROM anon/);
    expect(sql).toMatch(/REVOKE SELECT \(%I\) ON public\.profiles FROM authenticated/);
  });

  it("does NOT revoke security_version (needed by force-logout own-row read)", () => {
    // security_version must not appear in the revoke array.
    const arrayBlock = sql.slice(sql.indexOf("sensitive_cols text[]"), sql.indexOf("];"));
    expect(arrayBlock).not.toContain("security_version");
    expect(arrayBlock).not.toContain("account_tier");
  });

  it("has a self-verifying guard that raises if a column stays readable", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'H1 lockdown failed/);
  });
});

describe("C1 edge-function defense-in-depth", () => {
  const fn = (p: string) =>
    readFileSync(resolve(__dirname, "../../../supabase/functions", p), "utf8");

  it("editor-generate-clip rejects projects the caller cannot access", () => {
    const src = fn("editor-generate-clip/index.ts");
    expect(src).toContain("organization_members");
    expect(src).toMatch(/Forbidden: you do not have access to this project/);
  });

  it("reserve-credits rejects projects the caller cannot access", () => {
    const src = fn("reserve-credits/index.ts");
    expect(src).toContain("forbidden_project_access");
    expect(src).toContain("organization_members");
  });
});
