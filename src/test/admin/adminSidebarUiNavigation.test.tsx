/**
 * UI-level navigation contract for the AdminLayout sidebar.
 *
 * Renders the real <RefineAdminLayout /> inside a MemoryRouter that mirrors
 * the production /admin route tree (with stub elements per route). For every
 * NAV item:
 *   1. clicks the actual <NavLink> in the rendered sidebar
 *   2. asserts the router URL changed to the expected path
 *   3. asserts no <Navigate> redirect kicked in (URL must equal the link's
 *      href, not a different /admin/* path)
 *
 * Heavy dependencies (AuthContext, Supabase RPC) are mocked so the test runs
 * fully in jsdom with no network.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-admin", email: "admin@test.dev" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

import { RefineAdminLayout } from "@/refine/AdminLayout";

// ── Extract sidebar entries from source-of-truth ─────────────────────────
const layoutSrc = readFileSync(
  resolve(__dirname, "../../refine/AdminLayout.tsx"),
  "utf8",
);
const NAV_BLOCK = layoutSrc.slice(
  layoutSrc.indexOf("const NAV"),
  layoutSrc.indexOf("\n];", layoutSrc.indexOf("const NAV")),
);
const NAV_PATHS = Array.from(
  NAV_BLOCK.matchAll(/path:\s*"(\/admin[^"]*)"/g),
  (m) => m[1],
);

// ── Test harness ─────────────────────────────────────────────────────────
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="probe-pathname">{loc.pathname}</div>;
}

function Stub({ name }: { name: string }) {
  return <div data-testid={`page-${name}`}>page:{name}</div>;
}

function renderShell(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<RefineAdminLayout />}>
          <Route index element={<Stub name="/admin" />} />
          {NAV_PATHS.filter((p) => p !== "/admin").map((p) => (
            <Route key={p} path={p.replace(/^\/admin\//, "")} element={<Stub name={p} />} />
          ))}
        </Route>
        {/* Fallback to capture any unintended redirect targets */}
        <Route path="*" element={<Stub name="__fallback__" />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function flushAdminGate() {
  // The layout awaits supabase.rpc("is_admin") before mounting the sidebar.
  // Two microtask flushes cover the promise + the setState render.
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

// ── Tests ────────────────────────────────────────────────────────────────
describe("AdminLayout sidebar — UI navigation", () => {
  beforeAll(() => {
    expect(NAV_PATHS.length, "NAV path extraction failed").toBeGreaterThan(10);
  });

  it("sidebar renders one <a> per NAV path with the expected href", async () => {
    renderShell("/admin");
    await flushAdminGate();
    for (const p of NAV_PATHS) {
      const link = document.querySelector(`aside a[href="${p}"]`);
      expect(link, `Missing sidebar link for ${p}`).not.toBeNull();
    }
  });

  it("clicking each sidebar link navigates to the exact href (no redirects)", async () => {
    renderShell("/admin");
    await flushAdminGate();

    const probe = () => screen.getByTestId("probe-pathname").textContent;
    const failures: string[] = [];

    for (const expected of NAV_PATHS) {
      const link = document.querySelector(
        `aside a[href="${expected}"]`,
      ) as HTMLAnchorElement | null;
      if (!link) { failures.push(`${expected}: link missing from DOM`); continue; }

      await act(async () => {
        fireEvent.click(link, { button: 0 });
      });
      // Allow any post-navigation effects to settle.
      await act(async () => { await Promise.resolve(); });

      const got = probe();
      if (got !== expected) {
        failures.push(`${expected}: expected pathname ${expected}, got ${got}`);
        continue;
      }
      // Confirm the matched route rendered the page stub (not the fallback).
      const stub = screen.queryByTestId(`page-${expected}`);
      if (!stub) {
        failures.push(`${expected}: route resolved but page stub did not render (likely a redirect or 404)`);
      }
    }

    expect(
      failures,
      `Sidebar UI navigation failures:\n  ${failures.join("\n  ")}`,
    ).toEqual([]);
  });
});