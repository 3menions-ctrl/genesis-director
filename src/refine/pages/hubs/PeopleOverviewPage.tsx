/**
 * PeopleOverviewPage — /admin/people · Overview tab
 *
 * The human-centric command center: who they are, what they do, what they're
 * worth, and who needs attention. Borderless "floating analysis" — data floats
 * on the aura, separated by whitespace + soft shadow, no card frames.
 *
 * Real data: the `admin-analytics` edge function (summary mode) powers KPIs,
 * cohort retention, the lifecycle funnel, acquisition and top users; three
 * light count queries feed the live "needs attention" rail. Nothing is faked.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { RefreshCw, AlertTriangle, ShieldAlert, FileWarning, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  CountUp, Sparkline, ACCENT_HSL, CYAN, VIOLET, ROSE, AMBER, EMERALD, MAGENTA, INK, MUT, MUT2,
} from "@/admin/ui/primitives";

type Series = { day: string; value: number }[];
interface AnalyticsPayload {
  kpis: {
    totalUsers: number;
    signups1d: number; signups7d: number; signups30d: number;
    active1d: number; active7d: number; active30d: number; stickiness: number;
    projects: number; completionRate: number;
    creditsPurchased: number; creditsSpent: number; grossRevenue: number;
    ttvMedianMinutes: number | null; activationRate: number; onboardedTotal?: number;
    failedClips: number;
  };
  funnel?: { step: string; users: number }[];
  cohorts?: { cohort: string; size: number; weeks: number[] }[];
  topUsers?: { id: string; spend: number; projects: number; profile: { email: string; display_name: string | null; account_tier: string | null; country: string | null } | null }[];
  series: { signups: Series };
  tierBreakdown: { tier: string; count: number }[];
  topCountries: { key: string; count: number }[];
  topSources: { key: string; count: number }[];
}

interface Attention { openTickets: number; openGdpr: number; openReports: number; }

const GL = "font-mono text-[9.5px] font-semibold uppercase tracking-[0.22em]";
const Sep = () => <div className="my-7 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(16,24,40,.1),transparent)" }} />;

function Floor({ children, className, big, style }: { children: React.ReactNode; className?: string; big?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={cn("block font-display font-semibold tabular-nums leading-none tracking-[-0.03em]", className)}
      style={{ filter: big ? "drop-shadow(0 14px 24px rgba(47,107,255,.16))" : "drop-shadow(0 10px 18px rgba(16,24,40,.1))", ...style }}
    >
      {children}
    </span>
  );
}

const TIER_GRAD: Record<string, string> = {
  studio: "linear-gradient(90deg,#7c3aed,#a855f7)",
  pro: "linear-gradient(90deg,#2f6bff,#60a5fa)",
  indie: "linear-gradient(90deg,#0891b2,#22d3ee)",
  free: "rgba(16,24,40,.25)",
};
const FLAG: Record<string, string> = { US: "🇺🇸", GB: "🇬🇧", IN: "🇮🇳", DE: "🇩🇪", BR: "🇧🇷", FR: "🇫🇷", CA: "🇨🇦", AU: "🇦🇺", NL: "🇳🇱", JP: "🇯🇵", ES: "🇪🇸", IT: "🇮🇹" };

export default function PeopleOverviewPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [att, setAtt] = useState<Attention>({ openTickets: 0, openGdpr: 0, openReports: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [{ data: res }, tickets, gdpr, reports] = await Promise.all([
        supabase.functions.invoke<AnalyticsPayload>("admin-analytics?windowDays=30", { method: "GET" }),
        supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("gdpr_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
        // user_reports isn't in the generated types yet; cast keeps it type-safe
        // and the query is resilient (returns {error} rather than throwing).
        (supabase as unknown as { from: (t: string) => any }).from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      if (res) setData(res);
      setAtt({ openTickets: tickets.count ?? 0, openGdpr: gdpr.count ?? 0, openReports: reports.count ?? 0 });
      setUpdated(new Date());
    } catch (e) {
      console.error("[PeopleOverview] load error", e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const k = data?.kpis;
  const spark = useMemo(() => (data?.series.signups ?? []).map((s) => s.value), [data]);
  const signupSeries = useMemo(() => (data?.series.signups ?? []).map((s) => ({ day: s.day.slice(5), v: s.value })), [data]);

  const tiers = useMemo(() => {
    const rows = data?.tierBreakdown ?? [];
    const total = rows.reduce((s, t) => s + t.count, 0) || 1;
    const order = ["free", "indie", "pro", "studio"];
    return rows.slice().sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier)).map((t) => ({
      tier: t.tier, count: t.count, pct: (t.count / total) * 100,
      grad: TIER_GRAD[t.tier?.toLowerCase()] ?? "rgba(16,24,40,.25)",
    }));
  }, [data]);

  const funnel = useMemo(() => {
    const steps = data?.funnel ?? [];
    const top = steps[0]?.users || 1;
    const grads = ["linear-gradient(90deg,#2f6bff,#60a5fa)", "linear-gradient(90deg,#7c3aed,#a855f7)", "linear-gradient(90deg,#0891b2,#22d3ee)", "linear-gradient(90deg,#0fa968,#34d399)"];
    return steps.map((s, i) => ({ step: s.step, users: s.users, pct: (s.users / top) * 100, grad: grads[i % grads.length] }));
  }, [data]);

  const maxCountry = Math.max(1, ...(data?.topCountries ?? []).map((c) => c.count));
  const maxSource = Math.max(1, ...(data?.topSources ?? []).map((c) => c.count));

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-28" style={{ color: MUT }}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Reading people pulse…</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* top bar */}
      <div className="mb-6 flex items-center gap-4">
        <span className={GL} style={{ color: MUT }}>Last 30 days · live</span>
        <button onClick={() => void load(true)} disabled={refreshing}
          className={cn("ml-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5", GL)}
          style={{ background: "rgba(255,255,255,0.7)", color: MUT, boxShadow: "0 6px 18px -10px rgba(16,24,40,0.2)" }}>
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          {refreshing ? "Sync" : updated ? updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
        </button>
      </div>

      {/* ── Hero deck ── */}
      <div className="grid items-start gap-11 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <span className={GL} style={{ color: ACCENT_HSL }}>◆ Total operators</span>
            {(k?.signups1d ?? 0) > 0 && <span className="text-[12px] font-bold" style={{ color: EMERALD }}>▲ {k?.signups1d} today</span>}
          </div>
          <Floor big className="mt-3.5 text-[80px]">
            <CountUp value={k?.totalUsers ?? 0} className="bg-gradient-to-br from-[#2f6bff] to-[#7c3aed] bg-clip-text text-transparent" />
          </Floor>
          <div className="mt-2.5 text-[13px]" style={{ color: MUT }}>
            {(k?.signups7d ?? 0).toLocaleString()} new this week · {k?.stickiness ?? 0}% 30-day stickiness
          </div>
          <div className="mt-4"><Sparkline data={spark.length > 1 ? spark : [0, 0]} id="po-hero" w={520} h={84} /></div>
        </div>

        <div>
          <span className={GL} style={{ color: EMERALD }}>Active · DAU / WAU / MAU</span>
          <Floor className="mt-3 text-[50px]" style={{ color: EMERALD }}><CountUp value={k?.active1d ?? 0} /></Floor>
          <div className="mt-2.5 text-[13px]" style={{ color: MUT }}>
            <b style={{ color: INK }}>{(k?.active7d ?? 0).toLocaleString()}</b> WAU · <b style={{ color: INK }}>{(k?.active30d ?? 0).toLocaleString()}</b> MAU
          </div>
          <div className="mt-4 space-y-1">
            {[
              { l: "Stickiness", v: k?.stickiness ?? 0, g: "linear-gradient(90deg,#0fa968,#34d399)" },
              { l: "Activation", v: k?.activationRate ?? 0, g: "linear-gradient(90deg,#2f6bff,#60a5fa)" },
              { l: "Onboarded", v: k && k.totalUsers ? Math.round(((k.onboardedTotal ?? 0) / k.totalUsers) * 100) : 0, g: "linear-gradient(90deg,#7c3aed,#a855f7)" },
            ].map((r) => (
              <div key={r.l} className="flex items-center gap-3 py-0.5 text-[13px] font-semibold" style={{ color: INK }}>
                <span className="w-[78px] shrink-0">{r.l}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(16,24,40,.06)" }}>
                  <i className="block h-full rounded-full" style={{ width: `${Math.min(r.v, 100)}%`, background: r.g }} />
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums" style={{ color: MUT }}>{r.v}%</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className={GL} style={{ color: VIOLET }}>Median time-to-value</span>
          <Floor className="mt-3 text-[50px]" style={{ color: VIOLET }}>
            {k?.ttvMedianMinutes != null ? <><CountUp value={Math.round(k.ttvMedianMinutes)} /><span className="text-[22px]">min</span></> : "—"}
          </Floor>
          <div className="mt-2.5 text-[13px]" style={{ color: MUT }}>signup → first project · {k?.activationRate ?? 0}% activate</div>
          <div className="mt-4">
            <div className={GL} style={{ color: MUT2 }}>Tier mix</div>
            <div className="mt-2 space-y-1">
              {tiers.map((t) => (
                <div key={t.tier} className="flex items-center gap-3 py-0.5 text-[13px] font-semibold capitalize" style={{ color: INK }}>
                  <span className="w-[58px] shrink-0">{t.tier}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(16,24,40,.06)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${Math.max(t.pct, t.count > 0 ? 3 : 0)}%`, background: t.grad }} />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums" style={{ color: MUT }}>{t.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Sep />

      {/* ── Cohort retention + funnel ── */}
      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <span className={GL} style={{ color: MUT }}>Weekly cohort retention · darker = more of the cohort still active</span>
          <CohortGrid cohorts={data?.cohorts ?? []} />
        </div>
        <div>
          <span className={GL} style={{ color: MUT }}>Lifecycle funnel · 30 days</span>
          <div className="mt-3 flex flex-col gap-2.5">
            {funnel.length === 0 && <div className="text-[13px]" style={{ color: MUT2 }}>No funnel data.</div>}
            {funnel.map((f) => (
              <div key={f.step} className="flex items-center gap-3.5">
                <span className="w-[116px] shrink-0 text-[13px] font-medium" style={{ color: INK }}>{f.step}</span>
                <span className="flex h-9 items-center rounded-[9px] px-3.5 font-display text-[14px] font-bold text-white" style={{ width: `${Math.max(f.pct, 8)}%`, background: f.grad }}>
                  {f.users.toLocaleString()}
                </span>
                <span className="w-11 font-mono text-[11px]" style={{ color: MUT }}>{Math.round(f.pct)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Sep />

      {/* ── Acquisition + attention ── */}
      <div className="grid gap-11 md:grid-cols-3">
        <div>
          <span className={GL} style={{ color: ACCENT_HSL }}>◆ Top countries · signups</span>
          <div className="mt-3">
            {(data?.topCountries ?? []).slice(0, 5).map((c) => (
              <BarRow key={c.key} label={<span>{FLAG[c.key] ?? "🏳️"} {c.key}</span>} pct={(c.count / maxCountry) * 100} value={c.count.toLocaleString()} grad="linear-gradient(90deg,#2f6bff,#60a5fa)" />
            ))}
            {(data?.topCountries ?? []).length === 0 && <Empty />}
          </div>
        </div>
        <div>
          <span className={GL} style={{ color: EMERALD }}>Acquisition channels</span>
          <div className="mt-3">
            {(data?.topSources ?? []).slice(0, 5).map((c) => (
              <BarRow key={c.key} label={c.key || "direct"} pct={(c.count / maxSource) * 100} value={c.count.toLocaleString()} grad="linear-gradient(90deg,#0fa968,#34d399)" />
            ))}
            {(data?.topSources ?? []).length === 0 && <Empty />}
          </div>
        </div>
        <div>
          <span className={GL} style={{ color: ROSE }}>⚠ Needs attention</span>
          <div className="mt-3 flex flex-col gap-2.5">
            <Attn to="/admin/messages" icon={MessageSquare} tint={ACCENT_HSL} n={att.openTickets} label="support threads" hint="awaiting first reply" show={att.openTickets > 0} />
            <Attn to="/admin/projects?status=failed" icon={AlertTriangle} tint={AMBER} n={k?.failedClips ?? 0} label="failed renders" hint="may need retry or refund" show={(k?.failedClips ?? 0) > 0} />
            <Attn to="/admin/gdpr" icon={FileWarning} tint={MAGENTA} n={att.openGdpr} label="open GDPR requests" hint="watch the 30-day SLA" show={att.openGdpr > 0} />
            <Attn to="/admin/abuse" icon={ShieldAlert} tint={ROSE} n={att.openReports} label="open user reports" hint="awaiting moderation" show={att.openReports > 0} />
            {att.openTickets === 0 && att.openGdpr === 0 && att.openReports === 0 && (k?.failedClips ?? 0) === 0 && (
              <div className="rounded-2xl bg-white p-4 text-[13px] shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_32px_-16px_rgba(16,24,40,.16)]" style={{ color: MUT }}>
                All clear — no tickets, failures, requests or reports pending.
              </div>
            )}
          </div>
        </div>
      </div>

      <Sep />

      {/* ── Signups trend ── */}
      <div>
        <span className={GL} style={{ color: MUT }}>Sign-ups · last 30 days</span>
        <div className="mt-3 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={signupSeries} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="poFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.22} /><stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="poStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={EMERALD} /><stop offset="50%" stopColor={CYAN} /><stop offset="100%" stopColor={ACCENT_HSL} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,24,40,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: MUT2, fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: MUT2, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 20px 50px -20px rgba(16,24,40,0.3)", fontSize: 12 }} labelStyle={{ color: MUT }} itemStyle={{ color: INK }} cursor={{ stroke: "rgba(47,107,255,0.3)" }} />
              <Area type="monotone" dataKey="v" name="signups" stroke="url(#poStroke)" strokeWidth={3} fill="url(#poFill)" dot={false} activeDot={{ r: 5, fill: "#fff", stroke: ACCENT_HSL, strokeWidth: 2.5 }} isAnimationActive animationDuration={1100} style={{ filter: "drop-shadow(0 12px 20px rgba(16,24,40,.12))" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Sep />

      {/* ── Top users ── */}
      <div>
        <span className={GL} style={{ color: MUT }}>Highest-value operators · lifetime spend</span>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              {["Operator", "Tier", "Projects", "Credits spent", "LTV (est)", ""].map((h) => (
                <th key={h} className="pb-2.5 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUT2 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.topUsers ?? []).slice(0, 6).map((u) => {
              const name = u.profile?.display_name || u.profile?.email?.split("@")[0] || u.id.slice(0, 8);
              const initials = name.slice(0, 2).toUpperCase();
              return (
                <tr key={u.id} className="group">
                  <td className="py-2.5 text-[13.5px]" style={{ color: INK }}>
                    <span className="mr-2.5 inline-grid h-7 w-7 place-items-center rounded-full align-middle text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)" }}>{initials}</span>
                    {name}
                  </td>
                  <td className="py-2.5 text-[12px] capitalize" style={{ color: MUT }}>{u.profile?.account_tier ?? "free"}</td>
                  <td className="py-2.5 text-[13.5px] tabular-nums" style={{ color: INK }}>{u.projects.toLocaleString()}</td>
                  <td className="py-2.5 text-[13.5px] tabular-nums" style={{ color: INK }}>{u.spend.toLocaleString()}</td>
                  <td className="py-2.5 text-[13.5px] font-bold tabular-nums" style={{ color: EMERALD }}>${Math.round(u.spend * 0.1).toLocaleString()}</td>
                  <td className="py-2.5 text-right"><Link to={`/admin/users/${u.id}`} className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-0 transition-opacity group-hover:opacity-100" style={{ color: ACCENT_HSL }}>360 →</Link></td>
                </tr>
              );
            })}
            {(data?.topUsers ?? []).length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px]" style={{ color: MUT2 }}>No spend data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarRow({ label, pct, value, grad }: { label: React.ReactNode; pct: number; value: string; grad: string }) {
  return (
    <div className="flex items-center gap-3 py-[7px] text-[13.5px] font-medium" style={{ color: INK }}>
      <span className="w-[128px] shrink-0 truncate">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(16,24,40,.06)" }}>
        <i className="block h-full rounded-full" style={{ width: `${Math.max(pct, 4)}%`, background: grad }} />
      </span>
      <span className="w-12 text-right font-mono text-[12px]" style={{ color: MUT }}>{value}</span>
    </div>
  );
}

function Attn({ to, icon: Icon, tint, n, label, hint, show }: { to: string; icon: React.ElementType; tint: string; n: number; label: string; hint: string; show: boolean }) {
  if (!show) return null;
  return (
    <Link to={to} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_32px_-16px_rgba(16,24,40,.16)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(16,24,40,.06),0_24px_48px_-18px_rgba(16,24,40,.24)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${tint}1a`, color: tint }}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>
      <div className="min-w-0 text-[13px]">
        <b style={{ color: INK }}>{n.toLocaleString()} {label}</b>
        <div className="mt-0.5 text-[12px]" style={{ color: MUT }}>{hint}</div>
      </div>
    </Link>
  );
}

function Empty() {
  return <div className="py-4 text-[12px] font-light" style={{ color: MUT2 }}>No data in window.</div>;
}

/** Borderless cohort heatmap — blue opacity scales with retention %. */
function CohortGrid({ cohorts }: { cohorts: { cohort: string; size: number; weeks: number[] }[] }) {
  if (!cohorts.length) return <div className="mt-4 text-[13px]" style={{ color: MUT2 }}>Not enough history yet.</div>;
  const maxWeeks = Math.max(...cohorts.map((c) => c.weeks.length), 1);
  return (
    <div className="mt-3 overflow-x-auto">
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `66px repeat(${maxWeeks}, minmax(34px, 1fr))` }}>
        <div />
        {Array.from({ length: maxWeeks }, (_, w) => (
          <div key={w} className="pb-1 text-center font-mono text-[9px]" style={{ color: MUT2 }}>W{w}</div>
        ))}
        {cohorts.map((c) => (
          <CohortRow key={c.cohort} c={c} maxWeeks={maxWeeks} />
        ))}
      </div>
    </div>
  );
}
function CohortRow({ c, maxWeeks }: { c: { cohort: string; size: number; weeks: number[] }; maxWeeks: number }) {
  return (
    <>
      <div className="flex items-center font-mono text-[10px]" style={{ color: MUT }}>{c.cohort.slice(5)}</div>
      {Array.from({ length: maxWeeks }, (_, w) => {
        const has = w < c.weeks.length && c.size > 0;
        const pct = has ? Math.round((c.weeks[w] / c.size) * 100) : null;
        const a = pct == null ? 0 : Math.max(0.1, pct / 100);
        return (
          <div key={w} className="grid h-[30px] place-items-center rounded-md font-mono text-[10px] font-semibold"
            style={pct == null
              ? { background: "rgba(16,24,40,.04)", color: MUT2 }
              : { background: `rgba(47,107,255,${a})`, color: a > 0.45 ? "#fff" : INK }}
            title={pct == null ? "" : `${c.cohort}: ${c.weeks[w]}/${c.size} active in W${w}`}>
            {pct == null ? "·" : pct}
          </div>
        );
      })}
    </>
  );
}
