/**
 * Deep-link / notification-tap path resolution — shared, validated, and the ONLY
 * thing allowed to turn external/server-controlled input into a router path.
 *
 * Both the Capacitor deep-link handler (NativeShell) and the push-notification
 * tap handler (push.ts) route the user to a path that originates OUTSIDE the app
 * (a URL the OS hands us, or a payload field the backend sends). Funnelling both
 * through here guarantees the same guarantees in both places:
 *   • scheme allowlist — javascript:/data:/file:/etc. can never reach navigate()
 *   • custom-scheme path reassembly (smallbridges://u/123 → /u/123, not /123)
 *   • only ever return a same-app absolute path ("/…"), never an external URL
 */

/** Map a deep-link URL (custom scheme or Universal Link) to an in-app path. */
export function deepLinkToPath(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Scheme allowlist — only our custom scheme + http(s) Universal Links. Rejects
  // javascript:/data:/file:/etc. so a hostile link can't reach navigate().
  if (!['smallbridges:', 'https:', 'http:'].includes(url.protocol)) return null;

  // Supabase auth redirect — keep the hash/query, route to the callback page.
  const looksLikeAuth =
    url.host === 'auth' ||
    url.pathname.includes('auth') ||
    /access_token|refresh_token|error_description|code=/.test(url.hash + url.search);
  if (looksLikeAuth) {
    return `/auth/callback${url.search}${url.hash}`;
  }

  // CAUTION: for the custom scheme, smallbridges://u/123 parses "u" as the HOST
  // and "/123" as the pathname — so url.pathname alone DROPS the first segment.
  // Reassemble host+pathname for custom-scheme links; Universal Links keep using
  // pathname (their host is the domain).
  const isUniversalLink = url.protocol === 'https:' || url.protocol === 'http:';
  const base = isUniversalLink ? url.pathname : `/${url.host}${url.pathname}`;
  const path = `${base}${url.search}${url.hash}`.replace(/\/{2,}/g, '/');

  if (!path.startsWith('/')) return '/feed';
  return path !== '/' ? path : '/feed';
}

/**
 * Resolve a server-controlled value (a push-notification payload field) to a
 * safe in-app path, or null if it isn't one. Accepts either a bare path
 * ("/u/123") or a full deep-link URL ("smallbridges://u/123"); rejects external
 * URLs, hostile schemes, and protocol-relative ("//evil.com") values.
 */
export function safeInAppPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  // A full URL (has a scheme) → run it through the validated deep-link resolver.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return deepLinkToPath(v);
  // A bare path: must be a same-app absolute path, NOT protocol-relative.
  if (v.startsWith('/') && !v.startsWith('//')) return v.replace(/\/{2,}/g, '/');
  return null;
}
