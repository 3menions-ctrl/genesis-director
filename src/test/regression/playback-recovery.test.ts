/**
 * Regression: playback & recovery gaps (QA audit P1-9, P1-10, P1-11, P2-30).
 *
 * - P1-9  TimelinePlayer had no <video onError> → a dead/expired clip froze the
 *         whole reel. Now onError skips to the next clip (mirrors onEnded).
 * - P1-10 Reel "Still rendering…" never updated (loader keyed only on
 *         [id, user]) → now polls for completion and self-clears.
 * - P1-11 useClipRecovery queried only status='generating' (missed 'processing')
 *         and omitted userId (so failures couldn't be flipped). Fixed both.
 * - P2-30 useRenderCompleteNotifier omitted 'processing' and the singular
 *         'complete' writer variant → completion toast skipped. Fixed both.
 *
 * Source contracts (components/hooks need DOM + heavy mocks to run).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(REPO_ROOT, p), "utf-8");

describe("P1-9 TimelinePlayer skips a dead clip instead of freezing", () => {
  const src = read("src/components/player/TimelinePlayer.tsx");
  it("wires onError on the <video> to advance()", () => {
    expect(src).toMatch(/onError=\{\(\)\s*=>\s*key === activeKey && advance\(\)\}/);
  });
});

describe("P1-10 Reel polls while still rendering", () => {
  const src = read("src/pages/Reel.tsx");
  it("has a polling effect gated on a still-rendering condition", () => {
    expect(src).toMatch(/setInterval\(/);
    expect(src).toMatch(/stillRendering/);
  });
  it("self-clears the interval when output appears", () => {
    expect(src).toMatch(/clearInterval\(/);
  });
});

describe("P1-11 useClipRecovery covers processing + passes userId", () => {
  const src = read("src/hooks/useClipRecovery.ts");
  it("queries both generating and processing", () => {
    expect(src).toMatch(/\.in\(\s*'status'\s*,\s*\[\s*'generating'\s*,\s*'processing'\s*\]\s*\)/);
    expect(src).not.toMatch(/\.eq\(\s*'status'\s*,\s*'generating'\s*\)/);
  });
  it("includes userId in the check-video-status body", () => {
    const region = src.slice(src.indexOf("check-video-status"), src.indexOf("check-video-status") + 400);
    expect(region).toMatch(/\buserId\b/);
  });
});

describe("P2-30 useRenderCompleteNotifier recognizes processing + complete", () => {
  const src = read("src/hooks/useRenderCompleteNotifier.ts");
  it("treats processing as an active status", () => {
    const active = src.slice(src.indexOf("ACTIVE_STATUSES"), src.indexOf("COMPLETED_STATUSES"));
    expect(active).toMatch(/"processing"/);
  });
  it("accepts both completed and complete", () => {
    expect(src).toMatch(/COMPLETED_STATUSES\s*=\s*new Set\(\[\s*"completed"\s*,\s*"complete"\s*\]\)/);
  });
});
