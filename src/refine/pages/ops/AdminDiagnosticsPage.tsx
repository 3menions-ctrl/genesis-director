/**
 * AdminDiagnosticsPage — one-click comprehensive health diagnostic.
 *
 * Runs a battery of READ-ONLY probes across four domains (platform, app/render
 * pipeline, business accounts, regular user accounts) against the live backend,
 * streams results as they settle, and rolls them up into a verdict with every
 * failure expandable to its raw error + remediation link. All findings are real
 * — see src/admin/diagnostics/checks.ts. Nothing here mutates data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Copy, Download,
  MinusCircle, Play, RefreshCw, XCircle, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, StatOrb, DeckButton, ACCENT_HSL, accent, CYAN, AMBER, ROSE } from "@/admin/ui/primitives";
import { Donut } from "@/admin/ui/charts";
import {
  buildChecks, runChecks, summarize, bySeverity, reportToText,
  DOMAIN_LABEL, type CheckResult, type CheckStatus, type Domain,
} from "@/admin/diagnostics";

const STATUS_META: Record<CheckStatus, { color: string; Icon: typeof CheckCircle2; label: string }> = {
  pass: { color: CYAN, Icon: CheckCircle2, label: "Pass" },
  warn: { color: AMBER, Icon: AlertTriangle, label: "Warn" },
  fail: { color: ROSE, Icon: XCircle, label: "Fail" },
  skip: { color: "rgba(255,255,255,0.4)", Icon: MinusCircle, label: "Skip" },
};
const VERDICT_META = {
  healthy:  { color: CYAN, label: "Healthy" },
  degraded: { color: AMBER, label: "Degraded" },
  critical: { color: ROSE, label: "Critical" },
  unknown:  { color: "rgba(255,255,255,0.5)", label: "Not run" },
} as const;
const DOMAINS: Domain[] = ["platform", "app", "business", "user"];

export default function AdminDiagnosticsPage() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [params, setParams] = useSearchParams();
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const checks = buildChecks();
    setRunning(true); setResults([]); setTotal(checks.length); setExpanded(new Set());
    const acc: CheckResult[] = [];
    try {
      await runChecks(checks, {
        concurrency: 6,
        onResult: (r) => { acc.push(r); setResults(acc.slice()); },
      });
    } catch (e) {
      toast.error(`Diagnostic run error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false); setRanAt(new Date()); runningRef.current = false;
    }
  }, []);

  // Auto-run once on mount (and when arriving with ?autorun=1 from the dashboard).
  useEffect(() => {
    void run();
    if (params.get("autorun")) { params.delete("autorun"); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => summarize(results), [results]);
  const verdict = VERDICT_META[running && results.length === 0 ? "unknown" : summary.verdict];
  const donutData = useMemo(() => ([
    { key: "Pass", value: summary.pass, color: CYAN },
    { key: "Warn", value: summary.warn, color: AMBER },
    { key: "Fail", value: summary.fail, color: ROSE },
    { key: "Skip", value: summary.skip, color: "rgba(255,255,255,0.28)" },
  ].filter((d) => d.value > 0)), [summary]);

  const visible = useMemo(
    () => (onlyIssues ? results.filter((r) => r.status === "fail" || r.status === "warn") : results),
    [results, onlyIssues],
  );

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const copyReport = async () => {
    try { await navigator.clipboard.writeText(reportToText(results, ranAt ?? new Date())); toast.success("Report copied"); }
    catch { toast.error("Clipboard unavailable"); }
  };
  const downloadCsv = () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const head = ["domain", "group", "check", "status", "metric", "message", "detail", "latency_ms"].join(",");
    const lines = results.map((r) => [DOMAIN_LABEL[r.domain], r.group, r.label, r.status, r.metric ?? "", r.message, r.detail ?? "", r.latencyMs].map((v) => esc(String(v))).join(","));
    const url = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `diagnostic-${(ranAt ?? new Date()).toISOString().slice(0, 19)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminPageShell
      eyebrow="06 // DIAGNOSTIC"
      code="DIA"
      title="Run"
      italic="diagnostic."
      description="One pass of read-only health probes across the platform, the render pipeline, business accounts and regular user accounts. Every failure is real and links to where you fix it."
      actions={
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em]"
            style={{ color: verdict.color, background: `${verdict.color}1f` }}>
            <Activity className="h-3 w-3" /> {verdict.label}
          </span>
          <DeckButton primary onClick={() => void run()} disabled={running}>
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? `Running ${results.length}/${total}` : "Run diagnostic"}
          </DeckButton>
        </div>
      }
    >
      <div className="space-y-12">
        {/* Summary rail */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-4">
          <StatOrb index={0} aura={ACCENT_HSL} icon={Activity} label="Checks" value={running ? `${results.length}/${total}` : results.length} sub={ranAt ? `ran ${ranAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—"} />
          <StatOrb index={1} aura={CYAN} icon={CheckCircle2} label="Passing" value={summary.pass} sub="healthy" />
          <StatOrb index={2} aura={AMBER} icon={AlertTriangle} label="Warnings" value={summary.warn} sub="watch" />
          <StatOrb index={3} aura={ROSE} icon={XCircle} label="Failures" value={summary.fail} sub={summary.fail > 0 ? "act now" : "all clear"} />
        </div>

        {/* Progress bar while running */}
        {running && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${total ? (results.length / total) * 100 : 0}%`, background: `linear-gradient(90deg, ${ACCENT_HSL}, ${CYAN})` }} />
          </div>
        )}

        {/* Breakdown donut + actions */}
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1fr_1.4fr]">
          <FloatSection title="Result mix" meta={running ? "streaming…" : ranAt ? "complete" : "idle"}>
            <Donut data={donutData} height={210} centerLabel="checks" emptyLabel="Run a diagnostic to populate." />
          </FloatSection>
          <FloatSection title="Report" meta={`${results.length} checks`} actions={
            <div className="flex items-center gap-2">
              <button onClick={() => setOnlyIssues((v) => !v)}
                className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
                style={onlyIssues ? { color: ROSE, background: `${ROSE}1f` } : { color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.06)" }}>
                {onlyIssues ? "Issues only" : "All checks"}
              </button>
              <button onClick={copyReport} disabled={results.length === 0} title="Copy report"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-40">
                <Copy className="h-3 w-3" /> Copy
              </button>
              <button onClick={downloadCsv} disabled={results.length === 0} title="Download CSV"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-40">
                <Download className="h-3 w-3" /> CSV
              </button>
            </div>
          }>
            <p className="text-[13px] font-light leading-relaxed text-white/55">
              {summary.fail > 0
                ? `${summary.fail} failing check${summary.fail === 1 ? "" : "s"} need attention — expand any row below for the raw error and a link to act.`
                : summary.warn > 0
                  ? `No hard failures. ${summary.warn} warning${summary.warn === 1 ? "" : "s"} worth a look.`
                  : ranAt ? "All probes green across every domain." : "Diagnostic runs automatically on load; press Run to re-check."}
            </p>
          </FloatSection>
        </div>

        {/* Grouped results */}
        {DOMAINS.map((d) => {
          const rows = visible.filter((r) => r.domain === d).sort(bySeverity);
          if (rows.length === 0) return null;
          const dFail = rows.filter((r) => r.status === "fail").length;
          const dWarn = rows.filter((r) => r.status === "warn").length;
          return (
            <FloatSection key={d} title={DOMAIN_LABEL[d]}
              meta={dFail ? `${dFail} failing` : dWarn ? `${dWarn} warning` : `${rows.length} ok`}>
              <div>
                {rows.map((r, i) => {
                  const meta = STATUS_META[r.status];
                  const open = expanded.has(r.id);
                  const hasMore = !!(r.detail || r.hint || r.link);
                  const issue = r.status === "fail" || r.status === "warn";
                  return (
                    <div key={r.id} style={{ borderBottom: i === rows.length - 1 ? undefined : "1px solid rgba(255,255,255,0.05)" }}>
                      <div onClick={() => hasMore && toggle(r.id)}
                        className={`flex items-center gap-3 py-3.5 ${hasMore ? "cursor-pointer transition-colors hover:bg-white/[0.015]" : ""}`}>
                        <meta.Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] text-white/85">{r.label}</span>
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">{r.group}</span>
                          </div>
                          <div className="truncate text-[12px] text-white/45">{r.message}</div>
                        </div>
                        {r.metric && (
                          <span className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] tabular-nums tracking-[0.1em]"
                            style={{ color: meta.color, background: `${meta.color}14` }}>{r.metric}</span>
                        )}
                        <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-white/25 sm:inline">{r.latencyMs}ms</span>
                        {hasMore && <ChevronRight className={`h-4 w-4 shrink-0 text-white/25 transition-transform ${open ? "rotate-90" : ""}`} />}
                      </div>
                      {open && hasMore && (
                        <div className="mb-3 ml-7 space-y-2 rounded-xl bg-white/[0.03] p-3.5">
                          {r.detail && <div className="font-mono text-[11.5px] leading-relaxed text-white/60" style={issue ? { color: meta.color } : undefined}>{r.detail}</div>}
                          {r.hint && <div className="text-[12px] font-light text-white/50">{r.hint}</div>}
                          {r.link && (
                            <Link to={r.link} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: ACCENT_HSL }}>
                              Open surface <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </FloatSection>
          );
        })}

        {/* Empty (only before first results arrive) */}
        {results.length === 0 && !running && (
          <FloatSection title="Ready">
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${accent(0.2)}, ${accent(0.06)})`, color: ACCENT_HSL }}>
                <Play className="h-5 w-5" />
              </span>
              <p className="text-[14px] text-white/60">Press <span className="text-white/90">Run diagnostic</span> to probe every surface.</p>
              <DeckButton primary onClick={() => void run()}><Play className="h-3.5 w-3.5" /> Run diagnostic</DeckButton>
            </div>
          </FloatSection>
        )}
      </div>
    </AdminPageShell>
  );
}
