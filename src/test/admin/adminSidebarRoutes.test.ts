import { describe, it, expect, expectTypeOf } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Project,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type JsxElement,
  type JsxSelfClosingElement,
  type Node,
  type ObjectLiteralExpression,
} from "ts-morph";
import {
  OPS_PAGES,
  type OpsRegistry,
  type RegisteredOpsFile,
  type RegisteredOpsPath,
} from "@/refine/pages/ops/_registry";

// ── AST setup (ts-morph) ─────────────────────────────────────────────────
// Resilient to whitespace, line wrapping, attribute ordering, and other
// purely cosmetic source changes. Only semantic structure is compared.
const SRC_DIR = resolve(__dirname, "../../");
const project = new Project({
  useInMemoryFileSystem: false,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { allowJs: false, jsx: 4 /* Preserve */ },
});
// The admin console was extracted from App.tsx into a self-contained module
// (src/admin/AdminApp.tsx) mounted at /admin/*. Its lazy imports and <Route>
// wiring now live there, with RELATIVE child paths under one pathless layout.
const ADMIN_DIR = resolve(SRC_DIR, "admin");
const layoutSf = project.addSourceFileAtPath(resolve(SRC_DIR, "refine/AdminLayout.tsx"));
const appSf = project.addSourceFileAtPath(resolve(ADMIN_DIR, "AdminApp.tsx"));

/** Read a string-literal property from an object literal (any quote style). */
function readStringProp(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || prop.getKind() !== SyntaxKind.PropertyAssignment) return undefined;
  const init = (prop as import("ts-morph").PropertyAssignment).getInitializer();
  return init && init.getKind() === SyntaxKind.StringLiteral
    ? (init as import("ts-morph").StringLiteral).getLiteralText()
    : undefined;
}

