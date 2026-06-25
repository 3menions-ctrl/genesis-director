import { describe, it, expect, vi } from "vitest";
import {
  computeWindowBucket,
  extractClientIp,
  requiredScopeForRequest,
  hasScope,
  checkRateLimitDb,
} from "../../../supabase/functions/_shared/rate-limiter.ts";

/**
 * Security contract tests for the DB-backed rate limiter helpers.
 *
 * These cover the PURE pieces of logic the abuse/denial-of-wallet fixes
 * depend on:
 *   - window-bucket computation (mirrors the SQL floor() bucketing)
 *   - client-IP extraction precedence (cf-connecting-ip > x-forwarded-for)
 *   - api-v1 scope predicates
 *   - checkRateLimitDb fail-open/fail-closed behaviour (RPC mocked)
 *
 * Everything is deterministic and dependency-free — the Supabase client is
 * a hand-rolled stub, no network/Deno runtime required.
 */

// Minimal Headers-like stub.
function headers(map: Record<string, string>) {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(map)) lower[k.toLowerCase()] = map[k];
  return { get: (name: string): string | null => lower[name.toLowerCase()] ?? null };
}

describe("computeWindowBucket", () => {
  it("floors to the start of the window (seconds)", () => {
    // 1_000_000_123 ms -> 1_000_000 s; window 60 -> floor(1000000/60)*60
    const expected = Math.floor(1_000_000 / 60) * 60;
    expect(computeWindowBucket(1_000_000_123, 60)).toBe(expected);
  });

  it("is stable for timestamps within the same window", () => {
    const a = computeWindowBucket(1_700_000_000_000, 3600);
    const b = computeWindowBucket(1_700_000_000_000 + 59_000, 3600);
    expect(a).toBe(b);
  });

  it("advances to the next bucket once the window elapses", () => {
    const base = 1_700_000_000_000;
    const a = computeWindowBucket(base, 60);
    const b = computeWindowBucket(base + 60_000, 60);
    expect(b).toBe(a + 60);
  });

  it("guards against a zero/invalid window (treats as 1s)", () => {
    expect(computeWindowBucket(5_000, 0)).toBe(5);
  });
});

describe("extractClientIp", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const h = headers({
      "cf-connecting-ip": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    });
    expect(extractClientIp(h)).toBe("9.9.9.9");
  });

  it("falls back to the LEFTMOST x-forwarded-for hop", () => {
    const h = headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(extractClientIp(h)).toBe("1.1.1.1");
  });

  it("trims whitespace around the leftmost hop", () => {
    const h = headers({ "x-forwarded-for": "  4.4.4.4 , 5.5.5.5" });
    expect(extractClientIp(h)).toBe("4.4.4.4");
  });

  it("ignores a blank cf-connecting-ip and uses x-forwarded-for", () => {
    const h = headers({ "cf-connecting-ip": "   ", "x-forwarded-for": "7.7.7.7" });
    expect(extractClientIp(h)).toBe("7.7.7.7");
  });

  it("uses the provided fallback when no trusted header is present", () => {
    expect(extractClientIp(headers({}), "unknown")).toBe("unknown");
    expect(extractClientIp(headers({}))).toBe("0.0.0.0");
  });
});

describe("requiredScopeForRequest / hasScope", () => {
  it("maps GET to read and POST to generate", () => {
    expect(requiredScopeForRequest("GET")).toBe("read");
    expect(requiredScopeForRequest("get")).toBe("read");
    expect(requiredScopeForRequest("POST")).toBe("generate");
    expect(requiredScopeForRequest("DELETE")).toBe("generate");
  });

  it("hasScope is true only when the scope is granted", () => {
    expect(hasScope(["read", "generate"], "read")).toBe(true);
    expect(hasScope(["read"], "generate")).toBe(false);
    expect(hasScope([], "read")).toBe(false);
    expect(hasScope(null, "read")).toBe(false);
    expect(hasScope(undefined, "generate")).toBe(false);
  });

  it("read-only key is denied a POST (generate) endpoint", () => {
    const scopes = ["read"];
    expect(hasScope(scopes, requiredScopeForRequest("POST"))).toBe(false);
    expect(hasScope(scopes, requiredScopeForRequest("GET"))).toBe(true);
  });
});

describe("checkRateLimitDb", () => {
  function clientReturning(result: { data: unknown; error: unknown }) {
    return { rpc: vi.fn().mockResolvedValue(result) };
  }

  it("returns true (allowed) when the RPC returns true", async () => {
    const client = clientReturning({ data: true, error: null });
    await expect(checkRateLimitDb(client, "k", 10, 60)).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_key: "k",
      p_limit: 10,
      p_window_seconds: 60,
    });
  });

  it("returns false (limited) when the RPC returns false", async () => {
    const client = clientReturning({ data: false, error: null });
    await expect(checkRateLimitDb(client, "k", 10, 60)).resolves.toBe(false);
  });

  it("FAILS CLOSED by default on RPC error", async () => {
    const client = clientReturning({ data: null, error: { message: "boom" } });
    await expect(checkRateLimitDb(client, "k", 10, 60)).resolves.toBe(false);
  });

  it("FAILS OPEN only when explicitly requested", async () => {
    const client = clientReturning({ data: null, error: { message: "boom" } });
    await expect(checkRateLimitDb(client, "k", 10, 60, true)).resolves.toBe(true);
  });

  it("fails closed when the RPC throws", async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error("network")) };
    await expect(checkRateLimitDb(client, "k", 10, 60)).resolves.toBe(false);
  });
});
