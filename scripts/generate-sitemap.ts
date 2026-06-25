// Auto-generates public/sitemap.xml from public routes in src/App.tsx.
// Runs before `vite dev` and `vite build` via predev/prebuild hooks.
//
// HOW IT WORKS
// 1. The curated list below carries SEO metadata (priority/changefreq) for
//    pages where ranking matters. Edit this for tuning.
// 2. Anything not in the curated list is auto-discovered from App.tsx using
//    a static-source scan, so new public routes can never silently miss the
//    sitemap. Dynamic params, redirects, admin, and protected routes are
//    filtered out automatically.

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://smallbridges.co";
const today = new Date().toISOString().slice(0, 10);

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// ── Curated SEO config ──────────────────────────────────────────────────
// These get explicit priority/changefreq. Auto-discovered routes use
// sensible defaults (priority 0.5, monthly) so they appear without
// requiring a manual touch here.
const curated: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.9" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.8" },
  { path: "/auth", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/enterprise/coming-soon", changefreq: "monthly", priority: "0.7" },
  { path: "/gallery", changefreq: "daily", priority: "0.7" },
  { path: "/mascots", changefreq: "monthly", priority: "0.6" },
  { path: "/developers", changefreq: "monthly", priority: "0.6" },
  { path: "/help", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/press", changefreq: "monthly", priority: "0.5" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/forgot-password", changefreq: "yearly", priority: "0.2" },
];

// Mirror of public/robots.txt Disallow. A route we ask crawlers NOT to index
// must never appear in the sitemap — listing both sends mixed signals and
// wastes crawl budget. Matches an exact path or any sub-path beneath it.
const DISALLOWED = [
  "/admin", "/workspace", "/settings", "/profile", "/notifications",
  "/credits", "/onboarding", "/start", "/welcome", "/production",
  "/script-review", "/training-video", "/loft", "/editor", "/create",
  "/director", "/avatars", "/avatars-gallery", "/environments", "/templates",
  "/projects", "/invite", "/widget", "/w", "/mockup", "/reset-password",
  "/unsubscribe",
];
function isDisallowed(path: string): boolean {
  return DISALLOWED.some((p) => path === p || path.startsWith(p + "/"));
}

// ── Route discovery from App.tsx ────────────────────────────────────────
function discoverPublicRoutes(): string[] {
  const appSource = readFileSync(resolve("src/App.tsx"), "utf8");

  // Walk every <Route ...> opening tag and capture (path, attrsAndBody until
  // the matching close or self-close). Lazy multiline-safe.
  const openTagRegex = /<Route\b([^>]*?)(\/)?>/g;
  const found = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = openTagRegex.exec(appSource)) !== null) {
    const attrs = m[1];
    const selfClosing = !!m[2];
    const pathMatch = attrs.match(/\bpath=["']([^"']+)["']/);
    if (!pathMatch) continue;
    const path = pathMatch[1].trim();

    // Quick path-shape filters.
    if (!path.startsWith("/")) continue; // relative paths = nested-route children (admin tree)
    if (path.startsWith("/admin")) continue;
    if (path.includes(":")) continue;
    if (path.includes("*")) continue;
    if (isDisallowed(path)) continue; // honor robots.txt Disallow
    if (path.startsWith("/widget")) continue;
    if (path.startsWith("/w/")) continue;
    // Auth callback / password reset / mockup-preview are not SEO surfaces.
    if (path.startsWith("/auth/")) continue;
    if (path === "/reset-password") continue;
    if (path === "/unsubscribe") continue;
    if (path === "/mockup") continue;
    if (path === "/welcome/checkout") continue;
    if (path === "/start") continue;
    if (path === "/onboarding") continue;
    if (path === "/notifications") continue;

    // Look at the body of THIS route only — slice from this Route opening
    // up to the next `<Route` (word-bounded so we don't catch RouteContainer)
    // sibling so we don't borrow the wrapping of an adjacent route.
    const nextRouteRegex = /<Route(?:\s|\/|>)/g;
    nextRouteRegex.lastIndex = m.index + 6;
    const nextMatch = nextRouteRegex.exec(appSource);
    const nextRouteIdx = nextMatch ? nextMatch.index : -1;
    const body = appSource.slice(
      m.index,
      nextRouteIdx === -1 ? m.index + 1500 : nextRouteIdx,
    );
    if (/<Navigate\b/.test(body)) continue;
    if (/ProtectedRoute|RequireAccountType|EnterpriseGate/.test(body)) continue;

    found.add(path);
  }

  return [...found].sort();
}

// ── Merge ──────────────────────────────────────────────────────────────
function build(): SitemapEntry[] {
  const byPath = new Map<string, SitemapEntry>();
  for (const c of curated) byPath.set(c.path, { ...c, lastmod: today });

  for (const path of discoverPublicRoutes()) {
    if (byPath.has(path)) continue;
    byPath.set(path, {
      path,
      lastmod: today,
      changefreq: "monthly",
      priority: "0.5",
    });
  }
  return [...byPath.values()].sort((a, b) =>
    Number(b.priority ?? 0) - Number(a.priority ?? 0) || a.path.localeCompare(b.path),
  );
}

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

const entries = build();
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(
  `sitemap.xml written (${entries.length} entries; ` +
    `${curated.length} curated + ${entries.length - curated.length} auto-discovered)`,
);
