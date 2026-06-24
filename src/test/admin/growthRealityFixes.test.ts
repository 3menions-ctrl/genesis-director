/**
 * Guards for the Growth-hub "reality" fixes — keeps fabricated/broken data from
 * creeping back into pages that are shown to an operator as live.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, `src/refine/pages/ops/${p}`), "utf8");

describe("Growth reality fixes", () => {
  it("Cohorts queries only real signup_analytics columns (no phantom activated_at/converted_at)", () => {
    const src = read("AdminCohortsPage.tsx");
    expect(src).toMatch(/from\("signup_analytics"\)/);
    // the phantom columns must not appear in a .select() call (the doc comment
    // may still reference them when explaining the fix)
    expect(src).not.toMatch(/\.select\([^)]*activated_at/);
    expect(src).not.toMatch(/\.select\([^)]*converted_at/);
    // real acquisition fields + a real conversion join + an error state
    expect(src).toMatch(/utm_source/);
    expect(src).toMatch(/account_tier/);
    expect(src).toMatch(/setError/);
  });

  it("Notifications no longer shows fabricated channel toggle pills", () => {
    const src = read("AdminNotificationsPage.tsx");
    expect(src).not.toMatch(/Email · on/);
    expect(src).not.toMatch(/In-app · on/);
  });

  it("Content safety drops the permanently-zero 'Total hits' live KPI", () => {
    const src = read("AdminContentSafetyPage.tsx");
    expect(src).not.toMatch(/"Total hits"/);
  });

  it("Email templates delete warning is honest (no false 'start failing')", () => {
    const src = read("AdminEmailTemplatesPage.tsx");
    expect(src).not.toMatch(/start failing/);
  });
});
