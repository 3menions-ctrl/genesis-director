/**
 * Regression: "Regenerate script" 500'd every time (QA audit P1-2).
 *
 * THE BUG: Production.tsx invokes hollywood-pipeline with
 * { projectId, action:'regenerate_script' }, but hollywood-pipeline had NO
 * action handler — with no concept/manualPrompts it threw "Either 'concept' or
 * 'manualPrompts' is required" → HTTP 500 → "Failed to regenerate script". The
 * user was stuck with the first AI draft.
 *
 * THE FIX: hollywood-pipeline handles action==='regenerate_script' by
 * re-hydrating the original concept (mode-router persisted the prompt to
 * movie_projects.synopsis) + shot budget from the project and falling through to
 * the normal flow (re-runs preproduction, re-parks at awaiting_approval). The
 * idempotent per-project credit hold means no double charge.
 *
 * Static source contracts (Deno edge fn / client glue can't run under vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const hollywood = readFileSync(
  resolve(REPO_ROOT, "supabase/functions/hollywood-pipeline/index.ts"),
  "utf-8",
);
const production = readFileSync(
  resolve(REPO_ROOT, "src/pages/Production.tsx"),
  "utf-8",
);

describe("hollywood-pipeline — handles regenerate_script", () => {
  it("has a regenerate_script action branch", () => {
    expect(hollywood).toMatch(/action\s*===\s*'regenerate_script'/);
  });

  it("re-hydrates the concept from the persisted project (synopsis)", () => {
    const branchStart = hollywood.indexOf("action === 'regenerate_script'");
    const branch = hollywood.slice(
      branchStart,
      hollywood.indexOf("ENGINE LOCK — BULLETPROOF", branchStart),
    );
    expect(branch).toMatch(/\.from\('movie_projects'\)/);
    expect(branch).toMatch(/synopsis/);
    // Must set request.concept so the concept-required guard is satisfied.
    expect(branch).toMatch(/\.concept\s*=/);
    // Must re-park for approval rather than auto-run.
    expect(branch).toMatch(/requireApproval\s*=\s*true/);
  });

  it("the regenerate branch runs BEFORE the concept-required throw (no 500)", () => {
    const branchIdx = hollywood.indexOf("action === 'regenerate_script'");
    const throwIdx = hollywood.indexOf(
      "Either 'concept' or 'manualPrompts' is required",
    );
    expect(branchIdx).toBeGreaterThan(-1);
    expect(throwIdx).toBeGreaterThan(-1);
    expect(branchIdx).toBeLessThan(throwIdx);
  });

  it("fails loudly if the original prompt is missing (no silent empty regen)", () => {
    const branchStart = hollywood.indexOf("action === 'regenerate_script'");
    const branch = hollywood.slice(
      branchStart,
      hollywood.indexOf("ENGINE LOCK — BULLETPROOF", branchStart),
    );
    expect(branch).toMatch(/original prompt/i);
  });
});

describe("Production.tsx — Regenerate button wiring (unchanged contract)", () => {
  it("still invokes hollywood-pipeline with the regenerate_script action", () => {
    expect(production).toMatch(/invoke\(\s*['"]hollywood-pipeline['"]/);
    expect(production).toMatch(/action:\s*['"]regenerate_script['"]/);
  });
});
