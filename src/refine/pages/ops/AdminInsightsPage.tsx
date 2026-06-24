/**
 * AdminInsightsPage — the insights surface of our first-party analytics engine.
 *
 *  • Lifecycle funnel — the core product funnel, backfilled from source tables.
 *  • Funnel builder — pick any tracked events as ordered steps; sequential,
 *    time-respecting conversion computed server-side.
 *  • Journey paths — most common pageview transitions.
 *
 * All from our own Supabase RPCs. No third party.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Route as RouteIcon, GitBranch, Plus, X, Play, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminCard, ChartCard, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";

interface Step { step: string; step_order: number; users: number; pct: number }
interface Path { from_path: string; to_path: string; transitions: number }

function FunnelBars({ rows }: { rows: Step[] }) {
  if (!rows.length) return <div className="py-10 text-center text-[13px] font-light text-[#9aa4b8]">No data in this window.</div>;
  const base = Math.max(rows[0]?.users ?? 1, 1);
  return (
    <div className="space-y-3">
      {rows.map((s, i) => {
        const width = Math.max(2, (s.users / base) * 100);
        const dropFromPrev = i > 0 && rows[i - 1].users > 0 ? Math.round((1 - s.users / rows[i - 1].users) * 100) : 0;
        return (
          <div key={`${s.step}-${i}`}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-2 text-[#0c1426]">
                <span className="font-mono text-[10px] text-[#9aa4b8]">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-mono">{s.step}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-display text-[15px] font-semibold tabular-nums text-[#0c1426]">{s.users.toLocaleString()}</span>
                <span className="w-12 text-right font-mono text-[11px] tabular-nums" style={{ color: ACCENT_HSL }}>{s.pct}%</span>
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-lg bg-[#f6f8fc]">
              <div className="flex h-full items-center px-3 transition-all" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${accent(0.85)}, ${CYAN})`, boxShadow: `0 0 18px -2px ${accent(0.6)}` }} />
            </div>
            {i > 0 && dropFromPrev > 0 && (
              <div className="mt-1 text-right font-mono text-[10px] text-[#9aa4b8]">−{dropFromPrev}% from previous</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminInsightsPage() {
  const [lifecycle, setLifecycle] = useState<Step[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [funnel, setFunnel] = useState<Step[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const runFunnel = useCallback(async (s: string[]) => {
    if (s.length < 2) { setFunnel([]); return; }
    setRunning(true);
    const { data } = await supabase.rpc("analytics_funnel" as never, { _steps: s } as never);
    setFunnel(((data as Step[]) ?? []));
    setRunning(false);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: lc }, { data: counts }, { data: pth }] = await Promise.all([
        supabase.rpc("analytics_lifecycle_funnel" as never, {} as never),
        supabase.rpc("analytics_event_counts" as never, {} as never),
        supabase.rpc("analytics_paths" as never, {} as never),
      ]);
      setLifecycle(((lc as Step[]) ?? []));
      const evs = ((counts as { event: string }[]) ?? []).map((c) => c.event);
      setAvailable(evs);
      setPaths(((pth as Path[]) ?? []));
      const defaults = evs.slice(0, 2);
      setSteps(defaults);
      void runFunnel(defaults);
      setLoading(false);
    })();
  }, [runFunnel]);

  const addStep = (e: string) => setSteps((s) => [...s, e]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const unusedHint = useMemo(() => available.length === 0, [available]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="First-party analytics" title={<>Insights.</>} sub="Funnels, conversion and journeys — computed in your own database over both the event stream and source-of-truth tables." />

      {/* Lifecycle funnel */}
      <ChartCard title="Lifecycle funnel" meta="signup → paid · backfilled" className="mb-6">
        {loading ? <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#9aa4b8]">Loading…</div> : <FunnelBars rows={lifecycle} />}
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Custom funnel builder */}
        <AdminCard className="p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <GitBranch className="h-4 w-4" style={{ color: ACCENT_HSL }} />
            <span className="font-display text-[16px] font-semibold tracking-tight text-[#0c1426]">Funnel builder</span>
          </div>

          {/* selected steps */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {steps.length === 0 && <span className="text-[12px] font-light text-[#9aa4b8]">Add events below to build a funnel.</span>}
            {steps.map((s, i) => (
              <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px]" style={{ background: accent(0.14), color: ACCENT_HSL }}>
                <span className="text-[#9aa4b8]">{i + 1}</span>{s}
                <button type="button" onClick={() => removeStep(i)} className="text-[#9aa4b8] hover:text-[#0c1426]"><X className="h-3 w-3" /></button>
                {i < steps.length - 1 && <ArrowRight className="ml-1 h-3 w-3 text-[#9aa4b8]" />}
              </span>
            ))}
          </div>
          <button type="button" onClick={() => void runFunnel(steps)} disabled={steps.length < 2 || running}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#0a0b0e] transition-colors hover:bg-white/90 disabled:opacity-40">
            <Play className="h-3.5 w-3.5" /> {running ? "Computing…" : "Run funnel"}
          </button>

          {/* available events */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            {unusedHint && <span className="text-[12px] font-light text-[#9aa4b8]">No tracked events yet — browse the app to generate some.</span>}
            {available.map((e) => (
              <button key={e} type="button" onClick={() => addStep(e)} className="inline-flex items-center gap-1 rounded-full bg-[#f6f8fc] px-2.5 py-1 font-mono text-[10.5px] text-[#5d6a82] transition-colors hover:bg-[#f4f7ff] hover:text-[#0c1426]">
                <Plus className="h-3 w-3" />{e}
              </button>
            ))}
          </div>

          {funnel.length > 0 && <div className="border-t border-[#e7ebf3] pt-5"><FunnelBars rows={funnel} /></div>}
        </AdminCard>

        {/* Journey paths */}
        <AdminCard className="p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <RouteIcon className="h-4 w-4" style={{ color: ACCENT_HSL }} />
            <span className="font-display text-[16px] font-semibold tracking-tight text-[#0c1426]">Top journeys</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-[#9aa4b8]">page → page</span>
          </div>
          {loading ? <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#9aa4b8]">Loading…</div>
            : paths.length === 0 ? <div className="py-10 text-center text-[13px] font-light text-[#9aa4b8]">Not enough navigation data yet.</div>
            : (
              <div className="space-y-2">
                {paths.map((p, i) => {
                  const max = Math.max(...paths.map((x) => x.transitions), 1);
                  return (
                    <div key={i} className="relative overflow-hidden rounded-lg px-3 py-2">
                      <div aria-hidden className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(p.transitions / max) * 100}%`, background: accent(0.1) }} />
                      <div className="relative flex items-center gap-2 font-mono text-[12px]">
                        <span className="truncate text-[#0c1426]">{p.from_path || "/"}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" style={{ color: ACCENT_HSL }} />
                        <span className="truncate text-[#0c1426]">{p.to_path || "/"}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-[#5d6a82]">{p.transitions}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </AdminCard>
      </div>
    </div>
  );
}
