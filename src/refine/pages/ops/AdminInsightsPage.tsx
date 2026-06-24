/**
 * AdminInsightsPage — the insights surface of our first-party analytics engine.
 *
 *  • Lifecycle funnel — the REAL product funnel (signup → project → reel → paid),
 *    backfilled server-side from source-of-truth tables. This is the primary
 *    surface: it's honest regardless of client instrumentation.
 *  • Funnel builder — sequential, time-respecting conversion over the EVENT
 *    STREAM. The product currently emits only three events ($pageview, search,
 *    signed_in), so the builder is deliberately restricted to those — building a
 *    funnel from un-emitted milestones (project_created, render_completed, …)
 *    would always return empty. We label that limitation instead of hiding it.
 *  • Journey paths — most common pageview transitions.
 *
 * All from our own Supabase RPCs. No third party.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Activity, Route as RouteIcon, Plus, X, Play, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";

interface Step { step: string; step_order: number; users: number; pct: number }
interface Path { from_path: string; to_path: string; transitions: number }

/**
 * The ONLY events the product actually emits today. The custom funnel builder
 * can only produce real numbers for these — anything else is a guaranteed empty
 * funnel, so we never offer it as a buildable step.
 */
const REAL_EVENTS = ["$pageview", "search", "signed_in"] as const;
const EVENT_LABEL: Record<string, string> = {
  $pageview: "Page view",
  search: "Search",
  signed_in: "Signed in",
};
const labelFor = (e: string) => EVENT_LABEL[e] ?? e;

/** Inline loading / error / empty state used inside the shell body. */
function State({ kind, title, hint }: { kind: "loading" | "error" | "empty"; title: string; hint?: string }) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : Activity;
  const color = kind === "error" ? "hsl(350 90% 70%)" : "rgba(255,255,255,0.25)";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Icon className={`h-7 w-7 ${kind === "loading" ? "animate-spin" : ""}`} style={{ color }} />
      <p className="text-[15px] text-white/70">{title}</p>
      {hint && <p className="max-w-md text-[12px] text-white/40">{hint}</p>}
    </div>
  );
}

