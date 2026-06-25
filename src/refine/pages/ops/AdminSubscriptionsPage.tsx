/** Subscriptions — local mirror of Stripe subscriptions table. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton, StatusPill } from "@/admin/ui/primitives";
import { Input } from "@/components/ui/input";
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
        <DeckButton onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </DeckButton>
      }
    >
      <FloatSection
        title="Subscriptions"
        meta="Live Stripe mirror"
        actions={
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <Input
              placeholder="Filter by status, Stripe ID, customer, product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-72 bg-transparent border-white/10 text-white placeholder:text-white/30"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <FloatTable
            columns={[
              { key: "status", label: "Status" },
              { key: "product", label: "Product" },
              { key: "customer", label: "Customer" },
              { key: "seats", label: "Seats", align: "right" },
              { key: "periodEnd", label: "Period End" },
              { key: "env", label: "Env" },
              { key: "stripe", label: "Stripe Sub" },
            ]}
            rows={loading ? [] : pg.slice.map((r) => ({
              _key: r.id,
              status: (
                <StatusPill tone={r.status === "active" || r.status === "trialing" ? "positive" : r.status === "past_due" ? "danger" : "neutral"}>
                  {r.status}{r.cancel_at_period_end ? " · cancel" : ""}
                </StatusPill>
              ),
              product: <span className="text-white/80 font-mono text-[11px]">{r.product_id ?? "—"}</span>,
              customer: <span className="text-white/40 font-mono text-[10px]">{r.stripe_customer_id ?? r.user_id?.slice(0,8) ?? "—"}</span>,
              seats: <span className="text-white/80 font-mono tabular-nums text-[12px]">{r.seats ?? 1}</span>,
              periodEnd: <span className="text-white/60 font-mono text-[11px] whitespace-nowrap">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}</span>,
              env: <span className="text-white/40 font-mono text-[10px]">{r.environment ?? "—"}</span>,
              stripe: <span className="text-white/40 font-mono text-[10px]">{r.stripe_subscription_id?.slice(0,18) ?? "—"}…</span>,
            }))}
            empty={loading ? "Loading…" : "No subscriptions."}
          />
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="pt-4" />
      </FloatSection>
    </AdminPageShell>
  );
}
