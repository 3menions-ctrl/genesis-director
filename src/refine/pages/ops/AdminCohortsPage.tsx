/**
 * Cohorts & Acquisition — real signup analytics.
 *
 * The previous version queried activated_at / converted_at columns that DO NOT
 * exist on signup_analytics, so the query 400'd, the error was swallowed, and
 * the page always showed "no data" over real signups. signup_analytics actually
 * carries acquisition data — geography + UTM attribution + referrer + timing —
 * so this is now a real acquisition view: daily signup cohort, conversion to a
 * paid tier (joined from profiles), and breakdowns by source / country / referrer.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Users } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

function groupTop(rows: Row[], key: string, fallback: string, paid: Set<string>, limit = 8) {
  const m = new Map<string, { label: string; signups: number; paid: number }>();
  for (const r of rows) {
    const label = (r[key] && String(r[key]).trim()) || fallback;
    const g = m.get(label) ?? { label, signups: 0, paid: 0 };
    g.signups++;
    if (paid.has(r.user_id)) g.paid++;
    m.set(label, g);
  }
  return [...m.values()].sort((a, b) => b.signups - a.signups).slice(0, limit);
}

/** Inline loading / error / empty state used inside the shell body. */
function State({ kind, title, hint }: { kind: "loading" | "error" | "empty"; title: string; hint?: string }) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : Users;
  const color = kind === "error" ? "hsl(350 90% 70%)" : "rgba(255,255,255,0.25)";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Icon className={`h-7 w-7 ${kind === "loading" ? "animate-spin" : ""}`} style={{ color }} />
      <p className="text-[15px] text-white/70">{title}</p>
      {hint && <p className="max-w-md text-[12px] text-white/40">{hint}</p>}
    </div>
  );
}

export default function AdminCohortsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const { data, error: e } = await supabase
        .from("signup_analytics")
        .select("user_id, created_at, country, utm_source, utm_medium, utm_campaign, referrer")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (e) { setError(e.message); setLoading(false); return; }
      const list = (data as Row[]) ?? [];
      setRows(list);

      // "Converted" = a signup whose user is now on a paid tier (real join).
      const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean)));
      if (ids.length) {
        const paid = new Set<string>();
        for (let i = 0; i < ids.length; i += 300) {
          const { data: profs } = await supabase.from("profiles").select("id, account_tier").in("id", ids.slice(i, i + 300));
          for (const p of (profs as Row[]) ?? []) if ((p.account_tier || "free") !== "free") paid.add(p.id);
        }
        setPaidIds(paid);
      }
      setLoading(false);
    })();
  }, []);

  const daily = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) { const d = String(r.created_at).slice(0, 10); m.set(d, (m.get(d) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, signups]) => ({ day: day.slice(5), signups }));
  }, [rows]);

  const bySource = useMemo(() => groupTop(rows, "utm_source", "Direct / none", paidIds), [rows, paidIds]);
  const byCountry = useMemo(() => groupTop(rows, "country", "Unknown", paidIds), [rows, paidIds]);
  const byReferrer = useMemo(() => groupTop(rows, "referrer", "Direct", paidIds), [rows, paidIds]);

  const totalSignups = rows.length;
  const converted = rows.filter((r) => paidIds.has(r.user_id)).length;
  const countries = new Set(rows.map((r) => r.country).filter(Boolean)).size;
  const topSource = bySource[0]?.label ?? "—";

  const tbl = (data: { label: string; signups: number; paid: number }[]) => (
    <FloatTable
      columns={[
        { key: "label", label: "Channel" },
        { key: "signups", label: "Signups", align: "right" },
        { key: "paid", label: "Paid", align: "right" },
        { key: "rate", label: "Conv.", align: "right" },
      ]}
      rows={data.map((g, i) => ({
        _key: g.label + i,
        label: <span className="block max-w-[16rem] truncate text-white/80">{g.label}</span>,
        signups: <span className="text-white">{g.signups.toLocaleString()}</span>,
        paid: <span className="text-white/70">{g.paid.toLocaleString()}</span>,
        rate: <span style={{ color: g.paid ? CYAN : "rgba(255,255,255,0.4)" }}>{g.signups ? `${Math.round((g.paid / g.signups) * 100)}%` : "—"}</span>,
      }))}
      empty="No signups in this window."
    />
  );

  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="COH"
      title="Cohorts"
      italic="& Acquisition."
      description="Where signups come from and whether they convert — daily cohort, source, geography and referrer (last 90 days)."
      stats={[
        { label: "Signups · 90d", value: totalSignups.toLocaleString(), tone: "blue" },
        { label: "Converted to paid", value: converted.toLocaleString(), tone: "emerald" },
        { label: "Conversion rate", value: totalSignups ? `${Math.round((converted / totalSignups) * 100)}%` : "—", tone: "amber" },
        { label: "Countries", value: countries.toLocaleString(), tone: "neutral", sub: `top src · ${topSource}` },
      ]}
    >
      {error ? (
        <State kind="error" title="Couldn't load signup analytics" hint={error} />
      ) : loading ? (
        <State kind="loading" title="Loading signups…" />
      ) : totalSignups === 0 ? (
        <State kind="empty" title="No signups in the last 90 days" hint="Acquisition appears here as users sign up." />
      ) : (
        <div className="space-y-14">
          <FloatSection title="Daily signups" meta="last 90 days">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cohFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cohStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} cursor={{ stroke: accent(0.4) }} />
                  <Area type="monotone" dataKey="signups" stroke="url(#cohStroke)" strokeWidth={2.5} fill="url(#cohFill)" dot={false} isAnimationActive animationDuration={1000} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </FloatSection>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="By source" meta="UTM attribution">{tbl(bySource)}</FloatSection>
            <FloatSection title="By country">{tbl(byCountry)}</FloatSection>
          </div>
          <FloatSection title="Top referrers">{tbl(byReferrer)}</FloatSection>
        </div>
      )}
    </AdminPageShell>
  );
}
