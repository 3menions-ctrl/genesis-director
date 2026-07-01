/**
 * Regression: edit-photo charged but never refunded on AI failure (QA audit P1-15).
 *
 * THE BUG: `const idemKey` was declared INSIDE the `if (creditsCost > 0)` deduct
 * block, but the two refund paths (separate `if (creditsCost > 0)` blocks for
 * gateway-error and no-image) referenced it — out of scope → `ReferenceError:
 * idemKey is not defined` thrown BEFORE refund_credits ran. The photo_edits row
 * was already marked failed, so nothing recovered it: user charged, no refund.
 *
 * THE FIX: hoist `const idemKey` to handler scope (above the deduct block) so the
 * deduct AND both refunds share it.
 *
 * Source contract (Deno edge fn can't run under vitest). The ordering assertion
 * captures the exact scope regression: the declaration must precede the deduct
 * block so it covers the later refund blocks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/edit-photo/index.ts"),
  "utf-8",
);

describe("edit-photo — idemKey is in scope for the refund paths", () => {
  it("declares idemKey exactly once", () => {
    const decls = src.match(/const idemKey\s*=/g) || [];
    expect(decls.length).toBe(1);
  });

  it("declares idemKey BEFORE the credit-deduct block (handler scope, not inside it)", () => {
    const declIdx = src.indexOf("const idemKey");
    const firstDeductBlock = src.indexOf("if (creditsCost > 0) {");
    expect(declIdx).toBeGreaterThan(-1);
    expect(firstDeductBlock).toBeGreaterThan(-1);
    // Pre-fix the declaration sat INSIDE (after) the deduct block → declIdx >
    // firstDeductBlock. The fix hoists it above → declIdx < firstDeductBlock.
    expect(declIdx).toBeLessThan(firstDeductBlock);
  });

  it("both refund_credits calls reference the shared idemKey", () => {
    const refundCalls = src.match(/rpc\('refund_credits'/g) || [];
    expect(refundCalls.length).toBeGreaterThanOrEqual(2);
    const keyedRefunds = src.match(/p_idempotency_key:\s*idemKey/g) || [];
    // deduct (1) + two refunds (2) = at least 3 uses of the shared key.
    expect(keyedRefunds.length).toBeGreaterThanOrEqual(3);
  });
});
