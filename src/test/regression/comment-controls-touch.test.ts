/**
 * Regression: comment like/react + reply/edit/delete were hover-only and thus
 * INVISIBLE / untappable on touch devices (QA audit P2-1) — the reported
 * "liking comments fails" symptom on mobile/iOS.
 *
 * THE BUG: both control rows in VideoCommentsSection used
 * `opacity-0 group-hover:opacity-100`. Touch devices have no hover, so a fresh
 * comment (with no existing reactions) showed only that hidden row → reacting,
 * replying, editing and deleting a comment all appeared to do nothing.
 *
 * THE FIX: visible by default on touch (`opacity-100`), hover/focus-reveal kept
 * for desktop (`md:opacity-0 md:group-hover:opacity-100 group-focus-within:…`).
 *
 * Source contract — rendering the component needs Tailwind (not applied in jsdom)
 * plus heavy hook/supabase mocks, so we assert the className contract directly.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const src = readFileSync(
  resolve(REPO_ROOT, "src/components/social/VideoCommentsSection.tsx"),
  "utf-8",
);

describe("VideoCommentsSection — comment controls are reachable on touch", () => {
  it("has NO control row that is hover-only with no mobile-visible override", () => {
    // The bug pattern: opacity-0 immediately followed by group-hover with no
    // `md:`-scoped reveal and no base `opacity-100`. Match the class string and
    // ensure each occurrence is the fixed, mobile-visible variant.
    const hoverOnly = src.match(/opacity-0 group-hover:opacity-100/g) || [];
    expect(hoverOnly.length).toBe(0);
  });

  it("uses the mobile-visible + desktop-hover pattern on both control rows", () => {
    const fixed =
      src.match(/opacity-100 md:opacity-0 md:group-hover:opacity-100/g) || [];
    // The emoji-react quick-add row AND the reply/edit/delete row.
    expect(fixed.length).toBeGreaterThanOrEqual(2);
  });

  it("also reveals on keyboard focus for desktop a11y", () => {
    expect(src).toMatch(/group-focus-within:opacity-100/);
  });
});
