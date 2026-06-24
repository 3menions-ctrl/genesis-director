/**
 * MoneyOverview — the "Command Deck" landing for /admin/money.
 *
 * Direction A, completely borderless: figures float on the page, lists are
 * separated only by a thin hairline, generous spacing. Wired to LIVE data —
 * `admin_dashboard_pulse` for the headline credit figures plus direct
 * admin-gated table reads (credit_transactions / subscriptions /
 * refund_requests / discount_coupons) for the trend + lists. Renders embedded
 * inside the Money hub shell (no own hero).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, Users, RotateCcw, Coins, Flame, Ticket } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  StatOrb, ORB_AURAS, FloatSection, FloatTable, FloatRow, StatusPill, DeckButton,
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

interface Pulse { credits: { lifetime_grants: number; lifetime_spend: number; spend_24h_signed: number } }

export default function MoneyOverview() {
  const [pulse, setPulse] = useState<Pulse>({ credits: { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: 0 } });
  const [activeSubs, setActiveSubs] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);
  const [coupons, setCoupons] = useState(0);
  const [series, setSeries] = useState<{ day: string; credits: number }[]>([]);
  const [txns, setTxns] = useState<Row[]>([]);
  const [refunds, setRefunds] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);

        const subsCount = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active");
        const refundsCount = await supabase.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending");

        const [pulseRes, subsFallback, couponCount, refundsFallback, txnsRes, refundsRes, trendRes] = await Promise.all([
          supabase.rpc("admin_dashboard_pulse" as never),
          subsCount.error ? supabase.from("subscriptions").select("id", { count: "exact", head: true }) : Promise.resolve(subsCount),
          supabase.from("discount_coupons").select("id", { count: "exact", head: true }),
          refundsCount.error ? supabase.from("refund_requests").select("id", { count: "exact", head: true }) : Promise.resolve(refundsCount),
          supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }).limit(8),
          supabase.from("refund_requests").select("*").order("created_at", { ascending: false }).limit(6),
          supabase.from("credit_transactions").select("*").gte("created_at", since.toISOString()),
        ]);

        if (pulseRes.data) setPulse(pulseRes.data as unknown as Pulse);
        setActiveSubs(subsFallback.count ?? 0);
        setPendingRefunds(refundsFallback.count ?? 0);
        setCoupons(couponCount.count ?? 0);
        setTxns((txnsRes.data as Row[]) ?? []);
        setRefunds((refundsRes.data as Row[]) ?? []);

        const buckets = new Map<string, number>();
        for (let i = 0; i < 14; i++) { const d = new Date(since); d.setDate(since.getDate() + i); buckets.set(d.toISOString().slice(0, 10), 0); }
        for (const r of (trendRes.data as Row[]) ?? []) {
          const k = new Date(str(r, "created_at")).toISOString().slice(0, 10);
          if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + Math.abs(num(r, "amount", "credits")));
        }
        setSeries([...buckets.entries()].map(([k, v]) => ({ day: k.slice(5), credits: v })));
      } catch (e) {
        console.error("[MoneyOverview] load", e);
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: "Active subs", value: activeSubs, icon: Users },
    { label: "Credits spent · 24h", value: Math.abs(pulse.credits.spend_24h_signed), icon: Flame },
    { label: "Lifetime spend", value: pulse.credits.lifetime_spend, icon: DollarSign, accentNumber: true },
    { label: "Lifetime grants", value: pulse.credits.lifetime_grants, icon: Coins },
    { label: "Refunds pending", value: pendingRefunds, icon: RotateCcw },
    { label: "Coupons", value: coupons, icon: Ticket },
  ]), [pulse, activeSubs, pendingRefunds, coupons]);

  return (
    <div className="space-y-14">
      {/* KPI rail — floating figures */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <StatOrb key={k.label} index={i} aura={ORB_AURAS[i % ORB_AURAS.length]} {...k} />)}
      </div>

      {/* Dominant trend */}
      <FloatSection title="Credit flow" meta="last 14 days" actions={<DeckButton accent><Link to="/admin/credits">Open ledger →</Link></DeckButton>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="moneyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.55} />
                  <stop offset="50%" stopColor={CYAN} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="moneyStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
              <Area type="monotone" dataKey="credits" stroke="url(#moneyStroke)" strokeWidth={2.5} fill="url(#moneyFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </FloatSection>

      {/* Recent transactions + refund requests */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.55fr_1fr]">
        <FloatSection title="Recent transactions" meta={loading ? "loading…" : `${txns.length} shown`}>
          <FloatTable
            columns={[
              { key: "txn", label: "Txn" },
              { key: "type", label: "Type" },
              { key: "amount", label: "Amount", align: "right" },
              { key: "when", label: "When", align: "right" },
            ]}
            rows={txns.map((t) => {
              const amount = num(t, "amount", "credits");
              const positive = amount >= 0;
              const type = str(t, "transaction_type", "type", "kind") || "—";
              return {
                _key: str(t, "id"),
                txn: <span className="font-mono text-[11.5px] text-white/55">{str(t, "id").slice(0, 8) || "—"}</span>,
                type: <StatusPill tone={positive ? "accent" : "neutral"}>{type}</StatusPill>,
                amount: <span style={{ color: positive ? "#fff" : "rgba(255,255,255,0.6)" }}>{positive ? "+" : "−"}{Math.abs(amount).toLocaleString()}</span>,
                when: <span className="text-white/50">{ago(str(t, "created_at"))}</span>,
              };
            })}
          />
        </FloatSection>

        <FloatSection title="Refund requests" meta={`${pendingRefunds} pending`} actions={<DeckButton accent><Link to="/admin/refunds">All refunds →</Link></DeckButton>}>
          <div>
            {refunds.length === 0 && <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No refund requests.</div>}
            {refunds.map((r, i) => {
              const who = str(r, "user_email", "email", "user_id", "id") || "—";
              const amount = num(r, "amount", "credits", "amount_cents");
              const status = str(r, "status") || "pending";
              return (
                <FloatRow key={str(r, "id") || i} last={i === refunds.length - 1}
                  left={<span className="truncate font-mono text-[12px] text-white/70">{who}</span>}
                  right={amount > 0
                    ? <span className="tabular-nums text-white">{amount.toLocaleString()}</span>
                    : <StatusPill tone={status === "pending" ? "warn" : status === "approved" ? "accent" : "neutral"}>{status}</StatusPill>}
                />
              );
            })}
          </div>
        </FloatSection>
      </div>
    </div>
  );
}
