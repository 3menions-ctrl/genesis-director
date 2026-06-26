import { describe, it, expect } from "vitest";
import { bucketByDay, countBy, sumBy, topN, pct } from "@/admin/ui/charts";

/**
 * Unit tests for the admin chart-kit data helpers. These pure functions shape
 * REAL rows into chart series; locking their behaviour guards against off-by-one
 * day bucketing, miscounts, and divide-by-zero — the failure modes that would
 * silently render misleading analytics.
 */

const NOW = new Date("2026-06-25T12:00:00Z");

describe("bucketByDay", () => {
  it("produces a contiguous series of the requested length ending today", () => {
    const series = bucketByDay([], () => null, { days: 7, now: NOW });
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].label).toBe("06-25");
  });

  it("counts one per row by default, into the matching day", () => {
    const rows = [
      { created_at: "2026-06-25T01:00:00Z" },
      { created_at: "2026-06-25T20:00:00Z" },
      { created_at: "2026-06-24T10:00:00Z" },
    ];
    const series = bucketByDay(rows, (r) => r.created_at, { days: 3, now: NOW });
    const today = series.find((s) => s.label === "06-25");
    const yesterday = series.find((s) => s.label === "06-24");
    expect(today?.value).toBe(2);
    expect(yesterday?.value).toBe(1);
  });

  it("sums a numeric selector when provided", () => {
    const rows = [
      { created_at: "2026-06-25T01:00:00Z", amount: 10 },
      { created_at: "2026-06-25T02:00:00Z", amount: -4 },
    ];
    const series = bucketByDay(rows, (r) => r.created_at, { days: 2, now: NOW, value: (r) => Math.abs(r.amount) });
    expect(series.find((s) => s.label === "06-25")?.value).toBe(14);
  });

  it("ignores rows outside the window and invalid dates", () => {
    const rows = [
      { created_at: "2020-01-01T00:00:00Z" },
      { created_at: "not-a-date" },
      { created_at: "2026-06-25T00:00:00Z" },
    ];
    const series = bucketByDay(rows, (r) => r.created_at, { days: 3, now: NOW });
    expect(series.reduce((s, p) => s + p.value, 0)).toBe(1);
  });
});

describe("countBy", () => {
  it("counts and sorts categories descending", () => {
    const rows = [{ s: "a" }, { s: "b" }, { s: "a" }, { s: "a" }, { s: "b" }];
    const out = countBy(rows, (r) => r.s);
    expect(out[0]).toEqual({ key: "a", value: 3 });
    expect(out[1]).toEqual({ key: "b", value: 2 });
  });

  it("folds null/empty into the other label", () => {
    const rows = [{ s: null }, { s: "" }, { s: "x" }];
    const out = countBy(rows, (r) => r.s as string | null, "none");
    expect(out.find((d) => d.key === "none")?.value).toBe(2);
  });
});

describe("sumBy", () => {
  it("sums values per category", () => {
    const rows = [
      { svc: "a", cost: 5 }, { svc: "a", cost: 3 }, { svc: "b", cost: 10 },
    ];
    const out = sumBy(rows, (r) => r.svc, (r) => r.cost);
    expect(out[0]).toEqual({ key: "b", value: 10 });
    expect(out[1]).toEqual({ key: "a", value: 8 });
  });
});

describe("topN", () => {
  it("folds the tail into an Other bucket", () => {
    const data = [
      { key: "a", value: 5 }, { key: "b", value: 4 }, { key: "c", value: 3 }, { key: "d", value: 2 },
    ];
    const out = topN(data, 2);
    expect(out).toHaveLength(3);
    expect(out[2].key).toBe("Other");
    expect(out[2].value).toBe(5);
  });

  it("returns data unchanged when within n", () => {
    const data = [{ key: "a", value: 1 }];
    expect(topN(data, 3)).toBe(data);
  });
});

describe("pct", () => {
  it("guards divide-by-zero", () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(1, 4)).toBe(25);
  });
});
