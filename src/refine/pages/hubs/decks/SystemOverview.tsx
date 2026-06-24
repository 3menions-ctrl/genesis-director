/**
 * SystemOverview — the "Command Deck" landing for /admin/system.
 *
 * Direction A, completely borderless: figures float on the page, lists are
 * separated only by a thin hairline, generous spacing. Wired to LIVE data —
 * `admin_db_diagnostics` (db size / connections / active queries / per-table
 * stats), `admin_storage_overview` (aggregate object storage),
 * `analytics_visitors_daily` (traffic), plus defensive count reads for
 * feature_flags / webhook_endpoints / org_api_keys. Renders embedded inside
 * the System hub shell (no own hero). Tolerates null/empty, never throws.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Database, HardDrive, Activity, Cpu, Webhook, KeyRound } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  FloatStat, FloatSection, FloatTable, FloatRow, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, accent,
} from "@/admin/ui/primitives";

type Row = Record<string, unknown>;
const num = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (typeof v === "number") return v; if (v != null && v !== "" && !isNaN(Number(v))) return Number(v); } return 0; };

const fmtBytes = (b: number) => {
  if (!b || b <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};
const humanize = (k: string) => k.replace(/_/g, " ").replace(/\bbytes\b/i, "(bytes)").replace(/\b\w/g, (c) => c.toUpperCase());

interface Diag { db_size_bytes?: number; connections?: number; active_queries?: number; tables?: unknown[]; [k: string]: unknown }
interface Counts { flags: number | null; webhooks: number | null; apiKeys: number | null }
const settledCount = (r: PromiseSettledResult<{ count: number | null; error: unknown }>) =>
  r.status === "fulfilled" && !r.value.error ? (r.value.count ?? 0) : null;

export default function SystemOverview() {
  const [diag, setDiag] = useState<Diag>({});
  const [storage, setStorage] = useState({ bytes: 0, objects: 0 });
  const [series, setSeries] = useState<{ day: string; pageviews: number; visitors: number; sessions: number }[]>([]);
  const [counts, setCounts] = useState<Counts>({ flags: null, webhooks: null, apiKeys: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(); since.setDate(since.getDate() - 14);
        const [diagRes, storageRes, trafficRes, flagsRes, hooksRes, keysRes] = await Promise.allSettled([
          supabase.rpc("admin_db_diagnostics" as never),
          supabase.rpc("admin_storage_overview" as never),
          supabase.rpc("analytics_visitors_daily" as never, { _since: since.toISOString() } as never),
          supabase.from("feature_flags" as never).select("id", { count: "exact", head: true }),
          supabase.from("webhook_endpoints" as never).select("id", { count: "exact", head: true }),
          supabase.from("org_api_keys" as never).select("id", { count: "exact", head: true }),
        ]);

        if (diagRes.status === "fulfilled" && diagRes.value?.data && typeof diagRes.value.data === "object") {
          setDiag(diagRes.value.data as Diag);
        }

        if (storageRes.status === "fulfilled" && Array.isArray(storageRes.value?.data)) {
          const rows = storageRes.value.data as Row[];
          setStorage({
            bytes: rows.reduce((a, b) => a + num(b, "total_bytes"), 0),
            objects: rows.reduce((a, b) => a + num(b, "object_count"), 0),
          });
        }

        if (trafficRes.status === "fulfilled" && Array.isArray(trafficRes.value?.data)) {
          const rows = trafficRes.value.data as Row[];
          setSeries(
            rows
              .map((d) => ({ ymd: String((d as Row)["day"]).slice(0, 10), pageviews: num(d, "pageviews"), visitors: num(d, "visitors"), sessions: num(d, "sessions") }))
              .filter((d) => d.ymd && d.ymd !== "null" && d.ymd !== "undefined")
              .map((d) => ({ day: d.ymd.slice(5), pageviews: d.pageviews, visitors: d.visitors, sessions: d.sessions })),
          );
        }

        setCounts({
          flags: settledCount(flagsRes as never),
          webhooks: settledCount(hooksRes as never),
          apiKeys: settledCount(keysRes as never),
        });
      } catch (e) {
        console.error("[SystemOverview] load", e);
      } finally { setLoading(false); }
    })();
  }, []);

  const connections = num(diag, "connections");
  const activeQueries = num(diag, "active_queries");
  const dbSize = num(diag, "db_size_bytes");
  const pageviews24h = series.length ? series[series.length - 1].pageviews : 0;
  const dash = (v: number | null) => (v == null ? "—" : v.toLocaleString());

  const kpis = useMemo(() => ([
    { label: "DB connections", value: connections, icon: Database },
    { label: "DB size", value: dbSize > 0 ? fmtBytes(dbSize) : "—", icon: HardDrive },
    { label: "Pageviews · 24h", value: pageviews24h, icon: Activity, delta: pageviews24h, deltaLabel: "today" },
    { label: "Active queries", value: activeQueries, icon: Cpu, accentNumber: true },
    { label: "Webhook endpoints", value: dash(counts.webhooks), icon: Webhook },
    { label: "Feature flags", value: dash(counts.flags), icon: KeyRound },
  ]), [connections, dbSize, pageviews24h, activeQueries, counts]);

  const services = useMemo(() => {
    const dbTone: "positive" | "warn" | "danger" = connections === 0 ? "warn" : connections < 80 ? "positive" : connections < 120 ? "warn" : "danger";
    const trafficTone: "positive" | "warn" = pageviews24h > 0 ? "positive" : "warn";
    return [
      { service: "Database", metric: connections > 0 ? `${connections} conn · ${activeQueries} active` : "—", tone: dbTone, status: dbTone === "positive" ? "operational" : dbTone === "warn" ? "degraded" : "saturated" },
      { service: "Object storage", metric: storage.bytes > 0 || storage.objects > 0 ? `${fmtBytes(storage.bytes)} · ${storage.objects.toLocaleString()} obj` : "—", tone: "positive" as const, status: "operational" },
      { service: "Traffic ingest", metric: `${pageviews24h.toLocaleString()} views · 24h`, tone: trafficTone, status: trafficTone === "positive" ? "operational" : "idle" },
      { service: "Feature flags", metric: counts.flags == null ? "—" : `${counts.flags} configured`, tone: "positive" as const, status: counts.flags == null ? "unavailable" : "operational" },
    ];
  }, [connections, activeQueries, storage, pageviews24h, counts.flags]);

  const diagRows = useMemo(() => {
    return Object.entries(diag).map(([k, v]) => {
      let val: string;
      if (k === "tables" && Array.isArray(v)) val = `${v.length} tracked`;
      else if (k === "db_size_bytes") val = fmtBytes(num(diag, "db_size_bytes"));
      else if (v == null) val = "—";
      else if (typeof v === "object") val = JSON.stringify(v);
      else val = String(v);
      return { key: humanize(k), val };
    });
  }, [diag]);

  return (
    <div className="space-y-14">
      {/* KPI rail — floating figures */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <FloatStat key={k.label} index={i} {...k} />)}
      </div>

      {/* Dominant trend — traffic */}
      <FloatSection title="Traffic" meta="last 14 days" actions={<DeckButton accent><Link to="/admin/db-health">DB health →</Link></DeckButton>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sysFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.55} />
                  <stop offset="50%" stopColor={CYAN} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sysStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
              <Area type="monotone" dataKey="pageviews" stroke="url(#sysStroke)" strokeWidth={2.5} fill="url(#sysFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </FloatSection>

      {/* Service status + raw diagnostics */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.55fr_1fr]">
        <FloatSection title="Service status" meta={loading ? "loading…" : "live"}>
          <FloatTable
            columns={[
              { key: "service", label: "Service" },
              { key: "metric", label: "Metric" },
              { key: "status", label: "Status", align: "right" },
            ]}
            rows={services.map((s) => ({
              _key: s.service,
              service: <span className="font-medium text-white">{s.service}</span>,
              metric: <span className="font-mono text-[11.5px] text-white/55">{s.metric}</span>,
              status: <StatusPill tone={s.tone}>{s.status}</StatusPill>,
            }))}
          />
        </FloatSection>

        <FloatSection title="Diagnostics" meta={diagRows.length ? `${diagRows.length} metrics` : undefined}>
          <div>
            {diagRows.length === 0 && (
              <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">
                {loading ? "loading…" : "No diagnostics available."}
              </div>
            )}
            {diagRows.map((d, i) => (
              <FloatRow key={d.key} last={i === diagRows.length - 1}
                left={<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">{d.key}</span>}
                right={<span className="font-mono text-[12px] tabular-nums text-white">{d.val}</span>}
              />
            ))}
          </div>
        </FloatSection>
      </div>
    </div>
  );
}
