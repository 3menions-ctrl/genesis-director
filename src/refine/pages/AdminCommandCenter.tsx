/**
 * AdminCommandCenter — /admin index, "Horizon" spatial overview.
 *
 * A redesign of the admin landing in the spatial-glass direction: a floating
 * capsule header, one giant gradient hero metric over a live trend wave, four
 * widely-spaced floating "orbs", and two large airy panels (Signals + Hubs).
 *
 * DATA: identical path to the previous AdminDashboardPage — one
 * `admin_dashboard_pulse` RPC (with a parallel-count fallback) plus a real
 * 14-day signups series bucketed client-side. Every figure is real and
 * defensive (tolerates the RPC being absent / tables empty). No fabricated
 * revenue or activity feed — those need the ledger / realtime wiring tracked
 * for a later phase.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Coins, FolderKanban, MessageSquare, RefreshCw,
  Sparkles, TrendingUp, Users, Wallet, Zap, Search, type LucideIcon,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ACCENT_HSL, CYAN, VIOLET } from "@/admin/ui/primitives";

// ── Scoped styling (injected once). Mirrors the "Horizon" mockup using the
//    same design tokens already in the admin (accent / cyan / violet glass). ──
const CC_CSS = `
.cc-atmos{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.cc-bloom{position:absolute;border-radius:9999px;filter:blur(110px)}
.cc-b1{top:-280px;left:-60px;width:720px;height:720px;background:radial-gradient(closest-side,hsl(214 92% 64%/.28),transparent 70%);animation:ccA 26s ease-in-out infinite}
.cc-b2{top:-180px;right:-80px;width:620px;height:620px;background:radial-gradient(closest-side,hsl(188 95% 62%/.18),transparent 70%);animation:ccB 32s ease-in-out infinite}
.cc-b3{top:440px;left:40%;width:760px;height:760px;background:radial-gradient(closest-side,hsl(258 90% 74%/.14),transparent 70%);animation:ccC 36s ease-in-out infinite}
@keyframes ccA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,30px) scale(1.07)}}
@keyframes ccB{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-46px,20px) scale(.95)}}
@keyframes ccC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-30px) scale(1.05)}}
@media (prefers-reduced-motion:reduce){.cc-bloom{animation:none!important}}
@keyframes spin{to{transform:rotate(360deg)}}
.cc-wrap{position:relative;z-index:1}
.cc-kbd{font-family:'Roboto Mono',monospace;font-size:10px;color:rgba(255,255,255,.45);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:2px 6px;margin-left:4px}
.cc-glass{position:relative;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.018) 60%);
  box-shadow:0 46px 130px -55px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.13);backdrop-filter:blur(32px)}
.cc-cap{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 14px 12px 22px;border-radius:9999px;
  background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02));
  box-shadow:0 30px 80px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.16);backdrop-filter:blur(30px)}
.cc-dot{width:26px;height:26px;border-radius:9999px;background:radial-gradient(circle at 32% 28%,#fff,${ACCENT_HSL} 60%,hsl(214 92% 40%));box-shadow:0 0 22px hsl(214 92% 64%/.7)}
.cc-seg{display:inline-flex;gap:4px;background:rgba(255,255,255,.05);border-radius:9999px;padding:5px}
.cc-seg button{padding:7px 16px;border-radius:9999px;font-size:12px;color:rgba(255,255,255,.5);background:none;border:0;cursor:pointer;font-family:inherit}
.cc-seg button.on{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.cc-grad{background:linear-gradient(98deg,#fff 6%,hsl(214 92% 80%) 48%,hsl(188 95% 74%) 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.cc-mega{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:104px;line-height:.92;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
.cc-orb{position:relative;border-radius:26px;padding:26px 26px 24px;overflow:hidden;background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.015) 60%);
  box-shadow:0 44px 120px -55px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(28px)}
.cc-aura{position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:9999px;filter:blur(36px);opacity:.5}
.cc-n{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:44px;line-height:1;letter-spacing:-.02em;color:#fff;font-variant-numeric:tabular-nums}
.cc-lab{font-family:'Roboto Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:rgba(255,255,255,.46)}
.cc-pillbtn{display:inline-flex;align-items:center;gap:9px;padding:10px 18px;border-radius:9999px;font-size:12.5px;color:rgba(255,255,255,.9);background:rgba(255,255,255,.05);box-shadow:inset 0 1px 0 rgba(255,255,255,.1);border:0;cursor:pointer;font-family:inherit}
.cc-sig{display:flex;align-items:center;gap:16px;padding:16px 0}
.cc-sig+.cc-sig{border-top:1px solid rgba(255,255,255,.06)}
.cc-ico{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;flex:0 0 40px}
.cc-go{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:${ACCENT_HSL};padding:8px 15px;border-radius:9999px;background:hsl(214 92% 64%/.12);white-space:nowrap;text-decoration:none}
.cc-hub{display:flex;align-items:center;gap:14px;padding:15px 0;text-decoration:none}
.cc-hub+.cc-hub{border-top:1px solid rgba(255,255,255,.06)}
`;

interface Pulse {
  users:    { total_users: number; signups_24h: number; signups_7d: number };
  projects: { total: number; completed: number; failed: number; in_flight: number; created_24h: number };
  credits:  { lifetime_grants: number; lifetime_spend: number; spend_24h_signed: number };
  support:  { open_tickets: number };
}
const empty: Pulse = {
  users:    { total_users: 0, signups_24h: 0, signups_7d: 0 },
  projects: { total: 0, completed: 0, failed: 0, in_flight: 0, created_24h: 0 },
  credits:  { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: 0 },
  support:  { open_tickets: 0 },
};

type Tone = "rose" | "amber" | "violet" | "accent";
type Signal = { tone: Tone; icon: LucideIcon; title: string; sub: string; ctaLabel: string; ctaTo: string };
const TONE: Record<Tone, { fg: string; bg: string }> = {
  rose:   { fg: "hsl(348 92% 70%)", bg: "hsl(348 92% 70% / .12)" },
  amber:  { fg: "hsl(40 96% 64%)",  bg: "hsl(40 96% 64% / .12)" },
  violet: { fg: VIOLET,             bg: "hsl(258 90% 74% / .12)" },
  accent: { fg: ACCENT_HSL,         bg: "hsl(214 92% 64% / .12)" },
};

const HUBS = [
  { icon: Users, title: "People", sub: "Users · sessions · roles · GDPR · abuse", to: "/admin/people" },
  { icon: FolderKanban, title: "Production", sub: "Projects · queue · providers · edge logs", to: "/admin/production-hub" },
  { icon: Wallet, title: "Money", sub: "Subscriptions · refunds · coupons · ledger", to: "/admin/money" },
  { icon: TrendingUp, title: "Growth", sub: "Analytics · experiments · flags · cohorts", to: "/admin/growth" },
  { icon: Zap, title: "System", sub: "API keys · webhooks · secrets · DB health", to: "/admin/system" },
];

const fmt = (n: number) => n.toLocaleString();
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n}`);

export default function AdminCommandCenter() {
  const [pulse, setPulse] = useState<Pulse>(empty);
  const [series, setSeries] = useState<{ day: string; signups: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_dashboard_pulse" as never);
      if (!error && data) {
        setPulse(data as unknown as Pulse);
      } else {
        const [u, p24, projTotal, projFailed, projDone, projFlight, p24Proj, sup] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("status", "failed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).not("status", "in", "(failed,completed,draft)"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
          supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        ]);
        setPulse({
          users:    { total_users: u.count ?? 0, signups_24h: p24.count ?? 0, signups_7d: 0 },
          projects: { total: projTotal.count ?? 0, completed: projDone.count ?? 0, failed: projFailed.count ?? 0, in_flight: projFlight.count ?? 0, created_24h: p24Proj.count ?? 0 },
          credits:  { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: 0 },
          support:  { open_tickets: sup.count ?? 0 },
        });
      }

      const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);
      const { data: rows } = await supabase.from("profiles").select("created_at").gte("created_at", since.toISOString());
      const buckets = new Map<string, number>();
      for (let i = 0; i < 14; i++) { const d = new Date(since); d.setDate(since.getDate() + i); buckets.set(d.toISOString().slice(0, 10), 0); }
      for (const r of (rows ?? []) as { created_at: string }[]) {
        const k = new Date(r.created_at).toISOString().slice(0, 10);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      }
      setSeries(Array.from(buckets.entries()).map(([k, v]) => ({ day: k.slice(5), signups: v })));
    } catch (e) {
      console.error("[AdminCommandCenter] load error", e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const signals = useMemo<Signal[]>(() => {
    const out: Signal[] = [];
    if (pulse.support.open_tickets > 0) out.push({ tone: "accent", icon: MessageSquare, title: `${fmt(pulse.support.open_tickets)} open support ticket${pulse.support.open_tickets === 1 ? "" : "s"}`, sub: "Waiting on first response from a teammate.", ctaLabel: "Inbox", ctaTo: "/admin/messages" });
    if (pulse.projects.failed > 0) out.push({ tone: pulse.projects.failed > 5 ? "rose" : "amber", icon: AlertTriangle, title: `${fmt(pulse.projects.failed)} project${pulse.projects.failed === 1 ? "" : "s"} failed`, sub: "Never reached completion — likely need a retry or refund.", ctaLabel: "Review", ctaTo: "/admin/projects?status=failed" });
    if (pulse.projects.in_flight > 0) out.push({ tone: "accent", icon: Activity, title: `${fmt(pulse.projects.in_flight)} render${pulse.projects.in_flight === 1 ? "" : "s"} in flight`, sub: "Live jobs across the pipeline — watch for stalls.", ctaLabel: "Queue", ctaTo: "/admin/queue" });
    if (Math.abs(pulse.credits.spend_24h_signed) > 0) out.push({ tone: "violet", icon: Coins, title: `${fmt(Math.abs(pulse.credits.spend_24h_signed))} credits burned · 24h`, sub: "Track engine spend across providers.", ctaLabel: "Ledger", ctaTo: "/admin/credits" });
    if (out.length === 0) out.push({ tone: "accent", icon: Sparkles, title: "All clear.", sub: "No open tickets, no failed renders, nothing urgent.", ctaLabel: "Analytics", ctaTo: "/admin/analytics" });
    return out;
  }, [pulse]);

  return (
    <div className="cc-wrap" style={{ padding: "34px 48px 72px", color: "rgba(255,255,255,.92)" }}>
      <style>{CC_CSS}</style>
      <div className="cc-atmos" aria-hidden><div className="cc-bloom cc-b1" /><div className="cc-bloom cc-b2" /><div className="cc-bloom cc-b3" /></div>

      {/* Capsule header */}
      <div className="cc-cap" style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, letterSpacing: ".06em" }}>
          <span className="cc-dot" /> ADMIN <span style={{ color: "rgba(255,255,255,.3)" }}>·</span> COMMAND CENTER
        </div>
        <div className="cc-seg">
          <button type="button" className="on">LIVE</button>
          <button type="button" onClick={() => void load(true)}>
            <RefreshCw size={12} style={{ verticalAlign: "-2px", animation: refreshing ? "spin 1s linear infinite" : undefined }} /> Refresh
          </button>
        </div>
        <button
          type="button"
          className="cc-pillbtn"
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          title="Open command palette"
        >
          <Search size={14} /> Search anything <span className="cc-kbd">⌘K</span>
        </button>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", position: "relative", padding: "6px 0 18px", marginBottom: 8 }}>
        <div aria-hidden style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", width: 720, height: 320, background: "radial-gradient(closest-side,hsl(214 92% 64%/.20),transparent 72%)", filter: "blur(18px)", pointerEvents: "none" }} />
        <div className="cc-lab" style={{ position: "relative", letterSpacing: ".34em", color: ACCENT_HSL }}>TOTAL MEMBERS · MEMBRANE-WIDE</div>
        <div className="cc-mega cc-grad" style={{ position: "relative", marginTop: 12 }}>{loading ? "—" : fmt(pulse.users.total_users)}</div>
        <div style={{ position: "relative", marginTop: 14, fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,.5)" }}>
          <b style={{ color: CYAN, fontWeight: 500 }}>+{fmt(pulse.users.signups_24h)}</b> in the last 24h
          {pulse.users.signups_7d > 0 && <> · {fmt(pulse.users.signups_7d)} this week</>}
          {" · "}{fmt(pulse.projects.total)} projects all-time
        </div>
        {/* live trend wave (real 14-day signups) */}
        <div style={{ height: 150, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ccWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={ACCENT_HSL} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ccLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={ACCENT_HSL} />
                  <stop offset="100%" stopColor={CYAN} />
                </linearGradient>
              </defs>
              <Tooltip cursor={{ stroke: "rgba(255,255,255,.15)" }} contentStyle={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,.6)" }} />
              <Area type="monotone" dataKey="signups" stroke="url(#ccLine)" strokeWidth={2.5} fill="url(#ccWave)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orbs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 28, marginTop: 22 }}>
        <Orb aura={ACCENT_HSL} accent label="Live productions" value={fmt(pulse.projects.in_flight)} sub={`${fmt(pulse.projects.failed)} failed`} series={series.map((s) => s.signups)} />
        <Orb aura={CYAN} label="Credits burned · 24h" value={compact(Math.abs(pulse.credits.spend_24h_signed))} sub="across all engines" series={series.map((s) => s.signups)} />
        <Orb aura={VIOLET} label="Signups · 24h" value={fmt(pulse.users.signups_24h)} sub={pulse.users.signups_7d > 0 ? `${fmt(pulse.users.signups_7d)} this week` : "welcome traffic"} series={series.map((s) => s.signups)} />
        <Orb aura="hsl(158 86% 52%)" label="Completed projects" value={fmt(pulse.projects.completed)} sub={`of ${fmt(pulse.projects.total)} total`} series={series.map((s) => s.signups)} />
      </div>

      {/* Panels: Signals + Hubs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 28 }}>
        <div className="cc-glass" style={{ padding: "30px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 500, fontSize: 19, color: "#fff" }}>Signals</span>
            <span className="cc-lab">{signals.length} open</span>
          </div>
          {signals.map((s, i) => {
            const t = TONE[s.tone]; const Icon = s.icon;
            return (
              <div className="cc-sig" key={i}>
                <span className="cc-ico" style={{ background: t.bg, color: t.fg }}><Icon size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, color: "#fff" }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 300, color: "rgba(255,255,255,.5)", marginTop: 3 }}>{s.sub}</div>
                </div>
                <Link className="cc-go" to={s.ctaTo}>{s.ctaLabel}</Link>
              </div>
            );
          })}
        </div>

        <div className="cc-glass" style={{ padding: "30px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 500, fontSize: 19, color: "#fff" }}>Hubs</span>
            <span className="cc-lab">jump to</span>
          </div>
          {HUBS.map((h) => {
            const Icon = h.icon;
            return (
              <Link className="cc-hub" key={h.to} to={h.to}>
                <span className="cc-ico" style={{ background: "hsl(214 92% 64% / .1)", color: ACCENT_HSL }}><Icon size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: "#fff" }}>{h.title}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 300, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{h.sub}</div>
                </div>
                <span style={{ color: "rgba(255,255,255,.3)" }}>→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Orb({ aura, accent, label, value, sub, series }: { aura: string; accent?: boolean; label: string; value: string; sub: string; series: number[] }) {
  const peak = Math.max(1, ...series);
  return (
    <div className="cc-orb">
      <div className="cc-aura" style={{ background: aura }} />
      <div className="cc-lab">{label}</div>
      <div className="cc-n" style={accent ? { color: ACCENT_HSL, textShadow: "0 0 34px hsl(214 92% 64%/.6)" } : undefined}>{value}</div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{sub}</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28, width: 88 }}>
          {series.slice(-7).map((v, i) => (
            <span key={i} style={{ flex: 1, borderRadius: "3px 3px 0 0", background: `linear-gradient(${ACCENT_HSL}, hsl(188 95% 62% / .25))`, opacity: 0.9, height: `${Math.max(8, (v / peak) * 100)}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
