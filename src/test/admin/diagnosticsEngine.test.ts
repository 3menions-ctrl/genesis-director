import { describe, it, expect } from "vitest";
import {
  runChecks, summarize, bySeverity, reportToText, withTimeout,
  type DiagnosticCheck, type CheckResult,
} from "@/admin/diagnostics/engine";

/**
 * Unit tests for the diagnostics engine. The engine is the crash-safety net for
 * the whole feature: a hung or throwing probe must become a `fail` result, never
 * take down the run — and the rollup verdict must reflect the worst finding.
 */

const mk = (id: string, status: DiagnosticCheck["domain"] extends never ? never : "pass" | "warn" | "fail" | "skip", domain: DiagnosticCheck["domain"] = "platform"): DiagnosticCheck => ({
  id, label: id, domain, group: "G",
  run: async () => ({ status, message: `${id} ${status}` }),
});

describe("runChecks", () => {
  it("runs every check and preserves input order in results", async () => {
    const checks = [mk("a", "pass"), mk("b", "warn"), mk("c", "fail")];
    const out = await runChecks(checks, { concurrency: 2 });
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(out.map((r) => r.status)).toEqual(["pass", "warn", "fail"]);
  });

  it("converts a throwing probe into a fail result instead of rejecting", async () => {
    const boom: DiagnosticCheck = { id: "boom", label: "boom", domain: "app", group: "G", run: async () => { throw new Error("kaboom"); } };
    const [r] = await runChecks([boom]);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("kaboom");
  });

  it("times out a hung probe via withTimeout", async () => {
    const hang: DiagnosticCheck = { id: "hang", label: "hang", domain: "app", group: "G", run: () => new Promise(() => {}) };
    const [r] = await runChecks([hang], { timeoutMs: 20 });
    expect(r.status).toBe("fail");
    expect(r.detail).toMatch(/timed out/);
  });

  it("streams each result through onResult exactly once", async () => {
    const seen: string[] = [];
    await runChecks([mk("a", "pass"), mk("b", "pass")], { onResult: (r) => seen.push(r.id) });
    expect(seen.sort()).toEqual(["a", "b"]);
  });

  it("respects the concurrency cap (never more than N in flight)", async () => {
    let inFlight = 0, peak = 0;
    const slow = (id: string): DiagnosticCheck => ({
      id, label: id, domain: "platform", group: "G",
      run: async () => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return { status: "pass", message: id }; },
    });
    await runChecks([slow("1"), slow("2"), slow("3"), slow("4"), slow("5")], { concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("summarize", () => {
  const res = (status: CheckResult["status"]): CheckResult => ({ id: status, label: status, domain: "platform", group: "G", status, message: "", latencyMs: 1 });
  it("rolls up to critical when any fail exists", () => {
    expect(summarize([res("pass"), res("warn"), res("fail")]).verdict).toBe("critical");
  });
  it("rolls up to degraded when only warnings exist", () => {
    expect(summarize([res("pass"), res("warn")]).verdict).toBe("degraded");
  });
  it("rolls up to healthy when all pass", () => {
    expect(summarize([res("pass"), res("pass")]).verdict).toBe("healthy");
  });
  it("is unknown for an empty run", () => {
    expect(summarize([]).verdict).toBe("unknown");
  });
});

describe("bySeverity + reportToText", () => {
  const res = (id: string, status: CheckResult["status"]): CheckResult => ({ id, label: id, domain: "app", group: "G", status, message: `${id} msg`, latencyMs: 2 });
  it("sorts fail before warn before pass", () => {
    const sorted = [res("p", "pass"), res("f", "fail"), res("w", "warn")].sort(bySeverity);
    expect(sorted.map((r) => r.id)).toEqual(["f", "w", "p"]);
  });
  it("renders a text report with the verdict header", () => {
    const txt = reportToText([res("x", "fail")], new Date("2026-06-26T00:00:00Z"));
    expect(txt).toContain("CRITICAL");
    expect(txt).toContain("[FAIL] x");
  });
});

describe("withTimeout", () => {
  it("resolves a fast promise", async () => {
    await expect(withTimeout(Promise.resolve(7), 50, "x")).resolves.toBe(7);
  });
});
