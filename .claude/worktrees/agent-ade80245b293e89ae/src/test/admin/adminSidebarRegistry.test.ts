import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPS_PAGES } from "@/refine/pages/ops/_registry";

const layoutSource = readFileSync(
  resolve(__dirname, "../../refine/AdminLayout.tsx"),
  "utf8",
);

/**
 * Extract every NavLink path declared inside the NAV array of AdminLayout.
 * NAV items are written as `{ ..., path: "/admin/..." }`.
 */
function extractNavPaths(source: string): string[] {
  const navStart = source.indexOf("const NAV");
  expect(navStart).toBeGreaterThan(-1);
  const navEnd = source.indexOf("\n];", navStart);
  const navBlock = source.slice(navStart, navEnd);
  const matches = navBlock.matchAll(/path:\s*"(\/admin[^"]*)"/g);
  return Array.from(matches, (m) => m[1]);
}

describe("AdminLayout sidebar registry coverage", () => {
  const navPaths = extractNavPaths(layoutSource);
  const navSet = new Set(navPaths);

  it("registers every ops page path in the sidebar NAV", () => {
    const missing = OPS_PAGES.filter((p) => !navSet.has(p.path)).map(
      (p) => `${p.section}/${p.label} → ${p.path}`,
    );
    expect(missing, `Missing sidebar entries:\n${missing.join("\n")}`).toEqual([]);
  });

  it("renders each ops path inside a NavLink (clickable)", () => {
    // NavLink components inside AdminLayout map every NAV item to <NavLink to={path}>.
    // We assert the source uses `to={path}` for all NAV items by checking the
    // NavLink JSX block exists and references the `path` prop from the iterator.
    expect(layoutSource).toMatch(/<NavLink[\s\S]*?to=\{path\}/);
    for (const page of OPS_PAGES) {
      expect(
        navSet.has(page.path),
        `Sidebar is missing a clickable NavLink for ${page.path}`,
      ).toBe(true);
    }
  });

  it("does not duplicate any sidebar path", () => {
    const dupes = navPaths.filter((p, i) => navPaths.indexOf(p) !== i);
    expect(dupes, `Duplicate sidebar paths: ${dupes.join(", ")}`).toEqual([]);
  });
});