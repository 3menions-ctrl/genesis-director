/**
 * Edge function orphan detection — wired into the test suite so a
 * `supabase.functions.invoke("foo")` call that drifts past its
 * matching edge function deploy fails CI.
 *
 * The detector lives in `scripts/check-edge-function-orphans.ts`
 * for standalone CLI use; this test just runs its `computeOrphans()`
 * function and asserts the blocking failures stay empty.
 *
 * Two categories:
 *   1. invokedButMissing → blocking. A 404 at runtime.
 *   2. onDiskButUnused   → informational. Reported but not failing.
 *
 * If you intentionally add an edge function that the frontend
 * shouldn't call (a webhook target, a cron job, an edge-to-edge
 * helper), add its name to KNOWN_BACKEND_ONLY in the script.
 */

import { describe, it, expect } from "vitest";
import { computeOrphans } from "../../../scripts/check-edge-function-orphans";

describe("Edge function orphan detection", () => {
  const report = computeOrphans();

  it("every invoked function exists on disk (404 protection)", () => {
    if (report.invokedButMissing.length > 0) {
      // eslint-disable-next-line no-console
      console.error("\n❌ INVOKED BUT MISSING:");
      for (const { name, callSites } of report.invokedButMissing) {
        // eslint-disable-next-line no-console
        console.error(`  • ${name}`);
        for (const site of callSites) {
          // eslint-disable-next-line no-console
          console.error(`      ${site}`);
        }
      }
    }
    expect(report.invokedButMissing).toEqual([]);
  });

  it("informational: count of unused-by-frontend edge functions stays reported", () => {
    // No assertion on the count — just makes the number visible in the
    // test output so we can watch the cleanup over time.
    // eslint-disable-next-line no-console
    console.log(
      `[orphans] ${report.onDiskButUnused.length} edge functions on disk are never invoked from the frontend (may be webhooks / cron / edge-to-edge).`,
    );
    expect(report.onDiskButUnused.length).toBeGreaterThanOrEqual(0);
  });
});
