// ─────────────────────────────────────────────────────────────────────────
// PurchaseInsights — revenue & purchase analytics deck for the admin Dashboard.
// Reads admin_purchase_insights(p_days) (SECURITY DEFINER, is_admin-gated) and
// maps each purchase's package slug → USD via the authoritative CREDIT_PACKAGES
// config. Renders KPI orbs, a revenue-over-time area chart, a purchases-by-pack
// bar, a checkout funnel, and a recent-purchases feed.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell,
} from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, Receipt, Eye, Percent, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { CREDIT_PACKAGES } from "@/lib/payments/creditPackages";
import {
  FloatSection, FloatRow, StatOrb, DeckButton, ORB_AURAS,
  ACCENT_HSL, accent, CYAN, VIOLET, ROSE, AMBER,
} from "@/admin/ui/primitives";

const EMERALD = "hsl(158 86% 52%)";

const PRICE: Record<string, number> = Object.fromEntries(
  CREDIT_PACKAGES.map((p) => [p.id, p.price]),
);
// Fallback: map by credit amount when the slug is missing/renamed.
const PRICE_BY_CREDITS: Record<number, number> = Object.fromEntries(
  CREDIT_PACKAGES.map((p) => [p.credits, p.price]),
);
const usd = (pkg: string | null, credits: number): number =>
  (pkg && PRICE[pkg]) || PRICE_BY_CREDITS[credits] || 0;

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

interface Purchase { at: string; userId: string; name: string; credits: number; pkg: string | null; orderId: string }
interface Refund { at: string; credits: number; pkg: string | null }
interface Insights {
  success: boolean;
  purchases: Purchase[];
  refunds: Refund[];
  pricingVisitsDaily: Record<string, number>;
  pricingVisitors: number;
  funnel: Record<string, number>;
  lifetime: { purchaseCount: number; creditsSold: number; refundCount: number; creditsRefunded: number };
}

const WINDOWS = [7, 30, 90] as const;

