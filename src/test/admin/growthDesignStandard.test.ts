/**
 * Guards that the Growth analytics/moderation pages stay on the new floating
 * design standard (AdminPageShell + floating primitives) and don't regress to
 * the legacy header/card/table system — and that each handles errors instead of
 * swallowing them.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, `src/refine/pages/ops/${p}`), "utf8");

const MIGRATED = [
  "AdminTrafficPage.tsx",
  "AdminEventsPage.tsx",
  "AdminInsightsPage.tsx",
  "AdminProjectionsPage.tsx",
  "AdminCohortsPage.tsx",
  "AdminCommentsPage.tsx",
];

describe("Growth pages — design standard", () => {
  for (const f of MIGRATED) {
    describe(f, () => {
      const src = read(f);
      it("uses the new AdminPageShell", () => {
        expect(src).toMatch(/AdminPageShell/);
      });
      it("does not use the legacy header/card/table primitives", () => {
        expect(src).not.toMatch(/AdminPageHeader|KpiTile|ChartCard/);
        expect(src).not.toMatch(/@\/admin\/ui\/DataTable/);
      });
      it("handles errors (does not silently swallow)", () => {
        expect(src).toMatch(/setError|kind="error"/);
      });
    });
  }
});
