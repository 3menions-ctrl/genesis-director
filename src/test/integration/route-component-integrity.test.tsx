/**
 * AUDIT Phase 2 — Route & interactive-element integrity (headless, static + module-load).
 *
 * Goal: satisfy "every defined route has a working component" and "no dead
 * links / empty handlers" without a full browser+backend E2E (which the sandbox
 * can't run reliably). We:
 *
 *   1. Parse src/App.tsx for every lazy(() => import(...)) route component and
 *      DYNAMICALLY IMPORT each one, asserting the expected binding (default or
 *      named) resolves to a renderable component. A broken import path or a
 *      missing/renamed export fails the specific route's test — giving per-route
 *      pass/fail. This exercises the real module graph for every page.
 *   2. Assert every static <Navigate to="..."> redirect target resolves to a
 *      defined <Route path> (no dead redirects).
 *   3. Scan all page/component TSX for unambiguous dead interactions
 *      (href="#", href="", onClick={() => {}}) and assert there are none.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Some page modules (e.g. Lobby → lottie-web) touch a 2D canvas context at
// module/render time. jsdom returns null from getContext, which crashes them.
// Install a permissive stub ONLY for this file (global setup must NOT, since
// other suites — e.g. videoLoading — assert the genuine no-canvas fallback).
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  const ctxStub = new Proxy(
    { canvas: null, measureText: () => ({ width: 0 }), createLinearGradient: () => ({ addColorStop: () => {} }) } as Record<string, unknown>,
    { get: (t, p) => (p in t ? t[p as string] : () => {}), set: () => true },
  );
  HTMLCanvasElement.prototype.getContext = (() => ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

const APP_TSX = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');

// Eager loader map for every module under src/ (Vite-native, resolves aliases).
const MODULES = import.meta.glob('/src/**/*.{ts,tsx}');

function normalizeImportPath(p: string): string {
  // App.tsx lives in src/, so both "@/X" and "./X" map to "/src/X".
  if (p.startsWith('@/')) return '/src/' + p.slice(2);
  if (p.startsWith('./')) return '/src/' + p.slice(2);
  if (p.startsWith('../')) return '/' + path.normalize('src/' + p).replace(/^\/?/, '');
  return p;
}

function resolveLoader(normalized: string): (() => Promise<any>) | null {
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const key = normalized + ext;
    if (MODULES[key]) return MODULES[key] as () => Promise<any>;
  }
  return null;
}

interface LazyRoute {
  varName: string;
  importPath: string;
  namedExport?: string;
}

function parseLazyRoutes(src: string): LazyRoute[] {
  const re =
    /const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)(?:\s*\.then\(\s*m\s*=>\s*\(\{\s*default:\s*m\.(\w+)\s*\}\)\s*\))?/g;
  const out: LazyRoute[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ varName: m[1], importPath: m[2], namedExport: m[3] });
  }
  return out;
}

const lazyRoutes = parseLazyRoutes(APP_TSX);

describe('Route component integrity (every lazy route loads + exports a component)', () => {
  it('parsed a meaningful number of lazy route components from App.tsx', () => {
    // Guard against a regex break silently passing the suite.
    expect(lazyRoutes.length).toBeGreaterThan(60);
  });

  for (const r of lazyRoutes) {
    it(`${r.varName} (${r.importPath}) imports and exports a component`, async () => {
      const normalized = normalizeImportPath(r.importPath);
      const loader = resolveLoader(normalized);
      expect(loader, `no module found for ${r.importPath} (normalized ${normalized})`).toBeTruthy();

      const mod = await loader!();
      const binding = r.namedExport ? mod[r.namedExport] : mod.default;
      expect(
        binding,
        `${r.importPath} is missing ${r.namedExport ? `named export "${r.namedExport}"` : 'a default export'}`,
      ).toBeDefined();
      // React components are functions, or objects (React.memo / forwardRef / lazy).
      expect(['function', 'object']).toContain(typeof binding);
    });
  }
});

describe('Redirect integrity (every static <Navigate to> resolves to a defined route)', () => {
  const routePaths = new Set(
    Array.from(APP_TSX.matchAll(/<Route\s+path="([^"]+)"/g)).map((m) => m[1]),
  );
  // Targets, stripped of query string; skip param/relative/placeholder targets.
  const navTargets = Array.from(APP_TSX.matchAll(/<Navigate\s+to="([^"]+)"/g))
    .map((m) => m[1].split('?')[0])
    .filter((t) => t && !t.includes(':') && t.startsWith('/') && t !== '/x');

  const unique = Array.from(new Set(navTargets));

  for (const target of unique) {
    it(`redirect target ${target} has a matching route`, () => {
      // A target matches if there's an exact route, or a parent route that
      // renders it (e.g. "/account" matches "/account" and nested handles tabs).
      const matched =
        routePaths.has(target) ||
        Array.from(routePaths).some((p) => {
          // normalize param segments to a wildcard for comparison
          const re = new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*') + '$');
          return re.test(target);
        });
      expect(matched, `redirect to ${target} has no matching <Route path>`).toBe(true);
    });
  }
});

describe('No dead interactive elements (static scan of src TSX)', () => {
  const tsxFiles = Object.keys(MODULES).filter((k) => k.endsWith('.tsx'));

  it('scanned a meaningful number of TSX files', () => {
    expect(tsxFiles.length).toBeGreaterThan(100);
  });

  it('has no anchors with href="#" or empty href, and no empty onClick handlers', () => {
    const offenders: string[] = [];
    for (const key of tsxFiles) {
      const abs = path.join(process.cwd(), key.replace(/^\//, ''));
      let src: string;
      try {
        src = fs.readFileSync(abs, 'utf-8');
      } catch {
        continue;
      }
      // Dead links: href="#" or href=""
      if (/href=["']#["']/.test(src) || /href=["']["']/.test(src)) {
        offenders.push(`${key}: dead href (# or empty)`);
      }
      // Empty inline handlers: onClick={() => {}} or onClick={()=>{}}
      if (/onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(src)) {
        offenders.push(`${key}: empty onClick handler`);
      }
    }
    expect(offenders, `dead interactive elements found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
