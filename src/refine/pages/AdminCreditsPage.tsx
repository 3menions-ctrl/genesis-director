/**
 * Admin Credits/Transactions Page — credit_transactions list.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminEmptyState } from "../components/AdminPageShell";

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

  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="LDG"
      title="Ledger"
      italic="Transactions."
      description="Every credit movement across the platform — purchases, consumption, refunds, and adjustments."
      actions={
        <Button onClick={fetch} variant="ghost" size="sm" className="text-xs text-[#9aa4b8] hover:text-[#5d6a82]">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      }
      stats={[
        { label: "Movements", value: txns.length.toLocaleString(), tone: "blue", sub: "last 200" },
        { label: "Inflow",    value: `+${inflow.toLocaleString()}`,  tone: "emerald", sub: "credits in" },
        { label: "Outflow",   value: outflow.toLocaleString(),       tone: "rose",    sub: "credits out" },
        { label: "Purchases / Refunds", value: `${purchases} / ${refunds}`, tone: "amber", sub: "txn split" },
      ]}
    >
      <div className="rounded-2xl border border-[#e7ebf3] overflow-hidden bg-glass backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e7ebf3]">
                {["Type", "Amount", "Description", "Date"].map((h) => (
                  <th key={h} className="py-3 px-4 text-[11px] font-semibold text-[#9aa4b8] uppercase tracking-wider text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-b border-[#e7ebf3] hover:bg-glass transition-colors">
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={cn("text-[10px] border-[#e7ebf3]",
                      t.transaction_type === "purchase" ? "text-success" : t.transaction_type === "refund" ? "text-warning" : "text-[#5d6a82]"
                    )}>{t.transaction_type}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn("font-mono text-sm", t.amount >= 0 ? "text-success" : "text-destructive")}>
                      {t.amount >= 0 ? "+" : ""}{t.amount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#9aa4b8] max-w-xs truncate">{t.description || "—"}</td>
                  <td className="py-3 px-4 text-xs text-[#9aa4b8]">{new Date(t.created_at).toLocaleString()}</td>
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
