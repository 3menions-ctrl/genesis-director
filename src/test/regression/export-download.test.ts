/**
 * Regression: export/download artifacts were wrong or corrupt (QA audit P1-12, P1-13).
 *
 * - P1-12 generate-project-trailer sent the stitcher fields it doesn't recognize
 *   (mode:'trailer', maxClipSeconds, clipsOverride) → it fell through to
 *   project-mode and re-rendered the FULL film as the "trailer", stored on a
 *   24h URL. Fixed: real clips-mode (clips:[{url,duration}] + sessionId) with a
 *   3s per-clip clamp, persisted durably.
 * - P1-13 brand-video-download byte-concatenated two MP4 containers (duplicate
 *   ftyp/moov) → an unplayable file. Fixed: route through seamless-stitcher
 *   (includeIntro:true, real cog-ffmpeg), fail-safe to the source, persist durably.
 *
 * Source contracts (Deno edge fns).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const trailer = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/generate-project-trailer/index.ts"),
  "utf-8",
);
const branded = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/brand-video-download/index.ts"),
  "utf-8",
);

describe("P1-12 trailer uses real clips-mode + durable URL", () => {
  it("no longer sends the unrecognized trailer/clipsOverride fields", () => {
    expect(trailer).not.toMatch(/clipsOverride/);
    expect(trailer).not.toMatch(/maxClipSeconds/);
    expect(trailer).not.toMatch(/mode:\s*["']trailer["']/);
  });
  it("invokes the stitcher in clips-mode with a sessionId", () => {
    expect(trailer).toMatch(/clips:\s*trailerClips/);
    expect(trailer).toMatch(/sessionId:/);
    expect(trailer).toMatch(/duration:\s*Math\.min\(3/);
  });
  it("persists the trailer URL durably", () => {
    expect(trailer).toMatch(/persistVideoToStorage/);
    expect(trailer).toMatch(/isTemporaryReplicateUrl/);
  });
});

describe("P1-13 branded download no longer byte-concats", () => {
  it("removed the corrupt byte-concat mux", () => {
    expect(branded).not.toMatch(/runMux/);
    expect(branded).not.toMatch(/out\.set\(sourceBytes/);
  });
  it("routes through the stitcher with includeIntro", () => {
    expect(branded).toMatch(/invoke\(\s*[\s\S]*?["']seamless-stitcher["']/);
    expect(branded).toMatch(/includeIntro:\s*true/);
  });
  it("fails safe to the source url and persists durably", () => {
    expect(branded).toMatch(/branded:\s*false/);
    expect(branded).toMatch(/persistVideoToStorage/);
  });
});
