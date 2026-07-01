/**
 * Regression: MusicHub generate flow (QA audit P2-21, P2-22).
 *
 * - P2-21: every generated score created TWO "My Tracks" rows — generate-music
 *   records it (recordUserMedia) AND the client re-recorded via record_user_media.
 *   Fixed: rely on the edge fn; client double-record removed.
 * - P2-22: the duration selector offered 60/90s but generate-music hard-clamps to
 *   30s, so those produced a ~30s track stored as 60/90. Fixed: only offer
 *   durations the engine delivers ([15, 30]).
 *
 * Source contract (heavy page component).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(resolve(REPO_ROOT, "src/pages/MusicHub.tsx"), "utf-8");

describe("MusicHub — no duplicate track record (P2-21)", () => {
  it("does not call record_user_media inside the generate() flow", () => {
    // Scope to generate() — uploads elsewhere legitimately record media.
    const genIdx = src.indexOf("const generate = async");
    const gen = src.slice(genIdx, src.indexOf("return (", genIdx));
    expect(gen).not.toMatch(/rpc\("record_user_media"/);
    // Positive signal: the removal note references relying on the edge fn.
    expect(gen).toMatch(/edge fn|recordUserMedia/);
  });
});

describe("MusicHub — duration options match what the engine delivers (P2-22)", () => {
  it("offers only [15, 30] (no lying 60/90)", () => {
    expect(src).toMatch(/const DURATIONS = \[15, 30\]/);
    expect(src).not.toMatch(/\[15, 30, 60, 90\]/);
  });
});
