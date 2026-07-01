/**
 * Regression: retry-failed-clip self-deadlock (QA audit P0-2).
 *
 * THE BUG (pre-fix): retry-failed-clip acquired the project generation lock,
 * then called generate-single-clip, which UNCONDITIONALLY re-acquired the same
 * non-reentrant lock → 409 GENERATION_LOCKED. callEdgeFunction throws on non-2xx,
 * and the outer catch neither released the lock nor reverted the clip. Result:
 * the clip was stranded in 'generating' forever and could never be retried again
 * (every future retry trips the `status === 'failed'` precondition), and the
 * whole project stayed locked.
 *
 * THE FIX:
 *   - generate-single-clip accepts `ownedLockId`; when present it REUSES that
 *     lock instead of re-acquiring (no 409), and its `releaseLock`/error path do
 *     NOT release a caller-owned lock.
 *   - retry-failed-clip hands its lock down via `ownedLockId`, releases it in a
 *     `finally` on every exit, and reverts the clip to 'failed' in `catch`.
 *
 * These are static source contracts (the edge functions import Deno `https://`
 * modules and can't run under vitest — same approach as
 * src/test/engines/idempotency.test.ts). Each assertion fails on the pre-fix
 * source and passes on the fixed source.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const gscPath = resolve(REPO_ROOT, "supabase/functions/generate-single-clip/index.ts");
const retryPath = resolve(REPO_ROOT, "supabase/functions/retry-failed-clip/index.ts");
const gsc = readFileSync(gscPath, "utf-8");
const retry = readFileSync(retryPath, "utf-8");

describe("generate-single-clip — reuses a caller-held generation lock", () => {
  it("destructures ownedLockId from the request body", () => {
    expect(gsc).toMatch(/ownedLockId/);
    // It must feed the hoisted flag the rest of the logic branches on.
    expect(gsc).toMatch(/callerHeldLockId\s*=\s*ownedLockId/);
  });

  it("does NOT re-acquire the lock when the caller already holds it", () => {
    // The acquire call must be guarded so it only runs when there is no
    // caller-held lock — otherwise we deadlock against the caller's own lock.
    expect(gsc).toMatch(/if\s*\(\s*callerHeldLockId\s*\)/);

    // Pin the structure: the ELSE branch (no caller lock) is the only place that
    // calls acquireGenerationLock. Grab the reuse-vs-acquire region and assert
    // the acquire sits after an `else`.
    const region = gsc.slice(
      gsc.indexOf("if (callerHeldLockId)"),
      gsc.indexOf("const releaseLock")
    );
    expect(region).toContain("else");
    expect(region).toMatch(/acquireGenerationLock/);
    // The reuse branch must assign the caller's lock id, not mint a new one.
    expect(region).toMatch(/lockId\s*=\s*callerHeldLockId/);
  });

  it("never releases a lock the caller owns (releaseLock short-circuits)", () => {
    const releaseFn = gsc.slice(
      gsc.indexOf("const releaseLock"),
      gsc.indexOf("const releaseLock") + 300
    );
    expect(releaseFn).toMatch(/if\s*\(\s*callerHeldLockId\s*\)\s*return/);
  });

  it("error-path lock release is gated on NOT being caller-owned", () => {
    // The on-error DB-driven release must skip when the caller owns the lock.
    expect(gsc).toMatch(/if\s*\(\s*projectId\s*&&\s*!callerHeldLockId\s*\)/);
  });
});

describe("retry-failed-clip — owns the lock for the whole retry and always cleans up", () => {
  it("passes its held lock down to generate-single-clip via ownedLockId", () => {
    expect(retry).toMatch(/ownedLockId:\s*lockId/);
  });

  it("tracks lock + clip in hoisted state so catch/finally can see them", () => {
    expect(retry).toMatch(/let\s+lockId\b/);
    expect(retry).toMatch(/let\s+lockHeld\b/);
    expect(retry).toMatch(/let\s+clipDbId\b/);
    expect(retry).toMatch(/let\s+cleanupProjectId\b/);
    expect(retry).toMatch(/lockHeld\s*=\s*true/);
  });

  it("releases the generation lock in a finally block (every exit path)", () => {
    const finallyIdx = retry.lastIndexOf("} finally {");
    expect(finallyIdx).toBeGreaterThan(-1);
    const finallyBlock = retry.slice(finallyIdx);
    expect(finallyBlock).toMatch(/releaseGenerationLock\s*\(/);
    expect(finallyBlock).toMatch(/lockHeld/);
  });

  it("reverts the clip to 'failed' on error so it stays re-retryable", () => {
    const catchIdx = retry.lastIndexOf("} catch (error) {");
    const finallyIdx = retry.lastIndexOf("} finally {");
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = retry.slice(catchIdx, finallyIdx);
    expect(catchBlock).toMatch(/clipDbId/);
    expect(catchBlock).toMatch(/status:\s*'failed'/);
    // Only revert a clip we actually flipped to 'generating' (don't clobber a
    // clip that succeeded then hit a later reconciliation error).
    expect(catchBlock).toMatch(/\.eq\(\s*'status'\s*,\s*'generating'\s*\)/);
  });
});
