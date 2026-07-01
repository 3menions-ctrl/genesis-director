// Central allowlist for routes viewable WITHOUT authentication.
//
// The app is "gated by default": every route is behind login UNLESS its path
// matches an entry here. This list is the single source of truth — see
// <GatedRoutes> (src/components/auth/GatedRoutes.tsx), which wraps the whole
// router. A newly-added app route therefore cannot leak by forgetting a
// per-route <ProtectedRoute>; it is gated automatically.
//
// ⚠️ Keep this list TIGHT. Only the public landing page + marketing / legal /
// auth surfaces belong here. Adding an app surface here punches a hole in the
// gate and exposes user-facing pages to logged-out visitors.

/** Exact-match public paths. */
const PUBLIC_EXACT: ReadonlySet<string> = new Set<string>([
  // ── Landing ────────────────────────────────────────────────
  "/", // landing (Cinema)
  "/cinema", // legacy → /

  // ── Auth flow (must be reachable while logged out) ─────────
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/start", // legacy → /auth?mode=signup

  // ── Marketing / signup funnel ──────────────────────────────
  "/pricing",
  "/how-it-works",
  "/business/start", // business signup form
  "/enterprise",
  "/enterprise/onboarding",
  "/enterprise/coming-soon",

  // ── Marketing demos / showcase (no user data) ──────────────
  "/studio-showcase",
  "/breakthrough-lab",
  "/films",
  "/pipeline-preview",
  "/editor/demo", // synthetic buildDemoProject() sandbox — no Supabase/auth/user data; CI + E2E editor entrypoint. Exact match keeps real /editor/:id gated.

  // ── Content marketing / support ────────────────────────────
  "/blog",
  "/press",
  "/help",
  "/help-center",

  // ── Legal / transactional ──────────────────────────────────
  "/terms",
  "/privacy",
  "/contact",
  "/unsubscribe",
]);

/** Any path under one of these prefixes is public (covers sub-routes). */
const PUBLIC_PREFIXES: readonly string[] = [
  "/auth/", // /auth/callback
  "/blog/", // /blog/:slug
  "/help/", // /help/:slug
  "/enterprise/", // /enterprise/*
  "/invite/", // /invite/:token — invite links must open while logged out
  // /r/:id — shared reels open without login so a shared link can pull in new
  // visitors (the growth loop). This is SAFE despite the "keep it tight" rule
  // above because it exposes NO private data: the reel query runs under the
  // anon RLS policy, which returns a row ONLY when the project is_public=true
  // (or has a live, non-taken-down published_reels copy). A logged-out visitor
  // hitting a private reel id gets an empty result → the "private" error state.
  // Reel.tsx renders a stripped, read-only view + signup CTA for anon.
  "/r/",
];

function normalize(pathname: string): string {
  // Strip trailing slash(es) so "/pricing/" matches "/pricing". Keep root "/".
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * True when `pathname` may be viewed without authentication.
 * Everything else is gated behind login.
 */
export function isPublicPath(pathname: string): boolean {
  const path = normalize(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}
