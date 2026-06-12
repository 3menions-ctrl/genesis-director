/** Referrals — per-code redemption stats via admin_list_referrals RPC. */
import { useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Search } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <Search className="w-4 h-4 text-white/40" />
          <Input
            placeholder="Filter by code or referrer email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Referrer</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Credited</th>
                <th className="text-right px-4 py-3">Pending</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
              {!loading && pg.slice.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No referral codes.</td></tr>}
              {pg.slice.map((r) => (
                <tr key={r.code_id} className="border-b border-white/[0.04] hover:bg-glass">
                  <td className="px-4 py-3"><GitBranch className="w-3 h-3 inline mr-2 text-white/30" /><span className="text-primary/80 font-mono text-[12px]">{r.code}</span></td>
                  <td className="px-4 py-3 text-white/70 font-mono text-[11px]">{r.referrer_email ?? r.referrer_id.slice(0,8) + "…"}</td>
                  <td className="px-4 py-3 text-right text-white/80 font-mono tabular-nums text-[12px]">{r.total_redemptions}</td>
                  <td className="px-4 py-3 text-right"><Badge variant="default" className="font-mono text-[10px]">{r.credited_redemptions}</Badge></td>
                  <td className="px-4 py-3 text-right">{Number(r.pending_redemptions) > 0 ? <Badge variant="secondary" className="font-mono text-[10px]">{r.pending_redemptions}</Badge> : <span className="text-white/30 font-mono text-[11px]">0</span>}</td>
                  <td className="px-4 py-3 text-white/40 font-mono text-[10px] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
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
