// ──────────────────────────────────────────────────────────────────────
// Safe return-URL helper for Stripe Checkout / Portal endpoints.
//
// Stripe redirects the user to `return_url` after a session completes.
// If we let the client pass any URL, an attacker can craft a checkout
// link whose return_url points at evil.com — Stripe will dutifully send
// the legitimate user there with their session cookies. Classic
// open-redirect, with a respectable host (stripe.com) in the path.
//
// Policy:
//   * `returnUrl` must parse as a URL.
//   * Its origin must match one of:
//     - the calling request's origin (current frontend)
//     - any host in PUBLIC_SITE_URL env (canonical domain)
//     - `smallbridges.com` / `*.smallbridges.com`
//   * Otherwise fall back to the provided default.
// ──────────────────────────────────────────────────────────────────────

function envSiteOrigin(): string | null {
  const u = Deno.env.get("PUBLIC_SITE_URL");
  if (!u) return null;
  try { return new URL(u).origin; } catch { return null; }
}

function hostAllowed(host: string, allow: string[]): boolean {
  return allow.some((p) => {
    if (p === host) return true;
    if (p.startsWith("*.")) {
      const tail = p.slice(2);
      return host === tail || host.endsWith("." + tail);
    }
    return false;
  });
}

export function safeReturnUrl(opts: {
  requested?: string | null;
  fallback: string;
  requestUrl: string;
}): string {
  if (!opts.requested) return opts.fallback;
  let u: URL;
  try { u = new URL(opts.requested); } catch { return opts.fallback; }

  if (u.protocol !== "https:" && u.protocol !== "http:") return opts.fallback;

  const reqOrigin = (() => {
    try { return new URL(opts.requestUrl).origin; } catch { return null; }
  })();
  const siteOrigin = envSiteOrigin();

  const allowedHosts = [
    "smallbridges.com",
    "*.smallbridges.com",
    "*.lovable.app",       // preview / staging domains
    "*.pages.dev",         // Cloudflare Pages preview
    "*.vercel.app",        // (in case of dual-deploy during migration)
  ];

  if (
    (reqOrigin && u.origin === reqOrigin) ||
    (siteOrigin && u.origin === siteOrigin) ||
    hostAllowed(u.hostname, allowedHosts)
  ) {
    return u.toString();
  }

  return opts.fallback;
}
