// ─────────────────────────────────────────────────────────────────────────
// CogsRevenue — COGS-vs-Revenue deck for the admin Dashboard.
// COGS is estimated from the COST_MODEL (provider $/s + bundled add-on per clip)
// × real generation usage (admin_cogs_usage). Revenue is shown two ways:
//   • credit-value generated (unit economics — validates the ≥30% reprice)
//   • cash sales (actual credit purchases, admin_purchase_insights)
// Flags any engine whose unit margin dips below the 30% target.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { DollarSign, TrendingDown, Percent, Coins, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ENGINES, CLIP_COST_USD, BUNDLED_ADDON_COST_USD, CREDIT_VALUE_FLOOR_USD,
  TARGET_GROSS_MARGIN, type EngineId,
} from "@/lib/video/engines";
import { CREDIT_PACKAGES } from "@/lib/payments/creditPackages";
import {
  FloatSection, FloatRow, StatOrb, DeckButton, ORB_AURAS, ROSE,
} from "@/admin/ui/primitives";

const EMERALD = "hsl(158 86% 52%)";
const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const PKG_PRICE: Record<string, number> = Object.fromEntries(CREDIT_PACKAGES.map((p) => [p.id, p.price]));
const PKG_PRICE_BY_CR: Record<number, number> = Object.fromEntries(CREDIT_PACKAGES.map((p) => [p.credits, p.price]));

// Provider $/second for an engine (from the cost model's shortest duration).
function perSecCost(id: EngineId): number {
  const ds = ENGINES[id].durations;
  const d0 = ds[0];
  return (CLIP_COST_USD[id]?.[d0] ?? 0) / d0;
}
// Snap an average duration to the engine's nearest supported duration.
function snapDur(id: EngineId, avg: number): number {
  return ENGINES[id].durations.reduce((b, d) => (Math.abs(d - avg) < Math.abs(b - avg) ? d : b), ENGINES[id].durations[0]);
}

interface EngineUsage { engine: string; clips: number; seconds: number }
interface Purchase { credits: number; pkg: string | null }

export function CogsRevenue() {
  const [days, setDays] = useState(30);
  const [usage, setUsage] = useState<EngineUsage[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true); setErr(null);
    try {
      const [u, p] = await Promise.all([
        supabase.rpc("admin_cogs_usage" as never, { p_days: d } as never),
        supabase.rpc("admin_purchase_insights" as never, { p_days: d } as never),
      ]);
      if (u.error) throw u.error;
      const ub = u.data as unknown as { success: boolean; byEngine: EngineUsage[] };
      if (!ub?.success) throw new Error("usage load failed");
      setUsage(ub.byEngine ?? []);
      const pb = p.data as unknown as { success: boolean; purchases: Purchase[] } | null;
      setPurchases(pb?.success ? (pb.purchases ?? []) : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load COGS");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(days); }, [days, load]);

  const m = useMemo(() => {
    const rows = usage
      .filter((r) => (ENGINES as Record<string, unknown>)[r.engine])
      .map((r) => {
        const id = r.engine as EngineId;
        const cogs = r.seconds * perSecCost(id) + r.clips * BUNDLED_ADDON_COST_USD;
        const dur = snapDur(id, r.clips ? r.seconds / r.clips : ENGINES[id].durations[0]);
        const credits = ENGINES[id].baseCreditsFor(dur) * r.clips;
        const revenue = credits * CREDIT_VALUE_FLOOR_USD; // value at the guaranteed-margin floor
        const margin = revenue > 0 ? (revenue - cogs) / revenue : 0;
        return { id, label: ENGINES[id].shortLabel, clips: r.clips, cogs, revenue, margin };
      })
      .sort((a, b) => b.cogs - a.cogs);

    const cogs = rows.reduce((s, r) => s + r.cogs, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const blended = revenue > 0 ? (revenue - cogs) / revenue : 0;
    const underTarget = rows.filter((r) => r.margin < TARGET_GROSS_MARGIN);

    const cashRevenue = purchases.reduce((s, x) =>
      s + ((x.pkg && PKG_PRICE[x.pkg]) || PKG_PRICE_BY_CR[x.credits] || 0), 0);

    return { rows, cogs, revenue, blended, underTarget, cashRevenue };
  }, [usage, purchases]);

  const chart = m.rows.map((r) => ({ name: r.label, COGS: +r.cogs.toFixed(2), Revenue: +r.revenue.toFixed(2) }));

  return (
    <FloatSection
      title="COGS vs revenue"
      meta={loading ? "loading…" : `${pct(m.blended)} blended margin · last ${days}d`}
      actions={
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((w) => (
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
          COGS load failed — {err} (admin-only / is_admin-gated)
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-4">
        <StatOrb index={0} aura={ROSE} label={`COGS · ${days}d`} value={money(m.cogs)} icon={TrendingDown} sub="est. provider spend" />
        <StatOrb index={1} aura={EMERALD} label="Credit-value gen'd" value={money(m.revenue)} icon={Coins} sub="at floor" />
        <StatOrb index={2} aura={m.blended >= TARGET_GROSS_MARGIN ? EMERALD : ROSE} label="Blended margin"
          value={pct(m.blended)} icon={Percent} sub={`target ${pct(TARGET_GROSS_MARGIN)}`} accentNumber />
        <StatOrb index={3} aura={ORB_AURAS[1]} label={`Cash sales · ${days}d`} value={money(m.cashRevenue)} icon={DollarSign} sub="credit purchases" />
      </div>

      {m.underTarget.length > 0 && (
        <div className="mt-8 flex items-center gap-2 rounded-xl bg-amber-400/[0.06] px-4 py-3 text-[12.5px] text-amber-300/90">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {m.underTarget.length} engine{m.underTarget.length === 1 ? "" : "s"} under the {pct(TARGET_GROSS_MARGIN)} target: {m.underTarget.map((r) => `${r.label} (${pct(r.margin)})`).join(", ")}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: number) => money(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="COGS" radius={[5, 5, 0, 0]} fill={ROSE} isAnimationActive animationDuration={900} />
              <Bar dataKey="Revenue" radius={[5, 5, 0, 0]} fill={EMERALD} isAnimationActive animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          {loading && <div className="flex items-center justify-center gap-3 py-16 text-white/50"><RefreshCw className="h-4 w-4 animate-spin" />Loading…</div>}
          {!loading && m.rows.length === 0 && <div className="py-12 text-center text-[13px] font-light text-white/40">No generations in this window.</div>}
          {!loading && m.rows.map((r, i, arr) => (
            <FloatRow
              key={r.id}
              last={i === arr.length - 1}
              left={
                <span className="flex flex-col">
                  <span className="text-[13px] text-white/85">{r.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{r.clips} clip{r.clips === 1 ? "" : "s"} · COGS {money(r.cogs)}</span>
                </span>
              }
              right={
                <span className="font-display text-[15px] font-semibold tabular-nums" style={{ color: r.margin >= TARGET_GROSS_MARGIN ? EMERALD : ROSE }}>
                  {pct(r.margin)}
                </span>
              }
            />
          ))}
        </div>
      </div>
    </FloatSection>
  );
}
