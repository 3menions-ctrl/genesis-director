/**
 * Regression: /create (and /director, /studio/*) must PRESERVE the query string
 * when folding into /studio. A bare <Navigate to="/studio"> dropped
 * ?template=…/?environment=…/?mode=…/?welcome=…, silently breaking the
 * template-apply, environment-apply, image-to-video, and welcome flows.
 *
 * Studio reads those params via useSearchParams, so the redirect must carry them.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirror of the helper in App.tsx — kept in sync by the source-guard test below.
function QueryPreservingRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function StudioProbe() {
  const location = useLocation();
  return <div data-testid="dest">{location.pathname + location.search}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create" element={<QueryPreservingRedirect to="/studio" />} />
        <Route path="/director" element={<QueryPreservingRedirect to="/studio" />} />
        <Route path="/studio" element={<StudioProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("/create query-preserving redirect", () => {
  it("forwards ?template= to /studio", () => {
    renderAt("/create?template=viral-hook");
    expect(screen.getByTestId("dest").textContent).toBe("/studio?template=viral-hook");
  });

  it("forwards ?environment= to /studio", () => {
    renderAt("/create?environment=neon-alley");
    expect(screen.getByTestId("dest").textContent).toBe("/studio?environment=neon-alley");
  });

  it("forwards multi-param queries (?mode=&welcome=)", () => {
    renderAt("/create?mode=image-to-video&welcome=1");
    expect(screen.getByTestId("dest").textContent).toBe("/studio?mode=image-to-video&welcome=1");
  });

  it("still redirects cleanly with no query", () => {
    renderAt("/create");
    expect(screen.getByTestId("dest").textContent).toBe("/studio");
  });

  it("/director also preserves the query", () => {
    renderAt("/director?template=template-noir-1");
    expect(screen.getByTestId("dest").textContent).toBe("/studio?template=template-noir-1");
  });

  it("App.tsx wires /create through the query-preserving helper, not a bare Navigate", () => {
    const src = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(src).toMatch(/function QueryPreservingRedirect/);
    expect(src).toMatch(/location\.search/);
    expect(src).toMatch(/path="\/create"\s+element=\{<QueryPreservingRedirect to="\/studio"/);
    // The old query-dropping form must be gone for /create.
    expect(src).not.toMatch(/path="\/create"\s+element=\{<Navigate to="\/studio"/);
  });
});
