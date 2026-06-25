/** Referrals — per-code redemption stats via admin_list_referrals RPC. */
import { useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Search } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton, StatusPill } from "@/admin/ui/primitives";
import { Input } from "@/components/ui/input";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  code_id: string;
  code: string;
  referrer_id: string;
  referrer_email: string | null;
  created_at: string;
  total_redemptions: number;
  credited_redemptions: number;
  pending_redemptions: number;
};

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_referrals", { p_limit: 500 });
    if (error) toast.error(error.message);
    else setRows((data as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(r =>
      r.code?.toLowerCase().includes(n) ||
      r.referrer_email?.toLowerCase().includes(n) ||
      r.referrer_id?.toLowerCase().includes(n)
    );
  }, [rows, q]);

  const totalCodes = rows.length;
  const totalConversions = useMemo(() => rows.reduce((s, r) => s + Number(r.total_redemptions || 0), 0), [rows]);
  const totalCredited = useMemo(() => rows.reduce((s, r) => s + Number(r.credited_redemptions || 0), 0), [rows]);
  const totalPending = useMemo(() => rows.reduce((s, r) => s + Number(r.pending_redemptions || 0), 0), [rows]);
  const pg = usePagination(filtered, 25);

  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="REF"
      title="Referrals"
      italic="Graph."
      description="Per-code redemption rollup — referrers, conversions, and credit flow."
      stats={[
        { label: "Codes", value: totalCodes, tone: "blue" },
        { label: "Conversions", value: totalConversions, tone: "emerald" },
        { label: "Credited", value: totalCredited, tone: "neutral" },
        { label: "Pending Credit", value: totalPending, tone: totalPending > 0 ? "amber" : "neutral" },
      ]}
      actions={
        <DeckButton onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </DeckButton>
      }
    >
      <FloatSection
        title="Referral codes"
        meta={`${filtered.length} of ${rows.length}`}
        actions={
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <Input
              placeholder="Filter by code or referrer email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 w-64 bg-transparent border-white/10 text-white placeholder:text-white/30"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <FloatTable
            columns={[
              { key: "code", label: "Code" },
              { key: "referrer", label: "Referrer" },
              { key: "total", label: "Total", align: "right" },
              { key: "credited", label: "Credited", align: "right" },
              { key: "pending", label: "Pending", align: "right" },
              { key: "created", label: "Created" },
            ]}
            rows={pg.slice.map((r) => ({
              _key: r.code_id,
              code: <><GitBranch className="w-3 h-3 inline mr-2 text-white/30" /><span className="text-primary/80 font-mono text-[12px]">{r.code}</span></>,
              referrer: <span className="text-white/70 font-mono text-[11px]">{r.referrer_email ?? r.referrer_id.slice(0, 8) + "…"}</span>,
              total: <span className="text-white/80 font-mono tabular-nums text-[12px]">{r.total_redemptions}</span>,
              credited: <StatusPill tone="accent">{r.credited_redemptions}</StatusPill>,
              pending: Number(r.pending_redemptions) > 0 ? <StatusPill tone="neutral">{r.pending_redemptions}</StatusPill> : <span className="text-white/30 font-mono text-[11px]">0</span>,
              created: <span className="text-white/40 font-mono text-[10px] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span>,
            }))}
            empty={loading ? "Loading…" : "No referral codes."}
          />
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="pt-4" />
      </FloatSection>
    </AdminPageShell>
  );
}
