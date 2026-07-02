/**
 * Regression: a stuck awaiting_approval draft blocked ALL new creations
 * (QA audit P1-3).
 *
 * THE BUG: mode-router enforces one active project across
 * ['generating','processing','pending','awaiting_approval'] → 409
 * active_project_exists. An abandoned, unapproved draft (with its pre-approval
 * credit hold) therefore permanently walled off every new "Create".
 *
 * THE FIX:
 *   - mode-router auto-expires a STALE awaiting_approval draft (cancel + release
 *     its pre-approval credit hold) and proceeds, instead of 409-ing forever.
 *   - The 409 (for non-stale blockers) now carries canCancel so the client can
 *     offer a one-click "cancel & start new".
 *   - Studio offers that one-click: confirm → cancel-project → retry mode-router.
 *
 * Static source contracts (Deno edge fn + client glue can't run under vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const modeRouter = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/mode-router/index.ts"),
  "utf-8",
);
const studio = readFileSync(resolve(REPO_ROOT, "src/pages/Studio.tsx"), "utf-8");

// The active-project block: from the constraint header to the proceed log.
const lockRegion = (() => {
  const start = modeRouter.indexOf("SINGLE PROJECT CONSTRAINT");
  const end = modeRouter.indexOf("No active projects, proceeding");
  return start >= 0 && end > start ? modeRouter.slice(start, end) : "";
})();

describe("mode-router — auto-expires a stale awaiting_approval draft", () => {
  it("locates the active-project lock region", () => {
    expect(lockRegion.length).toBeGreaterThan(0);
  });

  it("only auto-expires awaiting_approval drafts past a TTL (not active renders)", () => {
    expect(lockRegion).toMatch(/awaiting_approval/);
    expect(lockRegion).toMatch(/STALE_DRAFT_MS|stale/i);
    expect(lockRegion).toMatch(/created_at/);
  });

  it("releases the pre-approval credit hold when expiring (no leaked hold)", () => {
    expect(lockRegion).toMatch(/releasePipelineCredits/);
  });

  it("marks the abandoned draft cancelled so it stops blocking", () => {
    expect(lockRegion).toMatch(/status:\s*'cancelled'/);
  });

  it("still 409s when NOT auto-expired, and signals canCancel", () => {
    expect(lockRegion).toMatch(/active_project_exists/);
    expect(lockRegion).toMatch(/canCancel:\s*true/);
    // The 409 must be guarded so an auto-expired blocker falls through.
    expect(lockRegion).toMatch(/if\s*\(\s*!autoExpired\s*\)/);
  });
});

describe("Studio — one-click cancel & retry on active_project_exists", () => {
  it("detects the blocker and confirms before cancelling", () => {
    expect(studio).toMatch(/active_project_exists/);
    expect(studio).toMatch(/canCancel/);
    expect(studio).toMatch(/confirmAsync/);
  });

  it("cancels the blocking project then retries mode-router", () => {
    const region = studio.slice(
      studio.indexOf("active_project_exists"),
      studio.indexOf("active_project_exists") + 900,
    );
    expect(region).toMatch(/invoke\(\s*["']cancel-project["']/);
    expect(region).toMatch(/existingProjectId/);
    // retry of the create call after cancel
    expect(region).toMatch(/invoke\(\s*["']mode-router["']/);
  });
});
