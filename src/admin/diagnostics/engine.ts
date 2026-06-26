/**
 * Diagnostics engine — a small, network-agnostic framework for running a battery
 * of health checks with bounded concurrency, per-check timing, crash-safety, and
 * streaming results. The actual probes (which hit Supabase) live in ./checks.ts;
 * this file is pure orchestration so it can be unit-tested without a backend.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "skip";
export type Domain = "platform" | "app" | "business" | "user";

export interface CheckOutcome {
  status: CheckStatus;
  /** One-line human summary of what was found. */
  message: string;
  /** Optional extra context — raw error text, ids, counts. Shown on expand. */
  detail?: string;
  /** Optional compact figure rendered next to the row, e.g. "3 stuck", "98.2%". */
  metric?: string;
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  domain: Domain;
  group: string;
  /** Remediation pointer shown when the check is not green. */
  hint?: string;
  /** Admin route to act on the finding. */
  link?: string;
  /** Runs the probe. MUST be read-only. Throwing is caught → fail. */
  run: () => Promise<CheckOutcome>;
}

export interface CheckResult extends CheckOutcome {
  id: string;
  label: string;
  domain: Domain;
  group: string;
  hint?: string;
  link?: string;
  latencyMs: number;
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  platform: "Platform & infrastructure",
  app: "App & render pipeline",
  business: "Business accounts",
  user: "Regular user accounts",
};

const STATUS_RANK: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2, skip: 3 };

/** Reject a promise that runs longer than `ms` so a single hung probe can't
 *  stall the whole run. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Run all checks with a bounded worker pool. Each check is timed and crash-safe
 * (a throw or timeout becomes a `fail` result). `onResult` fires as each check
 * settles so the UI can stream progress. `clock` is injectable for tests.
 */
export async function runChecks(
  checks: DiagnosticCheck[],
  opts: { concurrency?: number; timeoutMs?: number; onResult?: (r: CheckResult) => void; clock?: () => number } = {},
): Promise<CheckResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const clock = opts.clock ?? (() => Date.now());
  const results: CheckResult[] = new Array(checks.length);
  let next = 0;

  const settle = async (i: number): Promise<void> => {
    const c = checks[i];
    const started = clock();
    let outcome: CheckOutcome;
    try {
      outcome = await withTimeout(c.run(), timeoutMs, c.label);
    } catch (e) {
      outcome = { status: "fail", message: "Check threw an error", detail: e instanceof Error ? e.message : String(e) };
    }
    const result: CheckResult = {
      id: c.id, label: c.label, domain: c.domain, group: c.group,
      hint: c.hint, link: c.link, latencyMs: Math.max(0, clock() - started),
      ...outcome,
    };
    results[i] = result;
    opts.onResult?.(result);
  };

  const worker = async (): Promise<void> => {
    while (next < checks.length) {
      const i = next++;
      await settle(i);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, checks.length) }, worker));
  return results;
}

export interface DiagnosticSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  skip: number;
  /** Worst-case rollup across all checks. */
  verdict: "healthy" | "degraded" | "critical" | "unknown";
}

export function summarize(results: CheckResult[]): DiagnosticSummary {
  const s: DiagnosticSummary = { total: results.length, pass: 0, warn: 0, fail: 0, skip: 0, verdict: "unknown" };
  for (const r of results) s[r.status]++;
  s.verdict = results.length === 0 ? "unknown" : s.fail > 0 ? "critical" : s.warn > 0 ? "degraded" : "healthy";
  return s;
}

/** Sort worst-first (fail → warn → pass → skip), stable within a status. */
export function bySeverity(a: CheckResult, b: CheckResult): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status];
}

/** Render the report as plain text for copy/export. */
export function reportToText(results: CheckResult[], at: Date): string {
  const sum = summarize(results);
  const lines: string[] = [
    `ADMIN DIAGNOSTIC REPORT — ${at.toISOString()}`,
    `Verdict: ${sum.verdict.toUpperCase()}  |  ${sum.pass} pass · ${sum.warn} warn · ${sum.fail} fail · ${sum.skip} skip  (of ${sum.total})`,
    "",
  ];
  const domains = Object.keys(DOMAIN_LABEL) as Domain[];
  for (const d of domains) {
    const rows = results.filter((r) => r.domain === d).sort(bySeverity);
    if (rows.length === 0) continue;
    lines.push(`## ${DOMAIN_LABEL[d]}`);
    for (const r of rows) {
      lines.push(`  [${r.status.toUpperCase()}] ${r.label}${r.metric ? ` (${r.metric})` : ""} — ${r.message}${r.latencyMs ? ` · ${r.latencyMs}ms` : ""}`);
      if (r.detail) lines.push(`         ↳ ${r.detail}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
