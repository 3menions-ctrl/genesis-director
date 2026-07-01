/**
 * Regression: editor music replace + reference aspect-expand (QA audit P2-23, P2-27).
 *
 * - P2-23 "Replace music" only ran the store-only deleteClip; the old A2
 *   video_clips row survived, so the stitcher muxed BOTH beds (double audio).
 *   Fixed: also delete the A2 DB row (currentMusicClipId IS the row id).
 * - P2-27 analyze-reference-image POSTed to a nonexistent
 *   expand-image-aspect-ratio fn → 404 swallowed, misleading logs. Fixed: honest
 *   no-op returning the original image (no doomed round-trip).
 *
 * Source contracts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const timeline = readFileSync(
  resolve(REPO_ROOT, "src/pages/Editor/views/Timeline.tsx"),
  "utf-8",
);
const analyze = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/analyze-reference-image/index.ts"),
  "utf-8",
);

describe("P2-23 replace music deletes the old A2 DB row", () => {
  it("onReplaceMusic deletes the video_clips row, not just the store clip", () => {
    const region = timeline.slice(
      timeline.indexOf("const onReplaceMusic"),
      timeline.indexOf("const onReplaceMusic") + 700,
    );
    expect(region).toMatch(/from\("video_clips"\)[\s\S]*?\.delete\(\)/);
    expect(region).toMatch(/\.eq\("id",\s*oldId\)/);
  });
});

describe("P2-27 reference aspect-expand is an honest no-op", () => {
  it("no longer fetches the nonexistent expand-image-aspect-ratio fn", () => {
    expect(analyze).not.toMatch(/expand-image-aspect-ratio/);
  });
  it("returns the original image (expanded:false)", () => {
    const region = analyze.slice(
      analyze.indexOf("function expandImageToAspectRatio"),
      analyze.indexOf("function expandImageToAspectRatio") + 1200,
    );
    expect(region).toMatch(/return \{ expanded: false, imageUrl \}/);
  });
});
