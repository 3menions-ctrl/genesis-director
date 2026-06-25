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
//     - `smallbridges.co` / `*.smallbridges.co`
//   * Otherwise fall back to the provided default.
// ──────────────────────────────────────────────────────────────────────

function envSiteOrigin(): string | null {
  const u = Deno.env.get("PUBLIC_SITE_URL");
  if (!u) return null;
  try { return new URL(u).origin; } catch { return null; }
}

// Wildcard self-serve hosting domains (Lovable / Cloudflare Pages / Vercel)
// are convenient for preview deployments, but anyone can stand up a site on
// them — so allowing them in production turns the return-url allowlist into an
// open redirect off the payment flows. We therefore ONLY permit these preview
// wildcards in non-production deploys.
//
// A deploy is treated as production when:
//   * PUBLIC_SITE_URL points at the canonical smallbridges.co domain, OR
//   * neither an explicit `ALLOW_PREVIEW_REDIRECTS` flag nor a non-prod
//     ENVIRONMENT / DENO_ENV is set.
// In production the allowlist collapses to smallbridges.co + *.smallbridges.co
// (+ the request/site origin, handled by the caller).
function previewRedirectsAllowed(): boolean {
  // Explicit opt-in always wins (useful for staging/QA on hosting wildcards).
  const flag = (Deno.env.get("ALLOW_PREVIEW_REDIRECTS") || "").toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;

  const envName = (
    Deno.env.get("ENVIRONMENT") ||
    Deno.env.get("DENO_ENV") ||
    ""
  ).toLowerCase();
  if (envName) {
    // Any explicitly non-production environment may use preview wildcards.
    return envName !== "production" && envName !== "prod";
  }

  // No explicit signal: infer from the canonical site URL. If it points at
  // the production domain, treat this as production (no preview wildcards).
  const site = (Deno.env.get("PUBLIC_SITE_URL") || "").toLowerCase();
  if (site.includes("smallbridges.co")) return false;

  // Default safe: when we can't prove we're non-prod, deny preview wildcards.
  return false;
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
    "smallbridges.co",
    "*.smallbridges.co",
  ];

  // Self-serve hosting wildcards are an open-redirect risk; only allow them
  // outside production (see previewRedirectsAllowed above).
  if (previewRedirectsAllowed()) {
    allowedHosts.push(
      "*.lovable.app",       // preview / staging domains
      "*.pages.dev",         // Cloudflare Pages preview
      "*.vercel.app",        // (in case of dual-deploy during migration)
    );
  }

  if (
    (reqOrigin && u.origin === reqOrigin) ||
    (siteOrigin && u.origin === siteOrigin) ||
    hostAllowed(u.hostname, allowedHosts)
  ) {
    return u.toString();
  }

  return opts.fallback;
}
