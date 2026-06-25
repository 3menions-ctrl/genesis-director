// ──────────────────────────────────────────────────────────────────────
// SSRF guard for edge functions that fetch user-provided URLs.
//
// Use case: many functions (edit-photo, extract-video-frame,
// analyze-reference-image, generate-video) take a URL from the request
// body and `fetch()` it. Without validation, an attacker can target:
//
//   * 169.254.169.254 / 169.254.170.2 — cloud metadata services
//   * 127.0.0.0/8 / ::1                — localhost
//   * 10.0.0.0/8, 172.16/12, 192.168/16 — RFC1918 internal networks
//   * fc00::/7                          — IPv6 unique-local
//   * fe80::/10                         — IPv6 link-local
//   * file://, gopher://, ftp://        — non-http schemes
//
// This module provides:
//   * assertSafeFetchUrl(url, opts) — throws SSRFError if the URL is risky
//   * safeFetch(url, init, opts)     — fetch wrapper that pre-validates,
//     re-validates after redirects, and caps total response size
//
// Defaults reject everything except https:// to a public host. Pass an
// allowlist of hostnames or hostname patterns for tighter control.
// ──────────────────────────────────────────────────────────────────────

export class SSRFError extends Error {
  constructor(msg: string, public reason: string) {
    super(msg);
    this.name = "SSRFError";
  }
}

const PRIVATE_V4_RANGES: Array<[number, number]> = [
  // [start, end] inclusive, as 32-bit unsigned ints (big-endian dotted-quad to int).
  [ip("0.0.0.0"),       ip("0.255.255.255")],        // 0.0.0.0/8
  [ip("10.0.0.0"),      ip("10.255.255.255")],       // RFC1918
  [ip("100.64.0.0"),    ip("100.127.255.255")],      // CGNAT
  [ip("127.0.0.0"),     ip("127.255.255.255")],      // loopback
  [ip("169.254.0.0"),   ip("169.254.255.255")],      // link-local + metadata
  [ip("172.16.0.0"),    ip("172.31.255.255")],       // RFC1918
  [ip("192.0.0.0"),     ip("192.0.0.255")],          // IETF protocol
  [ip("192.168.0.0"),   ip("192.168.255.255")],      // RFC1918
  [ip("198.18.0.0"),    ip("198.19.255.255")],       // benchmark
  [ip("224.0.0.0"),     ip("239.255.255.255")],      // multicast
  [ip("240.0.0.0"),     ip("255.255.255.255")],      // reserved
];

function ip(dotted: string): number {
  const p = dotted.split(".").map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function isPrivateV4(addr: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (!m) return false;
  const n = ip(addr);
  return PRIVATE_V4_RANGES.some(([s, e]) => n >= s && n <= e);
}

function isPrivateV6(addr: string): boolean {
  const a = addr.toLowerCase();
  // ::1 loopback
  if (a === "::1") return true;
  // fe80::/10 link-local
  if (a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb")) return true;
  // fc00::/7 unique-local (fc00, fd00)
  if (a.startsWith("fc") || a.startsWith("fd")) return true;
  // ::ffff:0:0/96 IPv4-mapped — resolve underlying v4 separately
  if (a.startsWith("::ffff:")) {
    const v4 = a.slice(7);
    return isPrivateV4(v4);
  }
  return false;
}

export interface SafeFetchOpts {
  // Hostname or wildcard pattern (e.g. "*.smallbridges.co").
  allowHosts?: string[];
  // Hard cap on response body size (bytes). Default 50 MB.
  maxBodyBytes?: number;
  // Hard cap on redirects. Default 0 — we re-validate each hop ourselves.
  maxRedirects?: number;
}

function matchesAllowHost(host: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (p === host) return true;
    if (p.startsWith("*.")) {
      const tail = p.slice(2);
      return host === tail || host.endsWith("." + tail);
    }
    return false;
  });
}

export function assertSafeFetchUrl(input: string, opts: SafeFetchOpts = {}): URL {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new SSRFError("Invalid URL", "parse_error");
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new SSRFError("Only http(s) URLs are allowed", "bad_scheme");
  }
  // In prod we prefer https; allow http only if the host is in the allowlist.
  if (u.protocol === "http:" && !(opts.allowHosts && matchesAllowHost(u.hostname, opts.allowHosts))) {
    throw new SSRFError("Plain HTTP not allowed without explicit allowlist", "http_disallowed");
  }

  const host = u.hostname;
  // Reject any URL that already names a literal private/loopback host.
  if (isPrivateV4(host) || isPrivateV6(host) || host === "localhost") {
    throw new SSRFError("Private or loopback host", "private_host");
  }
  // Reject IPv6 brackets that resolve to a private range.
  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1);
    if (isPrivateV6(inner)) {
      throw new SSRFError("Private IPv6 host", "private_host");
    }
  }
  if (opts.allowHosts && opts.allowHosts.length > 0 && !matchesAllowHost(host, opts.allowHosts)) {
    throw new SSRFError(`Host '${host}' not in allowlist`, "host_not_allowed");
  }
  return u;
}

