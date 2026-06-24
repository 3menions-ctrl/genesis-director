/**
 * ProductionOverview — the "Command Deck" landing for /admin/production.
 *
 * Direction A, completely borderless: figures float on the page, lists are
 * separated only by a thin hairline, generous spacing. Wired to LIVE data —
 * `admin_dashboard_pulse` for the headline figures plus direct admin-gated
 * table reads (movie_projects / stitch_jobs) for the trend + lists.
 * Renders embedded inside the Production hub shell (no own hero).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle2, AlertTriangle, FolderKanban, Plus, Layers } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  FloatStat, FloatSection, FloatTable, FloatRow, Avatar, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, accent,
} from "@/admin/ui/primitives";

type Row = Record<string, unknown>;
const str = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v != null && v !== "") return String(v); } return ""; };
const num = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (typeof v === "number") return v; if (v != null && !isNaN(Number(v))) return Number(v); } return 0; };
const ago = (iso?: string) => {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

interface Pulse { projects: { total: number; completed: number; failed: number; in_flight: number; created_24h: number } }

export default function ProductionOverview() {
  const [pulse, setPulse] = useState<Pulse>({ projects: { total: 0, completed: 0, failed: 0, in_flight: 0, created_24h: 0 } });
  const [queueDepth, setQueueDepth] = useState(0);
  const [series, setSeries] = useState<{ day: string; renders: number }[]>([]);
  const [recent, setRecent] = useState<Row[]>([]);
  const [failed, setFailed] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);
        const [pulseRes, recentRes, failedRes, trendRes, queueRes] = await Promise.all([
          supabase.rpc("admin_dashboard_pulse" as never),
          supabase.from("movie_projects").select("*").order("created_at", { ascending: false }).limit(8),
          supabase.from("movie_projects").select("*").eq("status", "failed").order("created_at", { ascending: false }).limit(6),
          supabase.from("movie_projects").select("created_at").gte("created_at", since.toISOString()),
          supabase.from("stitch_jobs").select("id", { count: "exact", head: true }).in("status", ["queued", "running", "pending"]),
        ]);

        if (pulseRes.data) setPulse(pulseRes.data as unknown as Pulse);
        setRecent((recentRes.data as Row[]) ?? []);
        setFailed((failedRes.data as Row[]) ?? []);

        // Queue depth — fall back to total count if the status filter errors.
        if (queueRes.error || queueRes.count == null) {
          const total = await supabase.from("stitch_jobs").select("id", { count: "exact", head: true });
          setQueueDepth(total.count ?? 0);
        } else {
          setQueueDepth(queueRes.count ?? 0);
        }

        const buckets = new Map<string, number>();
        for (let i = 0; i < 14; i++) { const d = new Date(since); d.setDate(since.getDate() + i); buckets.set(d.toISOString().slice(0, 10), 0); }
        for (const r of (trendRes.data as { created_at: string }[]) ?? []) {
          const k = new Date(r.created_at).toISOString().slice(0, 10);
          if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
        }
        setSeries([...buckets.entries()].map(([k, v]) => ({ day: k.slice(5), renders: v })));
      } catch (e) {
        console.error("[ProductionOverview] load", e);
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: "In flight", value: pulse.projects.in_flight, icon: Activity },
    { label: "Completed", value: pulse.projects.completed, icon: CheckCircle2 },
    { label: "Failed", value: pulse.projects.failed, icon: AlertTriangle },
    { label: "Total projects", value: pulse.projects.total, icon: FolderKanban },
    { label: "Created · 24h", value: pulse.projects.created_24h, icon: Plus, accentNumber: true },
    { label: "Queue depth", value: queueDepth, icon: Layers },
  ]), [pulse, queueDepth]);

  return (
    <div className="space-y-14">
      {/* KPI rail — floating figures */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <FloatStat key={k.label} index={i} {...k} />)}
      </div>

      {/* Dominant trend */}
      <FloatSection title="Renders" meta="last 14 days" actions={<DeckButton accent><Link to="/admin/queue">Open queue →</Link></DeckButton>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.55} />
                  <stop offset="50%" stopColor={CYAN} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="prodStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
              <Area type="monotone" dataKey="renders" stroke="url(#prodStroke)" strokeWidth={2.5} fill="url(#prodFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </FloatSection>

      {/* Recent renders + failed renders */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.55fr_1fr]">
        <FloatSection title="Recent renders" meta={loading ? "loading…" : `${recent.length} shown`}>
          <FloatTable
            columns={[
              { key: "project", label: "Project" },
              { key: "engine", label: "Engine" },
              { key: "status", label: "Status" },
              { key: "created", label: "Created", align: "right" },
            ]}
            rows={recent.map((p) => {
              const title = str(p, "title", "name", "prompt") || "Untitled";
              const display = title.length > 48 ? `${title.slice(0, 48)}…` : title;
              const status = str(p, "status") || "—";
              const tone = status === "completed" ? "positive" : status === "failed" ? "danger" : status === "draft" ? "neutral" : "accent";
              return {
                _key: str(p, "id"),
                project: <span className="inline-flex items-center gap-2.5"><Avatar name={title} /><span className="truncate font-medium text-white">{display}</span></span>,
                engine: <span className="font-mono text-[11.5px] text-white/55">{str(p, "engine", "model", "provider") || "—"}</span>,
                status: <StatusPill tone={tone}>{status}</StatusPill>,
                created: <span className="text-white/50">{ago(str(p, "created_at"))}</span>,
              };
            })}
          />
        </FloatSection>

        <FloatSection title="Failed renders" meta={`${failed.length} shown`} actions={<DeckButton accent><Link to="/admin/queue">All failures →</Link></DeckButton>}>
          <div>
            {failed.length === 0 && <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No failed renders.</div>}
            {failed.map((p, i) => {
              const title = str(p, "title", "name", "prompt") || "Untitled";
              return (
                <FloatRow key={str(p, "id") || i} last={i === failed.length - 1}
                  left={<span className="inline-flex items-center gap-2.5"><Avatar name={title} /><span className="truncate font-medium text-white">{title.length > 40 ? `${title.slice(0, 40)}…` : title}</span></span>}
                  right={<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">{ago(str(p, "created_at"))}</span>}
                />
              );
            })}
          </div>
        </FloatSection>
      </div>
    </div>
  );
}
