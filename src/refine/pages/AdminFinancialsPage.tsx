/**
 * Admin Financials Page — Revenue, API costs, profit margins.
 * Extracted from Admin.tsx financials tab.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, BarChart3, ArrowDownRight, RefreshCw,
} from "lucide-react";
import {
  StatOrb, FloatSection, FloatTable, StatusPill, DeckButton,
  CYAN, ROSE, ACCENT_HSL, AMBER,
} from "@/admin/ui/primitives";

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
      // Revenue = real Polar purchases only. Credit-refunds from failed
      // generations are internal credit grants, NOT cash refunds — they
      // must never be subtracted from revenue. Cash refunds would arrive
      // via Polar webhooks as a separate transaction class.
      const CREDIT_PRICE_CENTS = 10.0;

      // Revenue total must cover ALL purchases, not just the latest 100.
      // Previously this summed a .limit(100) slice while api-cost paginated
      // everything, so profit/margin were structurally understated (and went
      // negative) the moment the platform passed 100 sales. Paginate the full
      // set for the totals.
      let totalCredits = 0, count = 0, off = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data } = await supabase
          .from("credit_transactions")
          .select("amount")
          .eq("transaction_type", "purchase")
          // LOGIC FIX AD-6: "Revenue = real Stripe purchases only" (header
          // comment) — exclude manual/promo grants without a Stripe id, which
          // were booked as cash and overstated revenue/margin.
          .not("stripe_payment_id", "is", null)
          .range(off, off + 999);
        if (!data || !data.length) break;
        for (const r of data as { amount: number | null }[]) { totalCredits += r.amount || 0; count++; }
        if (data.length < 1000) break;
        off += 1000;
      }
      setCreditsSold(totalCredits);
      setPurchaseCount(count);
      setRevenue(Math.round(totalCredits * CREDIT_PRICE_CENTS));

      // Latest 100 rows only for the on-screen purchases table + buyer hydration.
      const { data: rows } = await supabase
        .from("credit_transactions")
        .select("id, user_id, amount, description, stripe_payment_id, created_at")
        .eq("transaction_type", "purchase")
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (rows || []) as PurchaseRow[];
      setPurchases(list);

      // Hydrate emails for buyer identification
      const userIds = Array.from(new Set(list.map(r => r.user_id))).filter(Boolean);
      if (userIds.length) {
        const { data: profs } = await (
          supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: Array<Record<string, unknown>> | null }>
        )("admin_profiles_by_ids", { p_ids: userIds });
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
    <div className="space-y-12 animate-fade-in">
      {/* KPI rail — floating figures */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-12 lg:grid-cols-4">
        <StatOrb index={0} icon={DollarSign} aura={CYAN} accentNumber label="Revenue" value={fmt(revenue)} sub={`${purchaseCount} purchase${purchaseCount === 1 ? "" : "s"} · ${creditsSold} credits sold`} />
        <StatOrb index={1} icon={ArrowDownRight} aura={ROSE} label="API Cost" value={fmt(apiCost)} sub={`${totalOps.toLocaleString()} operations`} />
        <StatOrb index={2} icon={TrendingUp} aura={ACCENT_HSL} label="Net Profit" value={fmt(profit)} />
        <StatOrb index={3} icon={BarChart3} aura={margin >= 70 ? CYAN : margin >= 50 ? AMBER : ROSE} label="Margin" value={fmtPct(margin)} sub="Target: 70-80%" />
      </div>

      {/* Recent Polar purchases — Polar.sh is the billing provider; the legacy
          stripe_payment_id column holds the Polar payment id. (admin-review relabel) */}
      <FloatSection title="Recent Polar purchases" meta={`${purchases.length} shown`}>
        <FloatTable
          empty="No purchases yet"
          columns={[
            { key: "date", label: "Date" },
            { key: "buyer", label: "Buyer" },
            { key: "credits", label: "Credits", align: "right" },
            { key: "usd", label: "USD", align: "right" },
            { key: "payment", label: "Payment" },
            { key: "description", label: "Description" },
          ]}
          rows={purchases.map((p) => ({
            _key: p.id,
            date: <span className="text-white/60">{new Date(p.created_at).toLocaleString()}</span>,
            buyer: <span className="text-white/80">{emailById[p.user_id] || p.user_id.slice(0, 8)}</span>,
            credits: <span className="font-mono" style={{ color: CYAN }}>+{p.amount}</span>,
            usd: <span className="font-mono" style={{ color: CYAN }}>{fmt(p.amount * 10)}</span>,
            payment: <span className="font-mono text-[10px] text-white/40">{p.stripe_payment_id?.slice(0, 18) || "—"}</span>,
            description: <span className="block max-w-xs truncate text-white/40">{p.description || "—"}</span>,
          }))}
        />
      </FloatSection>

      {/* Cost breakdown by service */}
      <FloatSection title="Cost breakdown by service">
        <FloatTable
          empty="No cost data yet"
          columns={[
            { key: "date", label: "Date" },
            { key: "service", label: "Service" },
            { key: "ops", label: "Ops", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "cost", label: "Cost", align: "right" },
            { key: "margin", label: "Margin", align: "right" },
          ]}
          rows={profitData.map((row, idx) => ({
            _key: idx,
            date: <span className="text-white/70">{new Date(row.date).toLocaleDateString()}</span>,
            service: <StatusPill tone="neutral">{row.service}</StatusPill>,
            ops: <span className="text-white/40">{row.total_operations.toLocaleString()}</span>,
            revenue: <span style={{ color: CYAN }}>{fmt(row.estimated_revenue_cents)}</span>,
            cost: <span style={{ color: ROSE }}>{fmt(row.total_real_cost_cents)}</span>,
            margin: (
              <span className="font-medium" style={{ color: row.profit_margin_percent >= 70 ? CYAN : row.profit_margin_percent >= 50 ? AMBER : ROSE }}>
                {fmtPct(row.profit_margin_percent)}
              </span>
            ),
          }))}
        />
      </FloatSection>

      <DeckButton onClick={() => { fetchProfitData(); fetchRevenue(); fetchApiCost(); }}>
        <RefreshCw className="h-3.5 w-3.5" /> Refresh
      </DeckButton>
    </div>
  );
}