export function PurchaseInsights() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true); setErr(null);
    try {
      const { data: res, error } = await supabase.rpc("admin_purchase_insights" as never, { p_days: d } as never);
      if (error) throw error;
      const blob = res as unknown as Insights;
      if (!blob?.success) throw new Error((blob as { error?: string })?.error || "load failed");
      setData(blob);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load purchase insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const m = useMemo(() => {
    const p = data?.purchases ?? [];
    const r = data?.refunds ?? [];
    const revenue = p.reduce((s, x) => s + usd(x.pkg, x.credits), 0);
    const refunded = r.reduce((s, x) => s + usd(x.pkg, x.credits), 0);
    const avg = p.length ? revenue / p.length : 0;
    const visitors = data?.pricingVisitors ?? 0;
    const conv = visitors ? (p.length / visitors) * 100 : 0;

    // Revenue per day (fill gaps across the window)
    const byDay = new Map<string, number>();
    for (const x of p) {
      const k = x.at.slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + usd(x.pkg, x.credits));
    }
    const series: { day: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(now.getTime() - i * 86400_000);
      const k = dt.toISOString().slice(0, 10);
      series.push({ day: k.slice(5), revenue: byDay.get(k) ?? 0 });
    }

    // Purchases by package (revenue)
    const byPkg = new Map<string, { count: number; revenue: number }>();
    for (const x of p) {
      const key = x.pkg ?? `${x.credits}cr`;
      const cur = byPkg.get(key) ?? { count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += usd(x.pkg, x.credits);
      byPkg.set(key, cur);
    }
    const packs = [...byPkg.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    // Funnel: pricing visits → buy opened → checkout started → purchased
    const f = data?.funnel ?? {};
    const funnel = [
      { stage: "Pricing visits", value: visitors, color: CYAN },
      { stage: "Buy opened", value: f.buy_credits_opened ?? 0, color: VIOLET },
      { stage: "Checkout started", value: f.checkout_started ?? 0, color: ACCENT_HSL },
      { stage: "Purchased", value: p.length, color: EMERALD },
    ];
    const aborted = f.checkout_aborted ?? 0;
    const failed = f.checkout_failed ?? 0;

    return { revenue, refunded, avg, visitors, conv, series, packs, funnel, aborted, failed,
      purchaseCount: p.length, refundCount: r.length };
  }, [data, days]);

  return (
    <div className="space-y-10">
      <FloatSection
        title="Revenue & purchases"
        meta={data ? `${money(m.revenue)} · ${m.purchaseCount} order${m.purchaseCount === 1 ? "" : "s"} · last ${days}d` : "loading…"}
        actions={
          <div className="flex items-center gap-1.5">
            {WINDOWS.map((w) => (
              <DeckButton key={w} onClick={() => setDays(w)} accent={days === w}>{w}d</DeckButton>
            ))}
            <DeckButton onClick={() => void load(days)} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </DeckButton>
          </div>
        }
      >
        {err && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 px-5 py-4 font-mono text-[11px] text-rose-300/90">
            Purchase insights failed — {err}
            <div className="mt-1 text-white/45">If you are not the admin account this is expected (is_admin-gated).</div>
          </div>
        )}

        {/* KPI orbs */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
          <StatOrb index={0} aura={EMERALD} label={`Revenue · ${days}d`} value={money(m.revenue)} icon={DollarSign} accentNumber />
          <StatOrb index={1} aura={ORB_AURAS[1]} label={`Orders · ${days}d`} value={m.purchaseCount} icon={ShoppingCart} />
          <StatOrb index={2} aura={ORB_AURAS[2]} label="Avg order" value={money(m.avg)} icon={Receipt} />
          <StatOrb index={3} aura={ORB_AURAS[3]} label="Pricing visitors" value={m.visitors} icon={Eye} sub={`${days}d`} />
          <StatOrb index={4} aura={ORB_AURAS[4]} label="Visit → buy" value={`${m.conv.toFixed(1)}%`} icon={Percent} sub="conversion" />
          <StatOrb index={5} aura={ROSE} label="Refunds" value={money(m.refunded)} icon={TrendingUp} sub={`${m.refundCount} refunded`} />
        </div>
      </FloatSection>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.6fr_1fr]">
        <FloatSection title="Revenue" meta={`last ${days} days`}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.series} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMERALD} stopOpacity={0.6} />
                    <stop offset="50%" stopColor={CYAN} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={EMERALD} /><stop offset="100%" stopColor={CYAN} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(days / 10))} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} formatter={(v: number) => [money(v), "Revenue"]} cursor={{ stroke: accent(0.4) }} />
                <Area type="monotone" dataKey="revenue" stroke="url(#revStroke)" strokeWidth={2.5} fill="url(#revFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: EMERALD, strokeWidth: 2 }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </FloatSection>

        <FloatSection title="Checkout funnel" meta={m.aborted || m.failed ? `${m.aborted} aborted · ${m.failed} failed` : "visits → purchase"}>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.funnel} layout="vertical" margin={{ top: 6, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} tickLine={false} axisLine={false} width={92} />
                <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000}>
                  {m.funnel.map((f) => <Cell key={f.stage} fill={f.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FloatSection>
      </div>

      {/* Packages + recent purchases */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1fr_1.4fr]">
        <FloatSection title="By package" meta="revenue share">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.packs} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: number, _n, p) => [`${money(v)} · ${(p?.payload as { count?: number })?.count ?? 0} orders`, "Revenue"]} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1000}>
                  {m.packs.map((_, i) => <Cell key={i} fill={[EMERALD, CYAN, VIOLET, ACCENT_HSL, AMBER, ROSE][i % 6]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {m.packs.length === 0 && <div className="py-10 text-center text-[13px] font-light text-white/40">No purchases in this window.</div>}
        </FloatSection>

        <FloatSection title="Recent purchases" meta={`lifetime: ${data?.lifetime?.purchaseCount ?? 0} orders · ${(data?.lifetime?.creditsSold ?? 0).toLocaleString()} credits`}>
          {loading && <div className="flex items-center justify-center gap-3 py-16 text-white/50"><RefreshCw className="h-4 w-4 animate-spin" />Loading…</div>}
          {!loading && (data?.purchases?.length ?? 0) === 0 && <div className="py-12 text-center text-[13px] font-light text-white/40">No purchases yet.</div>}
          {!loading && (data?.purchases ?? []).slice(0, 12).map((p, i, arr) => (
            <FloatRow
              key={p.orderId || i}
              last={i === arr.length - 1}
              left={
                <span className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: accent(0.12) }}>
                    <DollarSign className="h-3.5 w-3.5" style={{ color: EMERALD }} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[13px] text-white/85">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                      {p.pkg ?? `${p.credits}cr`} · {new Date(p.at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </span>
                </span>
              }
              right={
                <span className="flex flex-col items-end">
                  <span className="font-display text-[15px] font-semibold tabular-nums" style={{ color: EMERALD }}>{money(usd(p.pkg, p.credits))}</span>
                  <span className="font-mono text-[10px] text-white/40">{p.credits.toLocaleString()} cr</span>
                </span>
              }
            />
          ))}
        </FloatSection>
      </div>
    </div>
  );
}
