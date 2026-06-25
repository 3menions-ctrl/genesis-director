/**
 * AdminPnlPage — ledger-backed Profit & Loss + Balance Sheet + Reconciliation.
 * Reads the embedded double-entry ledger (ledger_pnl / ledger_balance_sheet /
 * ledger_reconcile): recognized revenue, COGS, gross/net margin, deferred-revenue
 * liability, equity — the single source of financial truth.
 */
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, StatusPill, ACCENT_HSL, ROSE } from "@/admin/ui/primitives";
import { toast } from "sonner";

const usd = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
interface Pnl { revenue: { credit_usage: number; storage: number; subscription: number; total: number }; cogs: { api: number; storage: number; total: number }; gross_profit: number; gross_margin_pct: number; opex: number; net_profit: number }
interface BS { assets: { cash: number; stripe_clearing: number; total: number }; liabilities: { deferred_credits: number; api_payable: number; storage_payable: number; creator_payouts: number; total: number }; equity: { opening: number; retained: number; total: number } }
interface Drift { user_id: string; cached: number; ledger: number; drift: number }

function Line({ label, value, accent: acc, strong, indent }: { label: string; value: number; accent?: boolean; strong?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? "border-t border-white/[0.08] pt-3 mt-1" : ""}`}>
      <span className={`${indent ? "pl-4 text-white/55" : "text-white/75"} ${strong ? "font-display text-[14px] font-semibold text-white" : "text-[13px]"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-display text-[15px] font-semibold" : "text-[13.5px]"}`} style={{ color: acc ? ACCENT_HSL : strong ? "#fff" : "rgba(255,255,255,0.7)" }}>{usd(value)}</span>
    </div>
  );
}

export default function AdminPnlPage() {
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [bs, setBs] = useState<BS | null>(null);
  const [drift, setDrift] = useState<Drift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [pRes, bRes, dRes] = await Promise.all([
        supabase.rpc("ledger_pnl" as never, {} as never),
        supabase.rpc("ledger_balance_sheet" as never, {} as never),
        supabase.rpc("ledger_reconcile" as never, {} as never),
      ]);
      const firstError = pRes.error || bRes.error || dRes.error;
      if (firstError) {
        // Surface the failure instead of silently rendering an all-$0 statement,
        // which reads as a real (and wrong) zero financial position.
        setError(firstError.message);
        toast.error(`Failed to load ledger: ${firstError.message}`);
        setLoading(false);
        return;
      }
      setPnl((pRes.data as Pnl) ?? null);
      setBs((bRes.data as BS) ?? null);
      setDrift((dRes.data as Drift[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const reconciled = useMemo(() => drift.length === 0, [drift]);

  return (
    <AdminPageShell
      eyebrow="Money // ledger"
      code="PNL"
      title="Profit &"
      italic="loss."
      description="GAAP-style accounting from the embedded double-entry ledger — recognized revenue, COGS, margins, and the balance sheet."
      actions={
        <StatusPill tone={reconciled ? "accent" : "danger"}>
          {reconciled ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {reconciled ? "Ledger reconciled" : `${drift.length} accounts drift`}
        </StatusPill>
      }
      stats={[
        { label: "Revenue", value: error ? "—" : usd(pnl?.revenue.total ?? 0), tone: "blue" },
        { label: "COGS", value: error ? "—" : usd(pnl?.cogs.total ?? 0), tone: "neutral" },
        { label: "Gross profit", value: error ? "—" : usd(pnl?.gross_profit ?? 0), tone: "emerald" },
        { label: "Gross margin", value: error ? "—" : `${pnl?.gross_margin_pct ?? 0}%`, tone: "amber" },
      ]}
    >
      {error ? (
        // Surface the failure instead of silently rendering an all-$0 statement,
        // which reads as a real (and wrong) zero financial position. (admin-review AD)
        <FloatSection title="Ledger unavailable">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-6 w-6" style={{ color: ROSE }} />
            <div className="font-display text-[15px] font-semibold text-white">Ledger unavailable</div>
            <div className="max-w-md px-6 font-mono text-[11px] leading-relaxed text-white/45">{error}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">Figures above are not zero — they failed to load.</div>
          </div>
        </FloatSection>
      ) : loading ? <div className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading ledger…</div> : (
        <div className="space-y-14">
          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            {/* P&L statement */}
            <FloatSection title="Income statement">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Revenue</div>
              <Line indent label="Credit usage" value={pnl?.revenue.credit_usage ?? 0} />
              <Line indent label="Storage" value={pnl?.revenue.storage ?? 0} />
              <Line indent label="Subscriptions" value={pnl?.revenue.subscription ?? 0} />
              <Line label="Total revenue" value={pnl?.revenue.total ?? 0} strong accent />
              <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Cost of goods sold</div>
              <Line indent label="API generation" value={pnl?.cogs.api ?? 0} />
              <Line indent label="Storage" value={pnl?.cogs.storage ?? 0} />
              <Line label="Total COGS" value={pnl?.cogs.total ?? 0} strong />
              <Line label="Gross profit" value={pnl?.gross_profit ?? 0} strong accent />
              <Line indent label="Promotional credits (opex)" value={pnl?.opex ?? 0} />
              <Line label="Net profit" value={pnl?.net_profit ?? 0} strong accent />
            </FloatSection>

            {/* Balance sheet */}
            <FloatSection title="Balance sheet">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Assets</div>
              <Line indent label="Cash" value={bs?.assets.cash ?? 0} />
              <Line indent label="Payment clearing" value={bs?.assets.stripe_clearing ?? 0} />
              <Line label="Total assets" value={bs?.assets.total ?? 0} strong accent />
              <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Liabilities</div>
              <Line indent label="Deferred revenue (unspent credits)" value={bs?.liabilities.deferred_credits ?? 0} />
              <Line indent label="API provider payable" value={bs?.liabilities.api_payable ?? 0} />
              <Line indent label="Storage payable" value={bs?.liabilities.storage_payable ?? 0} />
              <Line indent label="Creator payouts" value={bs?.liabilities.creator_payouts ?? 0} />
              <Line label="Total liabilities" value={bs?.liabilities.total ?? 0} strong />
              <div className="mt-4 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Equity</div>
              <Line indent label="Opening equity" value={bs?.equity.opening ?? 0} />
              <Line indent label="Retained earnings" value={bs?.equity.retained ?? 0} />
              <Line label="Total equity" value={bs?.equity.total ?? 0} strong accent />
            </FloatSection>
          </div>

          {drift.length > 0 && (
            <FloatSection title="Balance drift" meta="cached vs ledger">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: ROSE }}><AlertTriangle className="h-3.5 w-3.5" /> Mismatched accounts</div>
              {drift.map((d) => (
                <div key={d.user_id} className="flex items-center justify-between py-1 font-mono text-[12px]">
                  <span className="text-white/60">{d.user_id.slice(0, 8)}</span>
                  <span className="tabular-nums text-white/55">cached {d.cached} · ledger {d.ledger} · <span style={{ color: ROSE }}>drift {d.drift}</span></span>
                </div>
              ))}
            </FloatSection>
          )}
        </div>
      )}
    </AdminPageShell>
  );
}
