/** Subscriptions — local mirror of Stripe subscriptions table. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  seats: number | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string | null;
  created_at: string;
};

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setRows((data as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(r =>
      r.status?.toLowerCase().includes(n) ||
      r.stripe_subscription_id?.toLowerCase().includes(n) ||
      r.stripe_customer_id?.toLowerCase().includes(n) ||
      r.product_id?.toLowerCase().includes(n) ||
      r.user_id?.toLowerCase().includes(n)
    );
  }, [rows, q]);

  const active = useMemo(() => rows.filter(r => ACTIVE_STATUSES.has(r.status)).length, [rows]);
  const canceling = useMemo(() => rows.filter(r => r.cancel_at_period_end).length, [rows]);
  const pastDue = useMemo(() => rows.filter(r => r.status === "past_due").length, [rows]);
  const seats = useMemo(() => rows.filter(r => ACTIVE_STATUSES.has(r.status)).reduce((s, r) => s + (r.seats || 1), 0), [rows]);
  const pg = usePagination(filtered, 25);

  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="SUB"
      title="Subscriptions"
      italic="& Seats."
      description="Live mirror of Stripe subscriptions. Filter, audit period boundaries, surface dunning."
      stats={[
        { label: "Active", value: active, tone: "emerald" },
        { label: "Seats Sold", value: seats, tone: "blue" },
        { label: "Past Due", value: pastDue, tone: pastDue > 0 ? "rose" : "neutral" },
        { label: "Canceling EoP", value: canceling, tone: "amber" },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <Search className="w-4 h-4 text-white/40" />
          <Input
            placeholder="Filter by status, Stripe ID, customer, product…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-right px-4 py-3">Seats</th>
                <th className="text-left px-4 py-3">Period End</th>
                <th className="text-left px-4 py-3">Env</th>
                <th className="text-left px-4 py-3">Stripe Sub</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
              {!loading && pg.slice.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">No subscriptions.</td></tr>}
              {pg.slice.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "active" || r.status === "trialing" ? "default" : r.status === "past_due" ? "destructive" : "secondary"} className="font-mono text-[10px]">
                      {r.status}{r.cancel_at_period_end ? " · cancel" : ""}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-white/80 font-mono text-[11px]">{r.product_id ?? "—"}</td>
                  <td className="px-4 py-3 text-white/40 font-mono text-[10px]">{r.stripe_customer_id ?? r.user_id?.slice(0,8) ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-white/80 font-mono tabular-nums text-[12px]">{r.seats ?? 1}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-[11px] whitespace-nowrap">
                    {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/40 font-mono text-[10px]">{r.environment ?? "—"}</td>
                  <td className="px-4 py-3 text-white/40 font-mono text-[10px]">{r.stripe_subscription_id?.slice(0,18) ?? "—"}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="p-4 border-t border-white/[0.06]" />
      </AdminSurface>
    </AdminPageShell>
  );
}
