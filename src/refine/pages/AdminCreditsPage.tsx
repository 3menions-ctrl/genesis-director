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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Coins className="w-4 h-4 text-white/40" /> Credit Transactions
        </h2>
        <Button onClick={fetch} variant="ghost" size="sm" className="text-xs text-white/30 hover:text-white/60">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
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
                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={cn("text-[10px] border-white/10",
                      t.transaction_type === "purchase" ? "text-success" : t.transaction_type === "refund" ? "text-warning" : "text-white/50"
                    )}>{t.transaction_type}</Badge>
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
            <div className="text-center py-16 text-white/30 text-sm">No transactions found</div>
          )}
        </div>
      </div>
    </div>
  );
}
