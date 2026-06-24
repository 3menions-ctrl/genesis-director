/**
 * Edge-function auth-gate regression guards.
 *
 * These Supabase edge functions are Deno and cannot run under vitest, so we
 * assert on their source — the same approach the repo's audit-edge-function-auth
 * script uses. They lock in the two access-control fixes from the audit:
 *
 *   1. check-secrets-status must be ADMIN-gated (not merely authenticated), so a
 *      regular user cannot enumerate which secrets are configured.
 *   2. polar-checkout must verify org MEMBERSHIP before attaching a paid
 *      subscription to a client-supplied orgId (IDOR fix).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("edge auth gates (security regression)", () => {
  it("check-secrets-status is admin-gated, not just authenticated", () => {
    const src = read("supabase/functions/check-secrets-status/index.ts");
    // Still requires authentication.
    expect(src).toMatch(/validateAuth/);
    // Now also requires an admin role for non-service-role callers.
    expect(src).toMatch(/auth\.isServiceRole/);
    expect(src).toMatch(/user_roles/);
    expect(src).toMatch(/role.*===.*["']admin["']|r\.role === "admin"/);
    expect(src).toMatch(/403/);
  });

  it("polar-checkout verifies org membership before binding a subscription", () => {
    const src = read("supabase/functions/polar-checkout/index.ts");
    // Membership is checked via the SECURITY DEFINER role function.
    expect(src).toMatch(/fn_org_has_min_role/);
    // The check is keyed on the JWT user id, not a body-supplied id.
    expect(src).toMatch(/_user_id:\s*user\.id/);
    // Non-members are rejected.
    expect(src).toMatch(/Not a member of this organization/);
    expect(src).toMatch(/403/);
  });

  it("polar-webhook still verifies the Standard-Webhooks signature", () => {
    const src = read("supabase/functions/polar-webhook/index.ts");
    expect(src).toMatch(/verifyPolarWebhook/);
    // Invalid signatures are rejected with 401 before any DB write.
    expect(src).toMatch(/401/);
  });
});
