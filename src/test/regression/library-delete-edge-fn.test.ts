/**
 * Regression: Library delete leaked storage + kept billing + FK-failed (P1-19).
 *
 * THE BUG: Library.tsx deleted a film with a raw
 * `supabase.from("movie_projects").delete()` instead of the delete-project edge
 * function. Consequences on every Library delete: all storage (final video,
 * clips, thumbnails, frames, HLS) orphaned; in-flight Replicate predictions never
 * cancelled (ongoing spend); and a hard FK failure (genesis_scene_clips is
 * RESTRICT) so those films couldn't be deleted at all.
 *
 * THE FIX: route through functions.invoke('delete-project') like StudioContext.
 *
 * Source contract (heavy page component).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(resolve(REPO_ROOT, "src/pages/Library.tsx"), "utf-8");

describe("Library — delete routes through the delete-project edge fn", () => {
  it("does NOT raw-delete movie_projects from the client", () => {
    // Matches `.from("movie_projects") … .delete()` across whitespace/newlines.
    expect(src).not.toMatch(
      /from\(\s*["']movie_projects["']\s*\)[\s\S]{0,60}?\.delete\(\)/,
    );
  });

  it("invokes delete-project with the projectId", () => {
    expect(src).toMatch(/invoke\(\s*["']delete-project["']/);
    expect(src).toMatch(/body:\s*\{\s*projectId:/);
  });

  it("treats a non-success edge response as a failure (rolls back optimistic remove)", () => {
    // The handler must check the edge fn result, not assume success.
    expect(src).toMatch(/data\?\.success/);
  });
});
