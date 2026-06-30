/**
 * URL durability helpers — PURE (no external imports) so both Deno edge
 * functions and the vitest test suite can import them.
 *
 * An "expiring" URL must NEVER be stored as a project's canonical `video_url`
 * (or any field a user opens later): it 404s once it expires. This covers:
 *   - Replicate delivery URLs (`replicate.delivery`) — expire ~24h.
 *   - Supabase *signed* storage URLs (`/storage/v1/object/sign/...?token=…`) —
 *     expire at whatever TTL the signer chose. The stitcher mints a 24h signed
 *     URL into the private `published-renders` bucket, so every finished film
 *     died ~24h after render (QA audit P0-1, the "final-film 24h URL bug").
 *
 * Supabase *public* URLs (`/storage/v1/object/public/...`) are durable and MUST
 * return false — re-persisting them would be wasteful and could loop.
 */

/** True when the URL will expire and so must not be stored as a durable reference. */
export function isExpiringUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Replicate's CDN delivery links are short-lived.
  if (url.includes("replicate.delivery")) return true;
  // Supabase signed object URLs are token-gated and time-limited. Public object
  // URLs use `/object/public/` (no token) and are intentionally NOT matched.
  if (url.includes("/storage/v1/object/sign/")) return true;
  return false;
}

/**
 * Back-compat alias. Existing call sites import `isTemporaryReplicateUrl`; the
 * name now means "is this URL temporary/expiring" (Replicate delivery OR a
 * Supabase signed URL), not just Replicate.
 */
export const isTemporaryReplicateUrl = isExpiringUrl;
