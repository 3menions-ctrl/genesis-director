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
  DollarSign, TrendingUp, BarChart3, ArrowDownRight, Activity, Coins, RefreshCw, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfitData {
  date: string; service: string; total_operations: number;
  total_credits_charged: number; total_real_cost_cents: number;
  estimated_revenue_cents: number; profit_margin_percent: number;
}

interface PurchaseRow {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  stripe_payment_id: string | null;
  created_at: string;
}

// No longer use hardcoded cost map — use real_cost_cents from DB

function StatPill({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const c = { primary: "text-primary", success: "text-success", warning: "text-warning", destructive: "text-destructive", info: "text-info" }[accent || "primary"];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-glass p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-glass-hover", c)}><Icon className="w-4 h-4" /></div>
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
  const [creditsSold, setCreditsSold] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [emailById, setEmailById] = useState<Record<string, string>>({});
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
      // Revenue = real Stripe purchases only. Credit-refunds from failed
      // generations are internal credit grants, NOT cash refunds — they
      // must never be subtracted from revenue. Cash refunds would arrive
      // via Stripe webhooks as a separate transaction class.
      const { data: rows } = await supabase
        .from("credit_transactions")
        .select("id, user_id, amount, description, stripe_payment_id, created_at")
        .eq("transaction_type", "purchase")
        .order("created_at", { ascending: false })
        .limit(100);
      const CREDIT_PRICE_CENTS = 10.0;
      const list = (rows || []) as PurchaseRow[];
      const totalCredits = list.reduce((s, r) => s + (r.amount || 0), 0);
      setCreditsSold(totalCredits);
      setPurchaseCount(list.length);
      setRevenue(Math.round(totalCredits * CREDIT_PRICE_CENTS));
      setPurchases(list);

      // Hydrate emails for buyer identification
      const userIds = Array.from(new Set(list.map(r => r.user_id))).filter(Boolean);
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => {
          map[p.id] = p.display_name || p.email || p.id.slice(0, 8);
        });
        setEmailById(map);
      }
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
      const api = await fetchAll("api_cost_logs", "service, status, real_cost_cents");
      let cost = 0, ops = 0;
      api.forEach((l: any) => { ops++; cost += l.real_cost_cents || 0; });
      setApiCost(cost); setTotalOps(ops);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchProfitData(); fetchRevenue(); fetchApiCost(); }, []);

  const profit = revenue - apiCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatPill icon={DollarSign} label="Revenue" value={fmt(revenue)} sub={`${purchaseCount} purchase${purchaseCount === 1 ? "" : "s"} · ${creditsSold} credits sold`} accent="success" />
        <StatPill icon={ArrowDownRight} label="API Cost" value={fmt(apiCost)} sub={`${totalOps.toLocaleString()} operations`} accent="destructive" />
        <StatPill icon={TrendingUp} label="Net Profit" value={fmt(profit)} accent="primary" />
        <StatPill icon={BarChart3} label="Margin" value={fmtPct(margin)} sub="Target: 70-80%" accent={margin >= 70 ? "success" : margin >= 50 ? "warning" : "destructive"} />
      </div>

      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-white/40" /> Recent Stripe Purchases
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
            {purchases.length} shown
          </span>
        </div>
        {purchases.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <ShoppingCart className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No purchases yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "Buyer", "Credits", "USD", "Payment", "Description"].map((h, i) => (
                    <th key={h} className={cn("py-3 px-5 text-[11px] font-semibold text-white/30 uppercase tracking-wider", i >= 2 && i <= 3 ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-glass transition-colors">
                    <td className="py-3 px-5 text-xs text-white/60">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="py-3 px-5 text-xs text-white/80">{emailById[p.user_id] || p.user_id.slice(0, 8)}</td>
                    <td className="py-3 px-5 text-sm text-right text-success font-mono">+{p.amount}</td>
                    <td className="py-3 px-5 text-sm text-right text-success font-mono">{fmt(p.amount * 10)}</td>
                    <td className="py-3 px-5 text-[10px] text-white/40 font-mono">{p.stripe_payment_id?.slice(0, 18) || "—"}</td>
                    <td className="py-3 px-5 text-xs text-white/40 max-w-xs truncate">{p.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <tr key={idx} className="border-b border-white/[0.04] hover:bg-glass transition-colors">
                    <td className="py-3 px-5 text-sm text-white/70">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="py-3 px-5"><Badge variant="secondary" className="text-[10px] bg-glass-hover text-white/50">{row.service}</Badge></td>
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
