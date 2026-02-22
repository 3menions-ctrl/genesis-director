/**
 * Admin Financials Page — Revenue, API costs, profit margins.
 * Extracted from Admin.tsx financials tab.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, BarChart3, ArrowDownRight, Activity, Coins, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfitData {
  date: string; service: string; total_operations: number;
  total_credits_charged: number; total_real_cost_cents: number;
  estimated_revenue_cents: number; profit_margin_percent: number;
}

// No longer use hardcoded cost map — use real_cost_cents from DB

function StatPill({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const c = { primary: "text-primary", success: "text-success", warning: "text-warning", destructive: "text-destructive", info: "text-info" }[accent || "primary"];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04]", c)}><Icon className="w-4 h-4" /></div>
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const fmt = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function AdminFinancialsPage() {
  const [profitData, setProfitData] = useState<ProfitData[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [apiCost, setApiCost] = useState(0);
  const [totalOps, setTotalOps] = useState(0);

  const fetchProfitData = async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_profit_dashboard");
      if (error) throw error;
      setProfitData((data || []) as ProfitData[]);
    } catch { toast.error("Failed to load financial data"); }
  };

  const fetchRevenue = async () => {
    try {
      const { data: purchases } = await supabase.from("credit_transactions").select("amount, stripe_payment_id").eq("transaction_type", "purchase").not("stripe_payment_id", "is", null);
      const { data: refunds } = await supabase.from("credit_transactions").select("amount").eq("transaction_type", "refund");
      const CREDIT_PRICE_CENTS = 10.0;
      const p = (purchases || []).reduce((s, r) => s + (r.amount || 0), 0);
      const r = (refunds || []).reduce((s, r) => s + Math.abs(r.amount || 0), 0);
      setRevenue(Math.max(0, Math.round((p - r) * CREDIT_PRICE_CENTS)));
    } catch { /* silent */ }
  };

  const fetchApiCost = async () => {
    try {
      const fetchAll = async (table: string, select: string) => {
        const rows: any[] = []; let off = 0;
        while (true) {
          const { data } = await supabase.from(table as any).select(select).range(off, off + 999);
          if (!data || !data.length) break; rows.push(...data);
          if (data.length < 1000) break; off += 1000;
        }
        return rows;
      };
      const [api, clips] = await Promise.all([fetchAll("api_cost_logs", "service, status, real_cost_cents"), fetchAll("video_clips", "retry_count")]);
      let cost = 0, ops = 0;
      api.forEach((l: any) => { ops++; cost += l.real_cost_cents || 0; });
      const retries = clips.reduce((s: number, c: any) => s + (c.retry_count || 0), 0);
      cost += retries * 5; // replicate-kling fallback cost per retry
      setApiCost(cost); setTotalOps(ops + retries);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchProfitData(); fetchRevenue(); fetchApiCost(); }, []);

  const profit = revenue - apiCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatPill icon={DollarSign} label="Revenue" value={fmt(revenue)} sub={revenue === 0 ? "No purchases yet" : "Stripe purchases"} accent="success" />
        <StatPill icon={ArrowDownRight} label="API Cost" value={fmt(apiCost)} sub={`${totalOps.toLocaleString()} operations`} accent="destructive" />
        <StatPill icon={TrendingUp} label="Net Profit" value={fmt(profit)} accent="primary" />
        <StatPill icon={BarChart3} label="Margin" value={fmtPct(margin)} sub="Target: 70-80%" accent={margin >= 70 ? "success" : margin >= 50 ? "warning" : "destructive"} />
      </div>

      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/40" /> Cost Breakdown by Service
          </h3>
        </div>
        {profitData.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Coins className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm">No cost data yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "Service", "Ops", "Revenue", "Cost", "Margin"].map((h, i) => (
                    <th key={h} className={cn("py-3 px-5 text-[11px] font-semibold text-white/30 uppercase tracking-wider", i >= 2 ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitData.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-5 text-sm text-white/70">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="py-3 px-5"><Badge variant="secondary" className="text-[10px] bg-white/[0.04] text-white/50">{row.service}</Badge></td>
                    <td className="py-3 px-5 text-sm text-right text-white/40">{row.total_operations.toLocaleString()}</td>
                    <td className="py-3 px-5 text-sm text-right text-success">{fmt(row.estimated_revenue_cents)}</td>
                    <td className="py-3 px-5 text-sm text-right text-destructive">{fmt(row.total_real_cost_cents)}</td>
                    <td className="py-3 px-5 text-right">
                      <span className={cn("text-sm font-medium", row.profit_margin_percent >= 70 ? "text-success" : row.profit_margin_percent >= 50 ? "text-warning" : "text-destructive")}>
                        {fmtPct(row.profit_margin_percent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Button onClick={() => { fetchProfitData(); fetchRevenue(); fetchApiCost(); }} variant="ghost" size="sm" className="text-xs text-white/30 hover:text-white/60">
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
      </Button>
    </div>
  );
}
