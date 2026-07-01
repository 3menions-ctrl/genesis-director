/**
 * Regression: destructive/silent P3s (QA audit).
 *
 * - Cast member delete had NO confirmation (bare hard-delete on one click).
 *   Fixed: confirmAsync gate.
 * - SettingsDashboard push-pref + patron-tier edits swallowed errors (no toast,
 *   no rollback) → a failed save looked successful then reverted on reload.
 *   Fixed: surface the error + roll back the optimistic state.
 *
 * Source contracts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");
const dash = readFileSync(
  resolve(REPO_ROOT, "src/pages/account/SettingsDashboard.tsx"),
  "utf-8",
);

// Cast delete-confirm (P3) is NOT in this PR: Cast.tsx diverged on main (#188).
// Re-apply the confirmAsync gate on main's Cast.tsx separately.

describe("SettingsDashboard toggles surface + roll back on failure", () => {
  it("setPushPref rolls back and toasts on error", () => {
    const region = dash.slice(dash.indexOf("const setPushPref"), dash.indexOf("const setPushPref") + 800);
    expect(region).toMatch(/if\s*\(error\)/);
    expect(region).toMatch(/toast\.error/);
    expect(region).toMatch(/setPushPrefs/);
  });
  it("updateTier rolls back and toasts on error", () => {
    const region = dash.slice(dash.indexOf("const updateTier"), dash.indexOf("const updateTier") + 600);
    expect(region).toMatch(/const prev =/);
    expect(region).toMatch(/if\s*\(error\)/);
    expect(region).toMatch(/toast\.error/);
  });
});
