/**
 * Lightweight forecasting for the admin analytics views.
 *
 * Deliberately simple + transparent: an ordinary-least-squares linear fit over
 * the historical series, projected forward N steps. No hidden ML — an admin can
 * reason about "the trend line, extended." Values are clamped at 0 (you can't
 * have negative pageviews) and rounded to integers.
 *
 * Pure functions, no I/O — unit-tested in projection.test.ts.
 */

export interface LinearFit {
  /** Change in value per step (per day). */
  slope: number;
  /** Fitted value at index 0. */
  intercept: number;
  /** Coefficient of determination (0..1) — how well the line fits. */
  r2: number;
}

/** Ordinary least-squares fit of y over its index (0,1,2,…). */
export function linearFit(values: number[]): LinearFit {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: values[0], r2: 1 };

  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += values[i];
    sxx += i * i;
    sxy += i * values[i];
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;

  // R² against the fitted line.
  const mean = sy / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const fitted = intercept + slope * i;
    ssTot += (values[i] - mean) ** 2;
    ssRes += (values[i] - fitted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

/** Project `horizon` future values by extending the fitted line. Clamped ≥ 0. */
export function projectForward(values: number[], horizon: number): number[] {
  const { slope, intercept } = linearFit(values);
  const n = values.length;
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    out.push(Math.max(0, Math.round(intercept + slope * (n - 1 + h))));
  }
  return out;
}

export interface SeriesPoint {
  /** ISO date or label for the x-axis. */
  day: string;
  /** Actual value, or null for projected-only points. */
  value: number | null;
  /** Projected value, or null for historical-only points. */
  projected: number | null;
}

/**
 * Combine a historical series with a forward projection into one array suitable
 * for a recharts AreaChart with two series (value + projected). The seam point
 * (last actual) carries BOTH value and projected so the two lines visually join.
 *
 * @param points    historical [{ day, value }] in chronological order
 * @param horizon   number of future steps to project
 * @param labelFor  maps a future step index (1-based) to its x-axis label
 */
export function buildProjectedSeries(
  points: { day: string; value: number }[],
  horizon: number,
  labelFor: (stepFromLastActual: number) => string,
): { series: SeriesPoint[]; fit: LinearFit; projectedTotal: number } {
  const values = points.map((p) => p.value);
  const fit = linearFit(values);
  const future = projectForward(values, horizon);

  const series: SeriesPoint[] = points.map((p, i) => ({
    day: p.day,
    value: p.value,
    // The final actual point also seeds `projected` so the dashed line connects.
    projected: i === points.length - 1 ? p.value : null,
  }));

  future.forEach((v, i) => {
    series.push({ day: labelFor(i + 1), value: null, projected: v });
  });

  const projectedTotal = future.reduce((a, b) => a + b, 0);
  return { series, fit, projectedTotal };
}

// ── Bucketing helpers (daily → weekly / monthly rollups) ─────────────────────

export interface DailyPoint {
  day: string; // ISO yyyy-mm-dd
  value: number;
}

/** Sum daily points into ISO-week buckets (label = week-start date). */
export function bucketByWeek(points: DailyPoint[]): DailyPoint[] {
  const buckets = new Map<string, number>();
  for (const p of points) {
    const d = new Date(`${p.day}T00:00:00Z`);
    // Roll back to Monday (UTC).
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + p.value);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, value]) => ({ day, value }));
}

/** Sum daily points into calendar-month buckets (label = yyyy-mm). */
export function bucketByMonth(points: DailyPoint[]): DailyPoint[] {
  const buckets = new Map<string, number>();
  for (const p of points) {
    const key = p.day.slice(0, 7); // yyyy-mm
    buckets.set(key, (buckets.get(key) ?? 0) + p.value);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, value]) => ({ day, value }));
}

/** Simple period-over-period delta (%) between the first and second halves. */
export function trendPct(values: number[]): number {
  if (values.length < 2) return 0;
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = values.slice(mid).reduce((a, b) => a + b, 0);
  if (first === 0) return second > 0 ? 100 : 0;
  return Math.round(((second - first) / first) * 100);
}
