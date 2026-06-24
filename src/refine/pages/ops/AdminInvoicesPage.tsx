/** Invoices — credit purchase ledger (Stripe-backed) with export. */
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CENTS_PER_CREDIT = 10; // $0.10 / credit

type Row = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  stripe_payment_id: string | null;
  created_at: string;
};

export default function AdminInvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    // Pull last 5000 paid credit transactions (those tied to a Stripe payment)
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("id,user_id,amount,transaction_type,description,stripe_payment_id,created_at")
      .not("stripe_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) toast.error(error.message);
    else setRows((data as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(r =>
      r.stripe_payment_id?.toLowerCase().includes(n) ||
      r.description?.toLowerCase().includes(n) ||
      r.user_id?.toLowerCase().includes(n) ||
      r.transaction_type?.toLowerCase().includes(n)
    );
  }, [rows, q]);

  const ytdStart = useMemo(() => { const d = new Date(); d.setMonth(0,1); d.setHours(0,0,0,0); return d; }, []);
  const ytd = useMemo(() => rows.filter(r => new Date(r.created_at) >= ytdStart), [rows, ytdStart]);
  const grossCents = useMemo(() => ytd.filter(r => r.amount > 0).reduce((s, r) => s + r.amount * CENTS_PER_CREDIT, 0), [ytd]);
  const refundsCents = useMemo(() => ytd.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount) * CENTS_PER_CREDIT, 0), [ytd]);
  const pg = usePagination(filtered, 25);

  function exportCsv() {
    const header = "created_at,user_id,type,amount_credits,amount_usd,stripe_payment_id,description\n";
    const body = filtered.map(r => [
      r.created_at, r.user_id, r.transaction_type, r.amount,
      (r.amount * CENTS_PER_CREDIT / 100).toFixed(2),
      r.stripe_payment_id ?? "",
      (r.description ?? "").replace(/"/g, '""'),
    ].map(v => `"${String(v)}"`).join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `invoices-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="INV"
      title="Invoices"
      italic="& Receipts."
      description="Credit purchase ledger — every Stripe-backed transaction with full audit trail."
      stats={[
        { label: "Transactions YTD", value: ytd.length, tone: "blue" },
        { label: "Gross YTD", value: `$${(grossCents/100).toFixed(2)}`, tone: "emerald" },
        { label: "Refunds YTD", value: `$${(refundsCents/100).toFixed(2)}`, tone: refundsCents > 0 ? "rose" : "neutral" },
        { label: "Total Ledger", value: rows.length, tone: "amber" },
      ]}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
          </Button>
        </>
      }
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[#e7ebf3] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#9aa4b8]" />
          <Input
            placeholder="Filter by Stripe ID, user, type, description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent border-[#e7ebf3] text-[#0c1426] placeholder:text-[#9aa4b8]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7ebf3] text-[10px] uppercase tracking-[0.18em] text-[#9aa4b8] font-mono">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Credits</th>
                <th className="text-right px-4 py-3">USD</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Stripe Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#9aa4b8]">Loading…</td></tr>}
              {!loading && pg.slice.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#9aa4b8]">No invoices.</td></tr>}
              {pg.slice.map((r) => (
                <tr key={r.id} className="border-b border-[#e7ebf3] hover:bg-glass">
                  <td className="px-4 py-3 text-[#0c1426] font-mono text-[11px] whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className="font-mono text-[10px]">{r.transaction_type}</Badge></td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums text-[12px] ${r.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}>{r.amount > 0 ? "+" : ""}{r.amount}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums text-[12px] ${r.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}>${(r.amount * CENTS_PER_CREDIT / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[#9aa4b8] font-mono text-[10px]">{r.user_id.slice(0,8)}…</td>
                  <td className="px-4 py-3 text-[#5d6a82] font-mono text-[10px]">{r.stripe_payment_id?.slice(0,24) ?? "—"}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="p-4 border-t border-[#e7ebf3]" />
      </AdminSurface>
    </AdminPageShell>
  );
}