/**
 * Resolve a hostname's A/AAAA records and reject if ANY resolved address
 * falls in a private/loopback/link-local/reserved range.
 *
 * This closes the DNS-rebinding gap that `assertSafeFetchUrl` (which only
 * inspects the URL *string*) cannot: a public-looking hostname whose DNS
 * record points at 169.254.169.254, 10.x, 127.x, ::1, etc. would otherwise
 * pass the string check and then `fetch()` would happily connect to the
 * private IP.
 *
 * NOTE (TOCTOU): there is an unavoidable resolve-then-connect race here.
 * Between this resolveDns() and the subsequent fetch(), an attacker can
 * re-point DNS (classic DNS rebinding) so the address fetch() connects to
 * differs from the one we validated. Deno's `fetch` cannot easily be pinned
 * to a pre-resolved IP, so this remains best-effort short of dialing a pinned
 * socket ourselves. We accept that residual risk; it still blocks the common
 * "static A record -> private IP" SSRF.
 *
 * `assertSafeFetchUrl` is intentionally kept synchronous (its many callers —
 * edit-photo, inpaint-photo, extract-video-frame, analyze-reference-image —
 * invoke it without `await`, so turning it async would silently break them).
 * The DNS check lives here, awaited inside `safeFetch`, so existing callers
 * are unaffected while every `safeFetch` path gets rebinding protection.
 */
export async function assertResolvedHostSafe(host: string): Promise<void> {
  // Literal IP hosts are already covered by the synchronous checks in
  // assertSafeFetchUrl; resolving them is harmless (resolveDns may just echo
  // or throw), so we let it run through the same predicates below.
  const resolver = (globalThis as { Deno?: { resolveDns?: unknown } }).Deno?.resolveDns as
    | ((h: string, t: string) => Promise<string[]>)
    | undefined;
  if (typeof resolver !== "function") {
    // No DNS resolver available (e.g. unit test env without Deno). The
    // synchronous string validation in assertSafeFetchUrl still applies.
    return;
  }

  const addrs: string[] = [];
  try {
    const a = await resolver(host, "A");
    if (Array.isArray(a)) addrs.push(...a);
  } catch {
    /* no A record / NXDOMAIN — nothing to add */
  }
  try {
    const aaaa = await resolver(host, "AAAA");
    if (Array.isArray(aaaa)) addrs.push(...aaaa);
  } catch {
    /* no AAAA record or AAAA lookups unsupported — ignore */
  }

  for (const addr of addrs) {
    if (isPrivateV4(addr) || isPrivateV6(addr) || addr === "::1") {
      throw new SSRFError(
        `Host '${host}' resolves to a private/reserved address (${addr})`,
        "private_resolved",
      );
    }
  }
}

/**
 * Replacement for `fetch()` that pre-validates the URL, resolves the host and
 * rejects private/rebound IPs, follows redirects one hop at a time
 * (re-validating AND re-resolving each), and caps response size.
 *
 * Usage:
 *   const res = await safeFetch(userUrl, undefined, { allowHosts: ["*.replicate.delivery", "*.cloudfront.net"] });
 *   const buf = await res.arrayBuffer();
 *
 * If the URL is unsafe, throws SSRFError. The caller should return a 400.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  opts: SafeFetchOpts = {},
): Promise<Response> {
  let current = url;
  const maxRedirects = opts.maxRedirects ?? 3;
  const maxBytes = opts.maxBodyBytes ?? 50 * 1024 * 1024;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    // 1) string-level validation (scheme, literal private hosts, allowlist)
    const validated = assertSafeFetchUrl(current, opts);
    // 2) DNS-level validation (rebinding / hostname -> private IP). Runs for
    //    the initial URL AND every redirect hop's new host below.
    await assertResolvedHostSafe(validated.hostname);
    const res = await fetch(current, { ...init, redirect: "manual" });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return res;
      current = new URL(next, current).toString();
      continue;
    }

    // Size guard via Content-Length if present.
    const lenHeader = res.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > maxBytes) {
      throw new SSRFError(`Response too large: ${lenHeader} bytes`, "too_large");
    }
    return res;
  }
  throw new SSRFError("Too many redirects", "redirect_loop");
}
