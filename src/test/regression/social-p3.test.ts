/**
 * Regression: social P3s (QA audit).
 *
 * - Live reel comments rendered as "Anonymous" — the realtime reel_comments
 *   payload has no joined author, and it was pushed to state raw. Fixed: enrich
 *   from profiles_public before appending (own comments already enriched).
 * - Reaction double-tap threw a spurious "Failed to react" — the mutation decided
 *   insert-vs-delete from a stale cache, so two quick taps both inserted and the
 *   2nd hit the UNIQUE(user,target,emoji) constraint. Fixed: upsert +
 *   ignoreDuplicates for both video and comment reactions.
 *
 * Source contracts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const theater = readFileSync(
  resolve(REPO_ROOT, "src/components/social/ImmersiveTheater.tsx"),
  "utf-8",
);
const reactions = readFileSync(
  resolve(REPO_ROOT, "src/hooks/useVideoReactions.ts"),
  "utf-8",
);

describe("live reel comments are enriched with the author", () => {
  it("realtime handler resolves the author from profiles_public", () => {
    const region = theater.slice(
      theater.indexOf("reel-comments-"),
      theater.indexOf("reel-comments-") + 1400,
    );
    expect(region).toMatch(/profiles_public/);
    expect(region).toMatch(/author:/);
  });
});

describe("reaction toggles are double-tap safe", () => {
  it("video reactions use upsert with ignoreDuplicates", () => {
    expect(reactions).toMatch(
      /from\('video_reactions'\)[\s\S]*?\.upsert\([\s\S]*?ignoreDuplicates:\s*true/,
    );
  });
  it("comment reactions use upsert with ignoreDuplicates", () => {
    expect(reactions).toMatch(
      /from\('comment_reactions'\)[\s\S]*?\.upsert\([\s\S]*?ignoreDuplicates:\s*true/,
    );
  });
});
