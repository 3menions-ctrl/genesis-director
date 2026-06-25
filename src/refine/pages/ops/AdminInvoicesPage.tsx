/** Invoices — credit purchase ledger (Polar-backed; payment id stored in legacy stripe_payment_id column) with export. */
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton, StatusPill } from "@/admin/ui/primitives";
import { Input } from "@/components/ui/input";
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
    // Pull last 5000 paid credit transactions (those tied to a payment;
    // stripe_payment_id is the legacy column name, populated by Polar as polar_<id>)
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
      description="Credit purchase ledger — every Polar-backed transaction with full audit trail."
      stats={[
        { label: "Transactions YTD", value: ytd.length, tone: "blue" },
        { label: "Gross YTD", value: `$${(grossCents/100).toFixed(2)}`, tone: "emerald" },
        { label: "Refunds YTD", value: `$${(refundsCents/100).toFixed(2)}`, tone: refundsCents > 0 ? "rose" : "neutral" },
        { label: "Total Ledger", value: rows.length, tone: "amber" },
      ]}
      actions={
        <>
          <DeckButton onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </DeckButton>
          <DeckButton onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
          </DeckButton>
        </>
      }
    >
      <FloatSection
        title="Ledger"
        meta="Polar-backed transactions"
        actions={
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <Input
              placeholder="Filter by payment ID, user, type, description…"
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
              { key: "date", label: "Date" },
              { key: "type", label: "Type" },
              { key: "credits", label: "Credits", align: "right" },
              { key: "usd", label: "USD", align: "right" },
              { key: "user", label: "User" },
              { key: "stripe", label: "Payment ID" },
            ]}
            rows={loading ? [] : pg.slice.map((r) => ({
              _key: r.id,
              date: <span className="font-mono text-[11px] whitespace-nowrap text-white/70">{new Date(r.created_at).toLocaleString()}</span>,
              type: <StatusPill tone="neutral">{r.transaction_type}</StatusPill>,
              credits: <span className={`font-mono tabular-nums text-[12px] ${r.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}>{r.amount > 0 ? "+" : ""}{r.amount}</span>,
              usd: <span className={`font-mono tabular-nums text-[12px] ${r.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}>${(r.amount * CENTS_PER_CREDIT / 100).toFixed(2)}</span>,
              user: <span className="font-mono text-[10px] text-white/40">{r.user_id.slice(0,8)}…</span>,
              stripe: <span className="font-mono text-[10px] text-white/50">{r.stripe_payment_id?.slice(0,24) ?? "—"}…</span>,
            }))}
            empty={loading ? "Loading…" : "No invoices."}
          />
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="pt-4" />
      </FloatSection>
    </AdminPageShell>
  );
}