// — Sidebar NAV: walk the `const NAV = [...]` array literal in AdminLayout —
const navPaths: string[] = (() => {
  const decl = layoutSf.getVariableDeclarationOrThrow("NAV");
  const arr = decl.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
  const out: string[] = [];
  for (const section of arr.getElements()) {
    if (section.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;
    const items = (section as ObjectLiteralExpression).getProperty("items");
    if (!items || items.getKind() !== SyntaxKind.PropertyAssignment) continue;
    const itemsArr = (items as import("ts-morph").PropertyAssignment).getInitializer();
    if (!itemsArr || itemsArr.getKind() !== SyntaxKind.ArrayLiteralExpression) continue;
    for (const item of (itemsArr as import("ts-morph").ArrayLiteralExpression).getElements()) {
      if (item.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;
      const path = readStringProp(item as ObjectLiteralExpression, "path");
      if (path) out.push(path);
    }
  }
  return out;
})();

// — App.tsx: collect every `const X = lazy(() => import("…"))` declaration —
const lazyImports: Map<string, string> = (() => {
  const out = new Map<string, string>();
  for (const decl of appSf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init || init.getKind() !== SyntaxKind.CallExpression) continue;
    const call = init as CallExpression;
    if (call.getExpression().getText() !== "lazy") continue;
    const arg = call.getArguments()[0];
    if (!arg || arg.getKind() !== SyntaxKind.ArrowFunction) continue;
    const body = (arg as ArrowFunction).getBody();
    // body may be `import("…")` directly, or a block with a `return import(…)`.
    const importCall = body.asKind(SyntaxKind.CallExpression)
      ?? body.getFirstDescendantByKind(SyntaxKind.CallExpression);
    if (!importCall || importCall.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const spec = importCall.getArguments()[0];
    if (!spec || spec.getKind() !== SyntaxKind.StringLiteral) continue;
    out.set(decl.getName(), (spec as import("ts-morph").StringLiteral).getLiteralText());
  }
  return out;
})();

// — App.tsx: walk every <Route> JSX node nested under the /admin parent —
type RouteKind = { kind: "component"; component: string } | { kind: "redirect"; to: string };

function jsxAttr(el: JsxElement | JsxSelfClosingElement, name: string): Node | undefined {
  const opening = el.getKind() === SyntaxKind.JsxElement
    ? (el as JsxElement).getOpeningElement()
    : (el as JsxSelfClosingElement);
  return opening.getAttribute(name);
}
function jsxStringAttr(el: JsxElement | JsxSelfClosingElement, name: string): string | undefined {
  const a = jsxAttr(el, name);
  if (!a || a.getKind() !== SyntaxKind.JsxAttribute) return undefined;
  const init = (a as import("ts-morph").JsxAttribute).getInitializer();
  if (!init) return undefined;
  if (init.getKind() === SyntaxKind.StringLiteral) {
    return (init as import("ts-morph").StringLiteral).getLiteralText();
  }
  return undefined;
}
function jsxTagName(el: JsxElement | JsxSelfClosingElement): string {
  return el.getKind() === SyntaxKind.JsxElement
    ? (el as JsxElement).getOpeningElement().getTagNameNode().getText()
    : (el as JsxSelfClosingElement).getTagNameNode().getText();
}
function elementOfRoute(
  el: JsxElement | JsxSelfClosingElement,
): { kind: "component" | "navigate"; name: string; to?: string } | undefined {
  const attr = jsxAttr(el, "element");
  if (!attr || attr.getKind() !== SyntaxKind.JsxAttribute) return undefined;
  const init = (attr as import("ts-morph").JsxAttribute).getInitializer();
  if (!init || init.getKind() !== SyntaxKind.JsxExpression) return undefined;
  const expr = (init as import("ts-morph").JsxExpression).getExpression();
  if (!expr) return undefined;
  // <Route element={<Foo />}> or {<Foo>...</Foo>}
  let inner: JsxElement | JsxSelfClosingElement | undefined;
  if (expr.getKind() === SyntaxKind.JsxSelfClosingElement) inner = expr as JsxSelfClosingElement;
  else if (expr.getKind() === SyntaxKind.JsxElement) inner = expr as JsxElement;
  if (!inner) return undefined;
  const name = jsxTagName(inner);
  if (name === "Navigate") {
    return { kind: "navigate", name, to: jsxStringAttr(inner, "to") };
  }
  return { kind: "component", name };
}

const { adminRoutes, pathToRoute } = (() => {
  const routes = new Set<string>(["/admin"]);
  const map = new Map<string, RouteKind>();
  // React Router uses the first matching route — first-write-wins.
  const setOnce = (k: string, v: RouteKind) => { if (!map.has(k)) map.set(k, v); };

  // AdminApp.tsx renders a single <Routes> tree: one pathless layout <Route>
  // (RefineAdminLayout) wrapping children whose paths are RELATIVE (e.g.
  // path="audit", or an index route for /admin). Collect every <Route> in the
  // file and normalise relative paths back to absolute /admin/... ones.
  const allRoutes = [
    ...appSf.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...appSf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ].filter((el) => jsxTagName(el as JsxElement | JsxSelfClosingElement) === "Route") as Array<
    JsxElement | JsxSelfClosingElement
  >;

  for (const r of allRoutes) {
    const path = jsxStringAttr(r, "path");
    const isIndex = !!jsxAttr(r, "index");
    const full = isIndex
      ? "/admin"
      : path
        ? path.startsWith("/admin") ? path : "/admin/" + path.replace(/^\//, "")
        : undefined;
    if (!full) continue; // pathless layout route — no own URL
    routes.add(full);
    const el = elementOfRoute(r);
    if (!el) continue;
    if (el.kind === "navigate") {
      setOnce(full, { kind: "redirect", to: el.to ?? "" });
    } else {
      setOnce(full, { kind: "component", component: el.name });
    }
  }
  return { adminRoutes: routes, pathToRoute: map };
})();

/**
 * Expected component for every sidebar path. Ops pages come from the registry;
 * the remaining core paths are the canonical, hand-wired Admin shell pages.
 */
const CORE_PATH_TO_COMPONENT: Record<string, string> = {
  "/admin": "AdminCommandCenter", // Horizon overview (previous AdminDashboardPage now at /admin/classic)
  "/admin/users": "AdminUsersPage",
  "/admin/messages": "AdminMessagesPage",
  "/admin/finance": "AdminFinancePage",
  "/admin/credits": "AdminCreditsPage",
  "/admin/projects": "AdminProjectsPage",
  "/admin/moderation": "AdminModerationPage",
  "/admin/production": "AdminProductionPage",
  "/admin/emails": "AdminEmailsPage",
  "/admin/config": "AdminConfigPage",
  "/admin/people": "PeopleHubPage",
  "/admin/production-hub": "ProductionHubPage",
  "/admin/money": "MoneyHubPage",
  "/admin/growth": "GrowthHubPage",
  "/admin/system": "SystemHubPage",
};
// Strongly-typed map: keys are the literal-union of every registered path,
// values are the literal-union of every registered component file. Any future
// drift in OPS_PAGES (renamed file, retyped path) flows into this map and the
// test signature, surfacing as a compile error rather than a runtime miss.
const opsPathToComponent: ReadonlyMap<RegisteredOpsPath, RegisteredOpsFile> =
  new Map(OPS_PAGES.map((p) => [p.path, p.file] as const));

const expectedComponentForPath = (path: string): string | undefined =>
  CORE_PATH_TO_COMPONENT[path] ?? opsPathToComponent.get(path as RegisteredOpsPath);

/**
 * Sidebar paths that are *intentionally* wired as <Navigate to="…" /> redirects
 * (e.g., legacy aliases consolidated under a canonical Admin page). Each entry
 * declares the canonical target path the sidebar item must redirect to. The
 * target must itself resolve to a real component <Route> — not another redirect.
 *
 * Keep this map empty unless a sidebar item is *deliberately* a redirect. Any
 * sidebar path that ends up as a Navigate without being listed here will fail
 * the "every sidebar path renders its expected component" assertion above.
 */
const EXPECTED_SIDEBAR_REDIRECTS: Record<string, string> = {
  // e.g. "/admin/legacy-finance": "/admin/finance",
};

describe("AdminLayout sidebar ↔ App routes", () => {
  it("OPS_PAGES enforces template-literal typing for path & file", () => {
    // Compile-time guarantees — these assertions are evaluated by tsc, not at
    // runtime. If a registry entry ever has e.g. path: "admin/foo" (missing
    // leading slash) or file: "FooComponent" (missing Admin*Page convention),
    // the build fails before this test even runs.
    expectTypeOf(OPS_PAGES).toMatchTypeOf<OpsRegistry>();
    expectTypeOf<RegisteredOpsPath>().toMatchTypeOf<`/admin/${string}`>();
    expectTypeOf<RegisteredOpsFile>().toMatchTypeOf<`Admin${string}Page`>();
  });

  it("every sidebar path matches an actual <Route> under /admin", () => {
    const orphans = navPaths.filter((p) => !adminRoutes.has(p));
    expect(orphans, `Sidebar paths without a route: ${orphans.join(", ")}`).toEqual([]);
  });

  it("every ops registry page has a lazy import in App.tsx", () => {
    const missing = OPS_PAGES.filter((p) => !lazyImports.has(p.file)).map((p) => p.file);
    expect(missing, `Missing lazy imports: ${missing.join(", ")}`).toEqual([]);
  });

  it("every ops registry page is wired as a route", () => {
    const missing = OPS_PAGES.filter((p) => !adminRoutes.has(p.path)).map((p) => p.path);
    expect(missing, `Missing routes: ${missing.join(", ")}`).toEqual([]);
  });

  // ── Stricter, component-level assertions ─────────────────────────────

  it("every sidebar path has a known expected component", () => {
    const unknown = navPaths.filter((p) => !expectedComponentForPath(p));
    expect(
      unknown,
      `Sidebar paths with no expected component mapping (update CORE_PATH_TO_COMPONENT or _registry.ts): ${unknown.join(", ")}`,
    ).toEqual([]);
  });

  it("every sidebar path renders its expected component (no redirects, no swaps)", () => {
    const mismatches: string[] = [];
    for (const path of navPaths) {
      const expected = expectedComponentForPath(path);
      if (!expected) continue; // covered by the previous test
      const route = pathToRoute.get(path);
      if (!route) {
        mismatches.push(`${path} → no <Route> element found`);
        continue;
      }
      if (route.kind === "redirect") {
        mismatches.push(`${path} → redirects to ${route.to}, expected component <${expected} />`);
        continue;
      }
      if (route.component !== expected) {
        mismatches.push(`${path} → renders <${route.component} />, expected <${expected} />`);
      }
    }
    expect(mismatches, `Sidebar/component mismatches:\n  ${mismatches.join("\n  ")}`).toEqual([]);
  });

  it("every sidebar component is lazy-imported and the import file exists on disk", () => {
    const problems: string[] = [];
    for (const path of navPaths) {
      const expected = expectedComponentForPath(path);
      if (!expected) continue;
      const importPath = lazyImports.get(expected);
      if (!importPath) {
        problems.push(`${expected} (${path}) — no lazy(() => import(...)) declaration`);
        continue;
      }
      // AdminApp.tsx lives in src/admin/, so its relative imports (e.g.
      // "../refine/pages/Foo") resolve against src/admin/. "@/foo" aliases
      // resolve against src/.
      const isAlias = importPath.startsWith("@/");
      const baseDir = isAlias ? SRC_DIR : ADMIN_DIR;
      const rel = isAlias ? importPath.slice(2) : importPath;
      const candidates = [rel, `${rel}.tsx`, `${rel}.ts`, `${rel}/index.tsx`, `${rel}/index.ts`];
      const found = candidates.some((c) => existsSync(resolve(baseDir, c)));
      if (!found) {
        problems.push(`${expected} (${path}) — import "${importPath}" does not resolve to a file`);
      }
    }
    expect(problems, `Lazy import problems:\n  ${problems.join("\n  ")}`).toEqual([]);
  });

  it("no two sidebar paths share the same lazy-loaded component (catches copy/paste wiring)", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const path of navPaths) {
      const expected = expectedComponentForPath(path);
      if (!expected) continue;
      const prior = seen.get(expected);
      if (prior) dupes.push(`${expected} is wired to both ${prior} and ${path}`);
      else seen.set(expected, path);
    }
    expect(dupes, `Duplicate component wiring:\n  ${dupes.join("\n  ")}`).toEqual([]);
  });

  it("declared sidebar redirects point to the correct target and resolve to the expected component", () => {
    const problems: string[] = [];
    for (const [from, expectedTo] of Object.entries(EXPECTED_SIDEBAR_REDIRECTS)) {
      // 1) Sidebar must actually surface this path.
      if (!navPaths.includes(from)) {
        problems.push(`${from} is in EXPECTED_SIDEBAR_REDIRECTS but is not a sidebar path`);
        continue;
      }
      // 2) The route must exist and be a <Navigate> (not a component swap).
      const route = pathToRoute.get(from);
      if (!route) {
        problems.push(`${from} → no <Route> element found (expected redirect to ${expectedTo})`);
        continue;
      }
      if (route.kind !== "redirect") {
        problems.push(`${from} → renders <${route.component} />, expected <Navigate to="${expectedTo}" />`);
        continue;
      }
      // 3) The redirect target must match exactly.
      if (route.to !== expectedTo) {
        problems.push(`${from} → redirects to "${route.to}", expected "${expectedTo}"`);
        continue;
      }
      // 4) The target must itself be a known sidebar/ops path with a known component.
      const targetExpected = expectedComponentForPath(expectedTo);
      if (!targetExpected) {
        problems.push(`${from} → ${expectedTo} has no expected component mapping`);
        continue;
      }
      // 5) The target route must render that component (no chained redirects).
      const targetRoute = pathToRoute.get(expectedTo);
      if (!targetRoute) {
        problems.push(`${from} → ${expectedTo} has no <Route> element`);
        continue;
      }
      if (targetRoute.kind === "redirect") {
        problems.push(`${from} → ${expectedTo} is itself a redirect to "${targetRoute.to}" (chained redirects forbidden)`);
        continue;
      }
      if (targetRoute.component !== targetExpected) {
        problems.push(
          `${from} → ${expectedTo} renders <${targetRoute.component} />, expected <${targetExpected} />`,
        );
      }
    }
    expect(problems, `Sidebar redirect problems:\n  ${problems.join("\n  ")}`).toEqual([]);
  });

  it("no sidebar path is an undeclared redirect (intentional redirects must be listed in EXPECTED_SIDEBAR_REDIRECTS)", () => {
    const undeclared: string[] = [];
    for (const path of navPaths) {
      const route = pathToRoute.get(path);
      if (route?.kind === "redirect" && !(path in EXPECTED_SIDEBAR_REDIRECTS)) {
        undeclared.push(`${path} → redirects to "${route.to}" but is not in EXPECTED_SIDEBAR_REDIRECTS`);
      }
    }
    expect(undeclared, `Undeclared sidebar redirects:\n  ${undeclared.join("\n  ")}`).toEqual([]);
  });

  it("emits a route↔sidebar wiring report (CSV + JSON)", () => {
    type Row = {
      sidebarPath: string;
      expectedComponent: string | null;
      actualComponent: string | null;
      redirectTo: string | null;
      lazyImport: string | null;
      status: "ok" | "missing-route" | "redirect" | "component-mismatch" | "no-expected" | "missing-lazy-import";
    };
    const rows: Row[] = navPaths.map((path) => {
      const expected = expectedComponentForPath(path) ?? null;
      const route = pathToRoute.get(path);
      const lazyImport = expected ? lazyImports.get(expected) ?? null : null;
      let actualComponent: string | null = null;
      let redirectTo: string | null = null;
      let status: Row["status"];
      if (!route) status = "missing-route";
      else if (route.kind === "redirect") {
        redirectTo = route.to;
        status = "redirect";
      } else {
        actualComponent = route.component;
        if (!expected) status = "no-expected";
        else if (route.component !== expected) status = "component-mismatch";
        else if (!lazyImport) status = "missing-lazy-import";
        else status = "ok";
      }
      return { sidebarPath: path, expectedComponent: expected, actualComponent, redirectTo, lazyImport, status };
    });

    const outDir = resolve(SRC_DIR, "../reports/admin-sidebar");
    mkdirSync(outDir, { recursive: true });
    const esc = (v: string | null) => {
      const s = v ?? "";
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["sidebarPath", "expectedComponent", "actualComponent", "redirectTo", "lazyImport", "status"];
    const csv = [
      header.join(","),
      ...rows.map((r) => header.map((h) => esc((r as Record<string, string | null>)[h])).join(",")),
    ].join("\n");
    writeFileSync(resolve(outDir, "wiring-report.csv"), csv + "\n", "utf8");
    writeFileSync(
      resolve(outDir, "wiring-report.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + "\n",
      "utf8",
    );
    // The report itself is informational; the assertions above already gate
    // the build. Sanity-check that we emitted a row per sidebar path.
    expect(rows.length).toBe(navPaths.length);
  });
});