/**
 * AdminEventsPage — live Event Explorer for our first-party analytics engine.
 *
 * Two panes: per-event rollups (analytics_event_counts RPC) and a live feed of
 * the most recent raw events (auto-refreshing). All data from our own
 * analytics_events table — no third party.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Activity, Radio } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Count { event: string; hits: number; actors: number }
interface Evt { id: number; name: string | null; user_id: string | null; anonymous_id: string | null; path: string | null; occurred_at: string | null }

const REFRESH_MS = 6000;

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

export default function AdminEventsPage() {
  const [counts, setCounts] = useState<Count[]>([]);
  const [feed, setFeed] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  const load = useCallback(async () => {
    const [{ data: c, error: ce }, { data: f, error: fe }] = await Promise.all([
      supabase.rpc("analytics_event_counts" as never, {} as never),
      supabase.from("analytics_events").select("id,name,user_id,anonymous_id,path,occurred_at").order("occurred_at", { ascending: false }).limit(80),
    ]);
    if (ce || fe) { setError((ce ?? fe)?.message ?? "Failed to load analytics."); setLoading(false); return; }
    setError(null);
    setCounts(((c as Count[]) ?? []));
    setFeed(((f as Evt[]) ?? []));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const totalHits = useMemo(() => counts.reduce((a, c) => a + Number(c.hits), 0), [counts]);
  const totalActors = useMemo(() => Math.max(0, ...counts.map((c) => Number(c.actors))), [counts]);

  const chart = useMemo(
    () => [...counts].sort((a, b) => Number(b.hits) - Number(a.hits)).slice(0, 14).map((c) => ({ event: c.event, hits: Number(c.hits), actors: Number(c.actors) })),
    [counts],
  );

  const actor = (e: Evt) => e.user_id ? e.user_id.slice(0, 8) : e.anonymous_id ? `anon·${e.anonymous_id.slice(0, 6)}` : "—";
  const ago = (t: string | null) => {
    if (!t) return "";
    const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));
    return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
  };

  return (
    <AdminPageShell
      eyebrow="First-party analytics"
      code="EVT"
      title="Event"
      italic="explorer."
      description="Live, owned product analytics — every tracked event in your own database. No third party, no limits."
      actions={
        <button onClick={() => setLive((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white">
          <Radio className={cn("h-3 w-3", live && "animate-pulse")} style={live ? { color: ACCENT_HSL } : undefined} />
          {live ? "Live" : "Paused"}
        </button>
      }
      stats={[
        { label: "Distinct events", value: counts.length.toLocaleString(), tone: "neutral" },
        { label: "Hits · 7d", value: totalHits.toLocaleString(), tone: "blue" },
        { label: "Peak actors", value: totalActors.toLocaleString(), tone: "emerald" },
        { label: "In feed", value: feed.length.toLocaleString(), tone: "amber" },
      ]}
    >
      {error ? (
        <State kind="error" title="Couldn't load analytics events" hint={error} />
      ) : loading ? (
        <State kind="loading" title="Loading events…" />
      ) : counts.length === 0 && feed.length === 0 ? (
        <State kind="empty" title="No events tracked yet" hint="Browse the app to generate some — they appear here in real time." />
      ) : (
        <div className="space-y-14">
          <FloatSection title="Top events" meta="by hits · last 7 days">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evtFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={CYAN} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="event" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} cursor={{ fill: accent(0.08) }} />
                  <Bar dataKey="hits" radius={[6, 6, 0, 0]} fill="url(#evtFill)" isAnimationActive animationDuration={900}>
                    {chart.map((c) => <Cell key={c.event} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FloatSection>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.1fr_1fr]">
            <FloatSection title="Events" meta="last 7 days">
              <FloatTable
                columns={[
                  { key: "event", label: "Event" },
                  { key: "hits", label: "Hits", align: "right" },
                  { key: "actors", label: "Actors", align: "right" },
                ]}
                rows={[...counts].sort((a, b) => Number(b.hits) - Number(a.hits)).map((c, i) => ({
                  _key: c.event + i,
                  event: <span className="font-mono text-[13px] text-white/90">{c.event}</span>,
                  hits: <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(c.hits).toLocaleString()}</span>,
                  actors: <span className="tabular-nums text-white/60">{Number(c.actors).toLocaleString()}</span>,
                }))}
                empty="No events tracked yet — browse the app to generate some."
              />
            </FloatSection>

            <FloatSection title="Live feed" meta={live ? "auto-refreshing" : "paused"}>
              <div className="max-h-[520px] space-y-0.5 overflow-y-auto">
                {feed.length === 0 && <div className="px-3 py-10 text-center text-[13px] font-light text-white/40">Waiting for events…</div>}
                {feed.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT_HSL, boxShadow: `0 0 8px ${accent(0.8)}` }} />
                    <span className="font-mono text-[12px] text-white/90">{e.name}</span>
                    <span className="truncate font-mono text-[11px] text-white/35">{e.path}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-white/40">{actor(e)}</span>
                    <span className="shrink-0 font-mono text-[10px] text-white/30">{ago(e.occurred_at)}</span>
                  </div>
                ))}
              </div>
            </FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
