/**
 * Regression: pipeline-watchdog double-refunded credits (QA audit P1-8).
 *
 * THE BUG: on timeout/failure recovery the watchdog called increment_credits AND
 * inserted a 'refund' credit_transactions row — but the canonical refund_credits
 * RPC already writes the ledger row, so the user was credited TWICE. zombie-cleanup
 * was migrated to the idempotent, org-aware refund_credits; the watchdog was not.
 *
 * THE FIX: all three watchdog refund sites use refund_credits with a per-project
 * idempotency key, matching zombie-cleanup. No increment_credits, no manual
 * 'refund' insert.
 *
 * Static source contract (Deno edge fn can't run under vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/pipeline-watchdog/index.ts"),
  "utf-8",
);

describe("pipeline-watchdog — single idempotent refund (no double-credit)", () => {
  it("never calls the double-crediting increment_credits RPC", () => {
    // The literal RPC call — not the explanatory comment.
    expect(src).not.toMatch(/rpc\(\s*['"]increment_credits['"]/);
  });

  it("does not manually insert a 'refund' credit_transactions row at refund time", () => {
    // The canonical refund_credits RPC writes the ledger row itself; a manual
    // insert alongside increment_credits was the double-credit.
    expect(src).not.toMatch(/from\(['"]credit_transactions['"]\)\s*\.insert\(/);
  });

  it("uses refund_credits with a per-project idempotency key at every refund site", () => {
    const calls = src.match(/rpc\(\s*['"]refund_credits['"]/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    const keys = src.match(/p_idempotency_key:\s*`watchdog-refund:\$\{project\.id\}`/g) || [];
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });

  it("passes org-aware refund args (p_user_id/p_amount/p_project_id)", () => {
    expect(src).toMatch(/p_user_id:/);
    expect(src).toMatch(/p_amount:/);
    expect(src).toMatch(/p_project_id:/);
  });
});
