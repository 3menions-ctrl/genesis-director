/**
 * Projection math — the forecasting core behind the admin analytics view.
 */
import { describe, it, expect } from "vitest";
import {
  linearFit,
  projectForward,
  buildProjectedSeries,
  bucketByWeek,
  bucketByMonth,
  trendPct,
} from "@/lib/analytics/projection";

describe("linearFit", () => {
  it("fits a perfect line with r2 = 1", () => {
    const { slope, intercept, r2 } = linearFit([2, 4, 6, 8]);
    expect(slope).toBeCloseTo(2);
    expect(intercept).toBeCloseTo(2);
    expect(r2).toBeCloseTo(1);
  });

  it("handles empty + single-point series", () => {
    expect(linearFit([])).toEqual({ slope: 0, intercept: 0, r2: 0 });
    expect(linearFit([7])).toEqual({ slope: 0, intercept: 7, r2: 1 });
  });

  it("flat series → zero slope", () => {
    const { slope } = linearFit([5, 5, 5, 5]);
    expect(slope).toBeCloseTo(0);
  });
});

describe("projectForward", () => {
  it("extends the trend line forward and rounds to ints", () => {
    // y = 2x + 2 → next 2 points after index 3 are x=4,5 → 10, 12
    expect(projectForward([2, 4, 6, 8], 2)).toEqual([10, 12]);
  });

  it("clamps negative projections at 0", () => {
    // steep downward trend would go negative — must clamp.
    const out = projectForward([10, 7, 4, 1], 5);
    expect(out.every((v) => v >= 0)).toBe(true);
    expect(out[out.length - 1]).toBe(0);
  });

  it("returns an empty array for horizon 0", () => {
    expect(projectForward([1, 2, 3], 0)).toEqual([]);
  });
});

describe("buildProjectedSeries", () => {
  const points = [
    { day: "2026-01-01", value: 10 },
    { day: "2026-01-02", value: 20 },
    { day: "2026-01-03", value: 30 },
  ];

  it("joins actual + projected with a connecting seam point", () => {
    const { series, projectedTotal } = buildProjectedSeries(points, 2, (s) => `+${s}`);
    // 3 actual + 2 projected.
    expect(series).toHaveLength(5);
    // Seam: last actual carries BOTH value and projected.
    const seam = series[2];
    expect(seam.value).toBe(30);
    expect(seam.projected).toBe(30);
    // Future points are projected-only.
    expect(series[3].value).toBeNull();
    expect(series[3].projected).toBe(40);
    expect(series[4].projected).toBe(50);
    expect(projectedTotal).toBe(90);
  });

  it("labels future points via labelFor", () => {
    const { series } = buildProjectedSeries(points, 1, (s) => `day+${s}`);
    expect(series[3].day).toBe("day+1");
  });
});

describe("bucketByWeek / bucketByMonth", () => {
  it("sums daily points into ISO-week buckets", () => {
    // 2026-01-05 is a Monday; 01-05..01-07 fall in the same week.
    const weeks = bucketByWeek([
      { day: "2026-01-05", value: 1 },
      { day: "2026-01-06", value: 2 },
      { day: "2026-01-07", value: 3 },
      { day: "2026-01-12", value: 4 }, // next Monday → new bucket
    ]);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toEqual({ day: "2026-01-05", value: 6 });
    expect(weeks[1]).toEqual({ day: "2026-01-12", value: 4 });
  });

  it("sums daily points into month buckets", () => {
    const months = bucketByMonth([
      { day: "2026-01-31", value: 5 },
      { day: "2026-02-01", value: 7 },
      { day: "2026-02-15", value: 3 },
    ]);
    expect(months).toEqual([
      { day: "2026-01", value: 5 },
      { day: "2026-02", value: 10 },
    ]);
  });

  it("skips malformed rows instead of throwing (regression: s.day.slice crash)", () => {
    // A null/undefined/non-string `day` (or unparseable date) must not crash the
    // rollup — it should be dropped and the good points still summed.
    const dirty = [
      { day: "2026-03-01", value: 4 },
      { day: undefined as unknown as string, value: 9 },
      { day: null as unknown as string, value: 9 },
      { day: "", value: 9 },
      { day: 20260315 as unknown as string, value: 9 },
      { day: "not-a-date", value: 1 },
      { day: "2026-03-20", value: 6 },
    ];
    expect(() => bucketByMonth(dirty)).not.toThrow();
    expect(() => bucketByWeek(dirty)).not.toThrow();

    // Month rollup keeps the two valid March points (4 + 6 = 10). "not-a-date"
    // slices to "not-a-d" and survives month bucketing (harmless label), but is
    // dropped by week bucketing where it fails to parse as a date.
    expect(bucketByMonth(dirty)).toContainEqual({ day: "2026-03", value: 10 });
    expect(bucketByWeek(dirty).reduce((a, b) => a + b.value, 0)).toBe(10);
  });
});

describe("trendPct", () => {
  it("computes first-half vs second-half growth", () => {
    // first half [10,10]=20, second half [20,20]=40 → +100%
    expect(trendPct([10, 10, 20, 20])).toBe(100);
  });
  it("is 0 for flat or too-short series", () => {
    expect(trendPct([5, 5, 5, 5])).toBe(0);
    expect(trendPct([5])).toBe(0);
  });
});