function FunnelBars({ rows }: { rows: Step[] }) {
  if (!rows.length) return <div className="py-10 text-center text-[13px] font-light text-white/40">No data in this window.</div>;
  const base = Math.max(rows[0]?.users ?? 1, 1);
  return (
    <div className="space-y-3">
      {rows.map((s, i) => {
        const width = Math.max(2, (s.users / base) * 100);
        const dropFromPrev = i > 0 && rows[i - 1].users > 0 ? Math.round((1 - s.users / rows[i - 1].users) * 100) : 0;
        return (
          <div key={`${s.step}-${i}`}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-2 text-white/80">
                <span className="font-mono text-[10px] text-white/35">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-mono">{labelFor(s.step)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-display text-[15px] font-semibold tabular-nums text-white">{s.users.toLocaleString()}</span>
                <span className="w-12 text-right font-mono text-[11px] tabular-nums" style={{ color: ACCENT_HSL }}>{s.pct}%</span>
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-lg bg-white/[0.04]">
              <div className="flex h-full items-center px-3 transition-all" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${accent(0.85)}, ${CYAN})`, boxShadow: `0 0 18px -2px ${accent(0.6)}` }} />
            </div>
            {i > 0 && dropFromPrev > 0 && (
              <div className="mt-1 text-right font-mono text-[10px] text-white/35">−{dropFromPrev}% from previous</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminInsightsPage() {
  const [lifecycle, setLifecycle] = useState<Step[]>([]);
  const [available, setAvailable] = useState<string[]>([]); // instrumented events that actually have rows
  const [steps, setSteps] = useState<string[]>([]);
  const [funnel, setFunnel] = useState<Step[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setLoading(true); setError(null);
      const [lc, counts, pth] = await Promise.all([
        supabase.rpc("analytics_lifecycle_funnel" as never, {} as never),
        supabase.rpc("analytics_event_counts" as never, {} as never),
        supabase.rpc("analytics_paths" as never, {} as never),
      ]);
      // The lifecycle funnel + journeys are the load-bearing real surfaces.
      if (lc.error || pth.error) {
        setError(lc.error?.message ?? pth.error?.message ?? "Failed to load analytics.");
        setLoading(false);
        return;
      }
      setLifecycle(((lc.data as Step[]) ?? []));
      setPaths(((pth.data as Path[]) ?? []));

      // HONEST builder: only offer events the product actually emits AND that
      // currently carry rows in the stream. Everything else is a dead end.
      const emitted = new Set(((counts.data as { event: string }[]) ?? []).map((c) => c.event));
      const real = REAL_EVENTS.filter((e) => emitted.has(e));
      setAvailable(real);
      const defaults = real.slice(0, 2);
      setSteps(defaults);
      void runFunnel(defaults);

      setLoading(false);
    })();
  }, [runFunnel]);

  const addStep = (e: string) => setSteps((s) => [...s, e]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const entry = lifecycle[0]?.users ?? 0;
  const finalPct = lifecycle.length ? lifecycle[lifecycle.length - 1]?.pct ?? 0 : 0;
  const journeys = paths.length;
  const noInstrumentation = useMemo(() => available.length < 2, [available]);

  return (
    <AdminPageShell
      eyebrow="09 // ANALYTICS"
      code="INS"
      title="Insights"
      italic="& Funnels."
      description="Funnels, conversion and journeys — computed in your own database over both the source-of-truth tables and the first-party event stream."
      stats={[
        { label: "Funnel entries", value: entry.toLocaleString(), tone: "blue" },
        { label: "Reach paid", value: lifecycle.length ? `${finalPct}%` : "—", tone: "emerald" },
        { label: "Top journeys", value: journeys.toLocaleString(), tone: "neutral" },
        { label: "Instrumented events", value: available.length.toLocaleString(), tone: "amber", sub: "emitted by the product" },
      ]}
    >
      {error ? (
        <State kind="error" title="Couldn't load insights" hint={error} />
      ) : loading ? (
        <State kind="loading" title="Computing funnels…" />
      ) : lifecycle.length === 0 && paths.length === 0 ? (
        <State kind="empty" title="No analytics yet" hint="Lifecycle funnel and journeys appear here once there are signups and pageviews." />
      ) : (
        <div className="space-y-14">
          {/* Lifecycle funnel — the REAL product funnel, primary surface. */}
          <FloatSection title="Lifecycle funnel" meta="signup → paid · backfilled from source tables">
            <FunnelBars rows={lifecycle} />
          </FloatSection>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            {/* Custom funnel builder — restricted to instrumented events only. */}
            <FloatSection title="Funnel builder" meta="event stream">
              {noInstrumentation ? (
                <div className="rounded-xl bg-white/[0.025] px-4 py-8 text-center">
                  <p className="text-[13px] font-light text-white/55">Not enough instrumentation to build a custom funnel.</p>
                  <p className="mx-auto mt-2 max-w-sm text-[12px] font-light text-white/35">
                    The product emits only <span className="font-mono text-white/55">$pageview</span>, <span className="font-mono text-white/55">search</span> and <span className="font-mono text-white/55">signed_in</span>. Product milestones (project created, render completed, purchase…) aren't emitted yet — the lifecycle funnel above covers those from source tables.
                  </p>
                </div>
              ) : (
                <>
                  {/* selected ordered steps */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {steps.length === 0 && <span className="text-[12px] font-light text-white/40">Add events below to build a funnel.</span>}
                    {steps.map((s, i) => (
                      <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px]" style={{ background: accent(0.14), color: ACCENT_HSL }}>
                        <span className="text-white/40">{i + 1}</span>{labelFor(s)}
                        <button type="button" onClick={() => removeStep(i)} className="text-white/40 hover:text-white"><X className="h-3 w-3" /></button>
                        {i < steps.length - 1 && <ArrowRight className="ml-1 h-3 w-3 text-white/25" />}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={() => void runFunnel(steps)} disabled={steps.length < 2 || running}
                    className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#0a0b0e] transition-colors hover:bg-white/90 disabled:opacity-40">
                    <Play className="h-3.5 w-3.5" /> {running ? "Computing…" : "Run funnel"}
                  </button>

                  {/* available (real, emitted) events */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {available.map((e) => (
                      <button key={e} type="button" onClick={() => addStep(e)} className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10.5px] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white">
                        <Plus className="h-3 w-3" />{labelFor(e)}
                      </button>
                    ))}
                  </div>
                  <p className="mb-5 text-[11px] font-light leading-relaxed text-white/35">
                    Limited to instrumented events. Product milestones aren't emitted yet — use the lifecycle funnel for those.
                  </p>

                  {funnel.length > 0 && <div className="border-t border-white/[0.06] pt-5"><FunnelBars rows={funnel} /></div>}
                </>
              )}
            </FloatSection>

            {/* Journey paths */}
            <FloatSection title="Top journeys" meta="page → page">
              {paths.length === 0 ? (
                <div className="py-10 text-center text-[13px] font-light text-white/40">Not enough navigation data yet.</div>
              ) : (
                <FloatTable
                  columns={[
                    { key: "from", label: "From" },
                    { key: "to", label: "To" },
                    { key: "n", label: "Transitions", align: "right" },
                  ]}
                  rows={paths.map((p, i) => ({
                    _key: `${p.from_path}-${p.to_path}-${i}`,
                    from: <span className="block max-w-[12rem] truncate font-mono text-[12px] text-white/70">{p.from_path || "/"}</span>,
                    to: (
                      <span className="flex items-center gap-2 font-mono text-[12px] text-white/70">
                        <RouteIcon className="h-3 w-3 shrink-0" style={{ color: ACCENT_HSL }} />
                        <span className="block max-w-[12rem] truncate">{p.to_path || "/"}</span>
                      </span>
                    ),
                    n: <span className="text-white">{p.transitions.toLocaleString()}</span>,
                  }))}
                  empty="Not enough navigation data yet."
                />
              )}
            </FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
