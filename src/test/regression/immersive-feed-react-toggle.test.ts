/**
 * Regression: Lobby feed emoji reactions duplicated infinitely (QA audit P2-2).
 *
 * THE BUG: ImmersiveFeed.react() was insert-only into reel_reactions (which has
 * no uniqueness), so every tap wrote a new row — a user could inflate a reel's
 * reaction totals by tapping repeatedly and could never un-react. The sibling
 * ImmersiveTheater.react() already toggled correctly.
 *
 * THE FIX: react() now toggles via a per-viewer myReactions set
 * (delete-or-insert) with rollback on failure, mirroring Theater.
 *
 * Source contract (component needs DOM + mocks to render).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(
  resolve(REPO_ROOT, "src/components/social/ImmersiveFeed.tsx"),
  "utf-8",
);

describe("ImmersiveFeed.react — toggles instead of insert-only", () => {
  it("tracks the viewer's own reactions", () => {
    expect(src).toMatch(/myReactions/);
  });

  it("deletes on an existing reaction (un-react), not just insert", () => {
    const region = src.slice(src.indexOf("const react ="), src.indexOf("const react =") + 900);
    expect(region).toMatch(/reel_reactions[\s\S]*?\.delete\(\)/);
    expect(region).toMatch(/\.insert\(/);
    // The decision must branch on whether the viewer already reacted.
    expect(region).toMatch(/const had = myReactions\.has\(emoji\)/);
  });

  it("dropped the dead, never-rendered reactCount counter", () => {
    expect(src).not.toMatch(/setReactCount/);
  });
});
