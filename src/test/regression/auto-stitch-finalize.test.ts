/**
 * Regression: auto-stitch-trigger never finalized the project (QA audit P1-1).
 *
 * THE BUG: the success path set status='stitching', called seamless-stitcher,
 * then RETURNED without ever writing status='completed' or video_url. The
 * project sat at 'stitching' forever (eternal spinner) even though the stitch
 * succeeded — only the error/recovery branches finalized.
 *
 * THE FIX: on stitch success, persist a DURABLE final URL (P0-1) and write the
 * terminal state (status='completed' + video_url) before returning.
 *
 * Static source contract — the edge function imports Deno `https://` modules and
 * can't run under vitest (same approach as src/test/engines/idempotency.test.ts).
 * Asserts on the SUCCESS region only (between the stitch-result log and the
 * success Response) so the pre-existing error-branch finalize doesn't mask it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/auto-stitch-trigger/index.ts"),
  "utf-8",
);

// The happy path: from the "seamless-stitcher result" log to the success Response.
const successRegion = (() => {
  const start = src.indexOf("seamless-stitcher result");
  const end = src.indexOf("readyToStitch: true,\n        stitchMode");
  return start >= 0 && end > start ? src.slice(start, end) : "";
})();

describe("auto-stitch-trigger — finalizes the project on stitch success", () => {
  it("locates the success region", () => {
    expect(successRegion.length).toBeGreaterThan(0);
  });

  it("writes status='completed' on success (not just on error)", () => {
    expect(successRegion).toMatch(/status:\s*'completed'/);
  });

  it("writes a video_url on success", () => {
    expect(successRegion).toMatch(/video_url:\s*durableFinalUrl/);
  });

  it("persists a DURABLE url before finalizing (P0-1 guard reused)", () => {
    expect(successRegion).toMatch(/isTemporaryReplicateUrl/);
    expect(successRegion).toMatch(/persistVideoToStorage/);
    expect(successRegion).toMatch(/durableFinalUrl/);
  });

  it("the DB update happens before the success Response", () => {
    const updateIdx = successRegion.indexOf(".update({");
    expect(updateIdx).toBeGreaterThan(-1);
  });

  it("invokes the stitcher with includeIntro:false (canonical path parity)", () => {
    expect(src).toMatch(/includeIntro:\s*false/);
  });
});
