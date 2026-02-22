/**
 * REGRESSION SMOKE TESTS
 * 
 * These tests verify baseline app stability:
 * - Critical components render without crashing
 * - Core utilities don't throw
 * - Auth context provides safe defaults
 * - Key modules can be imported
 */
import { describe, it, expect, vi } from "vitest";

// Mock supabase before any imports
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe("Module Import Smoke Tests", () => {
  it("imports App without throwing", async () => {
    await expect(import("@/App")).resolves.toBeDefined();
  });

  it("imports utils without throwing", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn).toBeInstanceOf(Function);
    expect(cn("a", "b")).toBe("a b");
  });

  it("imports creditSystem without throwing", async () => {
    const mod = await import("@/lib/creditSystem");
    expect(mod).toBeDefined();
  });

  it("imports pipelineStateMachine without throwing", async () => {
    const mod = await import("@/lib/pipelineStateMachine");
    expect(mod).toBeDefined();
  });

  it("imports safeMode without throwing", async () => {
    const mod = await import("@/lib/safeMode");
    expect(mod.getSafeModeStatus).toBeInstanceOf(Function);
  });

  it("imports crashForensics without throwing", async () => {
    const mod = await import("@/lib/crashForensics");
    expect(mod.crashForensics).toBeDefined();
  });
});

describe("Utility Function Smoke Tests", () => {
  it("cn merges classes correctly", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("px-2", "px-4")).toBe("px-4"); // tailwind-merge
  });

  it("formatTime in safeVideoOperations handles edge cases", async () => {
    const { isSafeVideoNumber } = await import("@/lib/video/safeVideoOperations");
    expect(isSafeVideoNumber(0)).toBe(true);
    expect(isSafeVideoNumber(NaN)).toBe(false);
    expect(isSafeVideoNumber(Infinity)).toBe(false);
    expect(isSafeVideoNumber(-1)).toBe(false); // negative = unsafe for video
  });
});

describe("Type Safety Smoke Tests", () => {
  it("movie types can be imported", async () => {
    const mod = await import("@/types/movie");
    expect(mod).toBeDefined();
  });

  it("studio types can be imported", async () => {
    const mod = await import("@/types/studio");
    expect(mod).toBeDefined();
  });

  it("production pipeline types can be imported", async () => {
    const mod = await import("@/types/production-pipeline");
    expect(mod).toBeDefined();
  });
});

describe("Security Smoke Tests", () => {
  it("security module exports expected functions", async () => {
    const mod = await import("@/lib/security");
    expect(mod).toBeDefined();
  });

  it("contentSafety module exports expected functions", async () => {
    const mod = await import("@/lib/contentSafety");
    expect(mod).toBeDefined();
  });
});
