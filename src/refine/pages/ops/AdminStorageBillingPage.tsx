/**
 * AdminStorageBillingPage — storage metering + storage→credits billing.
 * Per-user GB usage, free-tier, projected storage revenue & margin, and manual
 * recompute / run-billing actions. Backed by storage_overview / compute_storage_usage
 * / bill_storage RPCs (the monthly run is also wired to cron in production).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { HardDrive, Users, Cpu, Percent, DollarSign, RefreshCw, Play } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminPageHeader, KpiTile, AdminCard, ACCENT_HSL, accent } from "@/admin/ui/primitives";
import { DataTable } from "@/admin/ui/DataTable";

interface Row { user_id: string; name: string; gb: number; objects: number; billable_gb: number; est_charge_credits: number }
interface Overview { free_gb: number; price_credits_per_gb: number; cost_per_gb_usd: number; snapshot_day: string | null; total_gb: number; attributed_users: number; monthly_cogs_usd: number; users: Row[] }
const usd = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const col = createColumnHelper<Row>();

export default function AdminStorageBillingPage() {
  const [d, setD] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("storage_overview" as never, {} as never);
    setD((data as Overview) ?? null); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const recompute = async () => { setBusy("compute"); const { data, error } = await supabase.rpc("compute_storage_usage" as never, {} as never); if (error) toast.error(error.message); else toast.success(`Snapshotted ${data ?? 0} users`); await load(); setBusy(null); };
  const runBilling = async () => { setBusy("bill"); const { data, error } = await supabase.rpc("bill_storage" as never, {} as never); if (error) toast.error(error.message); else { const r = data as { users_billed: number; revenue_usd: number }; toast.success(`Billed ${r?.users_billed ?? 0} users · ${usd(r?.revenue_usd ?? 0)}`); } await load(); setBusy(null); };

  const projRevenue = useMemo(() => (d?.users ?? []).reduce((a, r) => a + r.est_charge_credits, 0) * 0.10, [d]);
  const margin = useMemo(() => { const cogs = d?.monthly_cogs_usd ?? 0; return projRevenue > 0 ? Math.round(((projRevenue - cogs) / projRevenue) * 100) : 0; }, [projRevenue, d]);

  const cols = useMemo(() => [
    col.accessor("name", { header: "User", cell: (c) => <span>{c.getValue() || c.row.original.user_id.slice(0, 8)}</span> }),
    col.accessor("gb", { header: "Storage", cell: (c) => <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(c.getValue()).toFixed(3)} GB</span> }),
    col.accessor("objects", { header: "Objects", cell: (c) => <span className="tabular-nums text-white/55">{Number(c.getValue()).toLocaleString()}</span> }),
    col.accessor("billable_gb", { header: "Billable", cell: (c) => <span className="tabular-nums text-white/55">{Number(c.getValue()).toFixed(3)} GB</span> }),
    col.accessor("est_charge_credits", { header: "Est. charge", cell: (c) => <span className="tabular-nums text-white/70">{Number(c.getValue()).toLocaleString()} cr</span> }),
  ], []);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="Money" title={<>Storage <span className="italic">billing</span>.</>} sub="Per-user storage metered and billed in credits above the free tier — priced for margin, posted to the ledger."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={recompute} disabled={!!busy} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"><RefreshCw className={busy === "compute" ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> Recompute</button>
            <button onClick={runBilling} disabled={!!busy} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0b0e] hover:bg-white/90 disabled:opacity-40"><Play className="h-3 w-3" /> {busy === "bill" ? "Billing…" : "Run billing"}</button>
          </div>
        } />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile index={0} label="Total storage" value={`${(d?.total_gb ?? 0).toFixed(2)} GB`} icon={HardDrive} accentNumber />
        <KpiTile index={1} label="Attributed users" value={d?.attributed_users ?? 0} icon={Users} />
        <KpiTile index={2} label="Monthly COGS" value={usd(d?.monthly_cogs_usd ?? 0)} icon={Cpu} />
        <KpiTile index={3} label="Proj. revenue" value={usd(projRevenue)} icon={DollarSign} />
        <KpiTile index={4} label="Margin" value={`${margin}%`} icon={Percent} />
        <KpiTile index={5} label="Free tier" value={`${d?.free_gb ?? 0} GB`} icon={HardDrive} />
      </div>

      <AdminCard className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[11px] text-white/55">
          <span>Price: <span style={{ color: ACCENT_HSL }}>{d?.price_credits_per_gb ?? 0} credits / GB / mo</span> (= {usd((d?.price_credits_per_gb ?? 0) * 0.10)}/GB)</span>
          <span>Cost: {usd(d?.cost_per_gb_usd ?? 0)}/GB</span>
          <span>Free tier: {d?.free_gb ?? 0} GB</span>
          <span className="text-white/35">Snapshot: {d?.snapshot_day ?? "—"}</span>
        </div>
      </AdminCard>

      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Per-user storage</div>
      {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
        : <DataTable columns={cols as never} data={d?.users ?? []} dense empty="No attributed storage yet — run Recompute." />}
    </div>
  );
}
