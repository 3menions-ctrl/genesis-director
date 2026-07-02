/**
 * Regression: fully-failed avatar project never marked terminal (QA audit P1-6).
 *
 * THE BUG: handleMultiClipAvatar in check-specialized-status only ever set
 * status='completed'. When every clip failed it reported isFailed:true but never
 * wrote status='failed', so the project hung in its prior status (e.g.
 * 'processing') forever and the UI spun indefinitely.
 *
 * THE FIX: a terminal-failure branch sets status='failed' when
 * allDone && failedCount === totalCount && !hasAllVideos.
 *
 * Source contract (Deno edge fn can't run under vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/check-specialized-status/index.ts"),
  "utf-8",
);

describe("check-specialized-status — terminal failure for all-failed avatar jobs", () => {
  it("has a branch that fires when every clip failed", () => {
    expect(src).toMatch(
      /allDone && failedCount === totalCount && !hasAllVideos/,
    );
  });

  it("sets status='failed' (not only 'completed')", () => {
    // The handler must now contain a failed-status write, not just completed.
    expect(src).toMatch(/updateData\.status\s*=\s*'failed'/);
  });

  it("marks the pipeline stage failed so the UI stops spinning", () => {
    const region = src.slice(
      src.indexOf("allDone && failedCount === totalCount"),
      src.indexOf("allDone && failedCount === totalCount") + 700,
    );
    expect(region).toMatch(/stage:\s*'failed'/);
  });
});
