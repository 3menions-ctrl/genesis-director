/**
 * Admin Credits/Transactions Page — credit_transactions list.
 */
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DeckButton, StatusPill, FloatSection } from "@/admin/ui/primitives";
import { Coins, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminEmptyState } from "../components/AdminPageShell";
import { MultiTrend, CategoryBars, countBy, bucketByDay, CYAN, ROSE } from "@/admin/ui/charts";

interface Transaction {
  id: string; user_id: string; amount: number; transaction_type: string;
  description: string | null; stripe_payment_id: string | null; created_at: string;
}

export default function AdminCreditsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setTxns((data || []) as Transaction[]);
    } catch { toast.error("Failed to load transactions"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const inflow  = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = txns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const purchases = txns.filter(t => t.transaction_type === "purchase").length;
  const refunds   = txns.filter(t => t.transaction_type === "refund").length;

  // Daily credit flow (inflow vs outflow magnitude) over the loaded window, and
  // a breakdown by transaction_type — both derived from the same 200 rows.
  const flowSeries = useMemo(() => {
    const inSeries  = bucketByDay(txns.filter(t => t.amount > 0), t => t.created_at, { value: t => t.amount });
    const outSeries = bucketByDay(txns.filter(t => t.amount < 0), t => t.created_at, { value: t => Math.abs(t.amount) });
    return inSeries.map((p, i) => ({ label: p.label, inflow: p.value, outflow: outSeries[i]?.value ?? 0 }));
  }, [txns]);
  const typeBreakdown = useMemo(() => countBy(txns, t => t.transaction_type), [txns]);

  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="LDG"
      title="Ledger"
      italic="Transactions."
      description="Every credit movement across the platform — purchases, consumption, refunds, and adjustments."
      actions={
        <DeckButton onClick={fetch}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </DeckButton>
      }
      stats={[
        { label: "Movements", value: txns.length.toLocaleString(), tone: "blue", sub: "last 200" },
        { label: "Inflow",    value: `+${inflow.toLocaleString()}`,  tone: "emerald", sub: "credits in" },
        { label: "Outflow",   value: outflow.toLocaleString(),       tone: "rose",    sub: "credits out" },
        { label: "Purchases / Refunds", value: `${purchases} / ${refunds}`, tone: "amber", sub: "txn split" },
      ]}
    >
      {txns.length > 0 && (
        <div className="mb-14 grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.6fr_1fr]">
          <FloatSection title="Credit flow" meta={`last ${flowSeries.length} days · in vs out`}>
            <MultiTrend
              data={flowSeries}
              series={[{ key: "inflow", label: "Inflow", color: CYAN }, { key: "outflow", label: "Outflow", color: ROSE }]}
              height={240}
            />
          </FloatSection>
          <FloatSection title="By type" meta={`${txns.length} movements`}>
            <CategoryBars data={typeBreakdown} valueSuffix="txns" />
          </FloatSection>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-glass backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Type", "Amount", "Description", "Date"].map((h) => (
                  <th key={h} className="py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-glass transition-colors">
                  <td className="py-3 px-4">
                    <StatusPill tone={t.transaction_type === "purchase" ? "positive" : t.transaction_type === "refund" ? "warn" : "neutral"}>{t.transaction_type}</StatusPill>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn("font-mono text-sm", t.amount >= 0 ? "text-success" : "text-destructive")}>
                      {t.amount >= 0 ? "+" : ""}{t.amount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-white/40 max-w-xs truncate">{t.description || "—"}</td>
                  <td className="py-3 px-4 text-xs text-white/30">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {txns.length === 0 && !loading && (
            <AdminEmptyState code="LDG" icon={Coins} title="The ledger is dormant"
              hint="No credit movements recorded in this window. New purchases, consumption, and refunds will stream in here in real time." />
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
