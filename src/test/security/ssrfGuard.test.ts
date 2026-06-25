import { describe, it, expect, afterEach, vi } from "vitest";
import {
  assertSafeFetchUrl,
  assertResolvedHostSafe,
  SSRFError,
} from "../../../supabase/functions/_shared/ssrf-guard.ts";

// The synchronous string-validation path (assertSafeFetchUrl) does NOT touch
// DNS, so it is testable without a real resolver. We still stub a permissive
// Deno.resolveDns so the async DNS-aware path can be exercised deterministically
// (real DNS resolution cannot run in a unit test).
const originalDeno = (globalThis as { Deno?: unknown }).Deno;

afterEach(() => {
  (globalThis as { Deno?: unknown }).Deno = originalDeno;
  vi.restoreAllMocks();
});

describe("assertSafeFetchUrl (pure URL-string validation, no DNS)", () => {
  it("rejects http://localhost", () => {
    expect(() => assertSafeFetchUrl("http://localhost")).toThrow(SSRFError);
  });

  it("rejects http://127.0.0.1 (loopback)", () => {
    expect(() => assertSafeFetchUrl("http://127.0.0.1")).toThrow(SSRFError);
  });

  it("rejects http://169.254.169.254 (cloud metadata)", () => {
    expect(() => assertSafeFetchUrl("http://169.254.169.254")).toThrow(SSRFError);
  });

  it("rejects http://10.0.0.1 (RFC1918)", () => {
    expect(() => assertSafeFetchUrl("http://10.0.0.1")).toThrow(SSRFError);
  });

  it("rejects ftp:// scheme", () => {
    expect(() => assertSafeFetchUrl("ftp://example.com/file")).toThrow(SSRFError);
  });

  it("rejects file:// scheme", () => {
    expect(() => assertSafeFetchUrl("file:///etc/passwd")).toThrow(SSRFError);
  });

  it("rejects literal private hosts even over https (no http shortcut)", () => {
    expect(() => assertSafeFetchUrl("https://127.0.0.1")).toThrow(SSRFError);
    expect(() => assertSafeFetchUrl("https://169.254.169.254")).toThrow(SSRFError);
    expect(() => assertSafeFetchUrl("https://[::1]")).toThrow(SSRFError);
  });

  it("accepts a normal https public URL string and returns a URL", () => {
    const u = assertSafeFetchUrl("https://api.example.com/webhooks/test?x=1");
    expect(u).toBeInstanceOf(URL);
    expect(u.hostname).toBe("api.example.com");
    expect(u.protocol).toBe("https:");
  });
});

describe("assertResolvedHostSafe (DNS-aware rebinding check, stubbed resolver)", () => {
  it("rejects a public hostname whose A record points at a private IP", async () => {
    (globalThis as { Deno?: unknown }).Deno = {
      resolveDns: async (_host: string, type: string) =>
        type === "A" ? ["169.254.169.254"] : [],
    };
    await expect(assertResolvedHostSafe("evil.example.com")).rejects.toBeInstanceOf(SSRFError);
  });

  it("rejects when AAAA resolves to loopback ::1", async () => {
    (globalThis as { Deno?: unknown }).Deno = {
      resolveDns: async (_host: string, type: string) =>
        type === "AAAA" ? ["::1"] : [],
    };
    await expect(assertResolvedHostSafe("evil.example.com")).rejects.toBeInstanceOf(SSRFError);
  });

  it("resolves OK when all resolved IPs are public", async () => {
    (globalThis as { Deno?: unknown }).Deno = {
      resolveDns: async (_host: string, type: string) =>
        type === "A" ? ["93.184.216.34"] : [],
    };
    await expect(assertResolvedHostSafe("example.com")).resolves.toBeUndefined();
  });

  it("is a no-op when no Deno resolver is present (string check still governs)", async () => {
    (globalThis as { Deno?: unknown }).Deno = undefined;
    await expect(assertResolvedHostSafe("example.com")).resolves.toBeUndefined();
  });
});
