/**
 * AdminPnlPage — ledger-backed Profit & Loss + Balance Sheet + Reconciliation.
 * Reads the embedded double-entry ledger (ledger_pnl / ledger_balance_sheet /
 * ledger_reconcile): recognized revenue, COGS, gross/net margin, deferred-revenue
 * liability, equity — the single source of financial truth.
 */
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Percent, DollarSign, Cpu, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminCard, KpiTile, ACCENT_HSL, CYAN, ROSE, accent } from "@/admin/ui/primitives";

const usd = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
interface Pnl { revenue: { credit_usage: number; storage: number; subscription: number; total: number }; cogs: { api: number; storage: number; total: number }; gross_profit: number; gross_margin_pct: number; opex: number; net_profit: number }
interface BS { assets: { cash: number; stripe_clearing: number; total: number }; liabilities: { deferred_credits: number; api_payable: number; storage_payable: number; creator_payouts: number; total: number }; equity: { opening: number; retained: number; total: number } }
interface Drift { user_id: string; cached: number; ledger: number; drift: number }

function Line({ label, value, accent: acc, strong, indent }: { label: string; value: number; accent?: boolean; strong?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? "border-t border-[#e7ebf3] pt-3 mt-1" : ""}`}>
      <span className={`${indent ? "pl-4 text-[#5d6a82]" : "text-[#0c1426]"} ${strong ? "font-display text-[14px] font-semibold text-[#0c1426]" : "text-[13px]"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-display text-[15px] font-semibold" : "text-[13.5px]"}`} style={{ color: acc ? ACCENT_HSL : strong ? "#fff" : "rgba(255,255,255,0.7)" }}>{usd(value)}</span>
    </div>
  );
}

export default function AdminPnlPage() {
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [bs, setBs] = useState<BS | null>(null);
  const [drift, setDrift] = useState<Drift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: b }, { data: d }] = await Promise.all([
        supabase.rpc("ledger_pnl" as never, {} as never),
        supabase.rpc("ledger_balance_sheet" as never, {} as never),
        supabase.rpc("ledger_reconcile" as never, {} as never),
      ]);
      setPnl((p as Pnl) ?? null); setBs((b as BS) ?? null); setDrift(((d as Drift[]) ?? [])); setLoading(false);
    })();
  }, []);

  const reconciled = useMemo(() => drift.length === 0, [drift]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="Money · ledger" title={<>Profit &amp; <span className="italic">loss</span>.</>} sub="GAAP-style accounting from the embedded double-entry ledger — recognized revenue, COGS, margins, and the balance sheet."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={reconciled ? { background: accent(0.14), color: ACCENT_HSL } : { background: "hsl(350 90% 70% / 0.14)", color: ROSE }}>
            {reconciled ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {reconciled ? "Ledger reconciled" : `${drift.length} accounts drift`}
          </span>
        } />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile index={0} label="Revenue" value={usd(pnl?.revenue.total ?? 0)} icon={DollarSign} accentNumber />
        <KpiTile index={1} label="COGS" value={usd(pnl?.cogs.total ?? 0)} icon={Cpu} />
        <KpiTile index={2} label="Gross profit" value={usd(pnl?.gross_profit ?? 0)} icon={TrendingUp} />
        <KpiTile index={3} label="Gross margin" value={`${pnl?.gross_margin_pct ?? 0}%`} icon={Percent} />
      </div>

      {loading ? <div className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[#9aa4b8]">Loading ledger…</div> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* P&L statement */}
          <AdminCard className="p-6">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-[#9aa4b8]">Income statement</div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9aa4b8]">Revenue</div>
            <Line indent label="Credit usage" value={pnl?.revenue.credit_usage ?? 0} />
            <Line indent label="Storage" value={pnl?.revenue.storage ?? 0} />
            <Line indent label="Subscriptions" value={pnl?.revenue.subscription ?? 0} />
            <Line label="Total revenue" value={pnl?.revenue.total ?? 0} strong accent />
            <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9aa4b8]">Cost of goods sold</div>
            <Line indent label="API generation" value={pnl?.cogs.api ?? 0} />
            <Line indent label="Storage" value={pnl?.cogs.storage ?? 0} />
            <Line label="Total COGS" value={pnl?.cogs.total ?? 0} strong />
            <Line label="Gross profit" value={pnl?.gross_profit ?? 0} strong accent />
            <Line indent label="Promotional credits (opex)" value={pnl?.opex ?? 0} />
            <Line label="Net profit" value={pnl?.net_profit ?? 0} strong accent />
          </AdminCard>

          {/* Balance sheet */}
          <AdminCard className="p-6">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-[#9aa4b8]">Balance sheet</div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9aa4b8]">Assets</div>
            <Line indent label="Cash" value={bs?.assets.cash ?? 0} />
            <Line indent label="Stripe clearing" value={bs?.assets.stripe_clearing ?? 0} />
            <Line label="Total assets" value={bs?.assets.total ?? 0} strong accent />
            <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9aa4b8]">Liabilities</div>
            <Line indent label="Deferred revenue (unspent credits)" value={bs?.liabilities.deferred_credits ?? 0} />
            <Line indent label="API provider payable" value={bs?.liabilities.api_payable ?? 0} />
            <Line indent label="Storage payable" value={bs?.liabilities.storage_payable ?? 0} />
            <Line indent label="Creator payouts" value={bs?.liabilities.creator_payouts ?? 0} />
            <Line label="Total liabilities" value={bs?.liabilities.total ?? 0} strong />
            <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9aa4b8]">Equity</div>
            <Line indent label="Opening equity" value={bs?.equity.opening ?? 0} />
            <Line indent label="Retained earnings" value={bs?.equity.retained ?? 0} />
            <Line label="Total equity" value={bs?.equity.total ?? 0} strong accent />
          </AdminCard>
        </div>
      )}

      {drift.length > 0 && (
        <AdminCard className="mt-6 p-5" style={{ boxShadow: `inset 0 0 0 1px hsl(350 90% 70% / 0.3)` }}>
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: ROSE }}><AlertTriangle className="h-3.5 w-3.5" /> Balance drift — cached vs ledger</div>
          {drift.map((d) => (
            <div key={d.user_id} className="flex items-center justify-between py-1 font-mono text-[12px]">
              <span className="text-[#5d6a82]">{d.user_id.slice(0, 8)}</span>
              <span className="tabular-nums text-[#5d6a82]">cached {d.cached} · ledger {d.ledger} · <span style={{ color: ROSE }}>drift {d.drift}</span></span>
            </div>
          ))}
        </AdminCard>
      )}
    </div>
  );
}
