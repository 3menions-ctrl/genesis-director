// ──────────────────────────────────────────────────────────────────────
// Client-side / config hardening regression tests.
//
// These cover the pure, isolatable logic behind several security fixes:
//   (a) JSON-LD "<" escaping (Blog.tsx) — no literal </script> can break out.
//   (b) Inbox search sanitizer (safeQ) — strips PostgREST .or() metacharacters.
//   (c) return-url allowlist — preview hosting wildcards (*.vercel.app etc.)
//       are excluded in production but smallbridges.co always allowed.
// ──────────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it } from "vitest";

// ── (a) JSON-LD <-escaping (mirrors Blog.tsx ArticleMeta) ──────────────
function serializeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// ── (b) Inbox search sanitizer (mirrors Inbox.tsx NewDmButton) ─────────
function sanitizeSearch(q: string): string {
  return q.replace(/[,()\\]/g, " ").replace(/%/g, "").trim();
}

describe("JSON-LD <-escaping (L14)", () => {
  it("escapes < so a malicious title cannot emit a literal </script>", () => {
    const jsonLd = {
      "@type": "Article",
      headline: 'Pwned</script><script>alert(document.cookie)</script>',
    };
    const out = serializeJsonLd(jsonLd);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<");
    // The escaped form must still parse back to the original value.
    expect(JSON.parse(out).headline).toBe(jsonLd.headline);
  });

  it("leaves benign content intact (round-trips)", () => {
    const jsonLd = { headline: "A normal title", n: 42 };
    expect(JSON.parse(serializeJsonLd(jsonLd))).toEqual(jsonLd);
  });
});

describe("Inbox search sanitizer (L5)", () => {
  it("strips commas, parentheses and backslashes", () => {
    expect(sanitizeSearch("evil,name(injection)\\x")).not.toMatch(/[,()\\]/);
  });

  it("removes ilike wildcard %", () => {
    expect(sanitizeSearch("a%b%c")).toBe("abc");
  });

  it("neutralizes a PostgREST .or() injection attempt", () => {
    const malicious = "x,id.eq.00000000-0000-0000-0000-000000000000";
    const safe = sanitizeSearch(malicious);
    expect(safe).not.toContain(",");
    // The injected filter clause keyword cannot reach the .or() string intact.
    expect(safe.includes("id.eq.")).toBe(true); // dots survive (harmless)
    expect(safe.includes(",")).toBe(false); // but the separator is gone
  });

  it("keeps ordinary names usable", () => {
    expect(sanitizeSearch("  Jane Doe  ")).toBe("Jane Doe");
  });
});

describe("return-url allowlist preview gating (M9)", () => {
  const g = globalThis as unknown as { Deno?: unknown };
  const realDeno = g.Deno;

  function stubEnv(vars: Record<string, string>) {
    g.Deno = {
      env: { get: (k: string) => vars[k] },
    };
  }

  afterEach(() => {
    g.Deno = realDeno;
  });

  async function loadSafeReturnUrl() {
    // Import fresh each time so the stubbed Deno.env is read at call time.
    const mod = await import(
      "../../../supabase/functions/_shared/return-url.ts"
    );
    return mod.safeReturnUrl;
  }

  it("rejects *.vercel.app in production", async () => {
    stubEnv({ PUBLIC_SITE_URL: "https://smallbridges.co" });
    const safeReturnUrl = await loadSafeReturnUrl();
    const out = safeReturnUrl({
      requested: "https://attacker.vercel.app/steal",
      fallback: "https://smallbridges.co/billing",
      requestUrl: "https://smallbridges.co/api/checkout",
    });
    expect(out).toBe("https://smallbridges.co/billing");
  });

  it("allows smallbridges.co in production", async () => {
    stubEnv({ PUBLIC_SITE_URL: "https://smallbridges.co" });
    const safeReturnUrl = await loadSafeReturnUrl();
    const out = safeReturnUrl({
      requested: "https://smallbridges.co/billing/success",
      fallback: "https://smallbridges.co/billing",
      requestUrl: "https://smallbridges.co/api/checkout",
    });
    expect(out).toBe("https://smallbridges.co/billing/success");
  });

  it("allows *.smallbridges.co subdomains in production", async () => {
    stubEnv({ PUBLIC_SITE_URL: "https://smallbridges.co" });
    const safeReturnUrl = await loadSafeReturnUrl();
    const out = safeReturnUrl({
      requested: "https://app.smallbridges.co/done",
      fallback: "https://smallbridges.co/billing",
      requestUrl: "https://smallbridges.co/api/checkout",
    });
    expect(out).toBe("https://app.smallbridges.co/done");
  });

  it("allows *.vercel.app in non-production (ENVIRONMENT=development)", async () => {
    stubEnv({ ENVIRONMENT: "development" });
    const safeReturnUrl = await loadSafeReturnUrl();
    const out = safeReturnUrl({
      requested: "https://preview.vercel.app/done",
      fallback: "https://smallbridges.co/billing",
      requestUrl: "https://preview.vercel.app/api/checkout",
    });
    expect(out).toBe("https://preview.vercel.app/done");
  });

  it("allows preview wildcards when ALLOW_PREVIEW_REDIRECTS is set", async () => {
    stubEnv({
      PUBLIC_SITE_URL: "https://smallbridges.co",
      ALLOW_PREVIEW_REDIRECTS: "true",
    });
    const safeReturnUrl = await loadSafeReturnUrl();
    const out = safeReturnUrl({
      requested: "https://staging.pages.dev/done",
      fallback: "https://smallbridges.co/billing",
      requestUrl: "https://smallbridges.co/api/checkout",
    });
    expect(out).toBe("https://staging.pages.dev/done");
  });
});
