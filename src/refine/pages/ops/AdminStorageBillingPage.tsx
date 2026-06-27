/**
 * AdminStorageBillingPage — storage metering + storage→credits billing.
 * Per-user GB usage, free-tier, projected storage revenue & margin, and manual
 * recompute / run-billing actions. Backed by storage_overview / compute_storage_usage
 * / bill_storage RPCs (the monthly run is also wired to cron in production).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { HardDrive, Users, Cpu, Percent, DollarSign, RefreshCw, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/global-confirm";
import { AdminPageShell } from "../../components/AdminPageShell";
import { StatOrb, FloatSection, FloatTable, DeckButton, ORB_AURAS, ACCENT_HSL } from "@/admin/ui/primitives";

interface Row { user_id: string; name: string; gb: number; objects: number; billable_gb: number; est_charge_credits: number }
interface Overview { free_gb: number; price_credits_per_gb: number; cost_per_gb_usd: number; snapshot_day: string | null; total_gb: number; attributed_users: number; monthly_cogs_usd: number; users: Row[] }
const usd = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function AdminStorageBillingPage() {
  const [d, setD] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // Guard against the documented double-charge: the busy flag only blocks
  // concurrent runs, so a second click AFTER completion re-invokes bill_storage.
  // Disable the action for the rest of the session once it has succeeded.
  // (True month-idempotency must also live in the bill_storage RPC.)
  const [billedThisSession, setBilledThisSession] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("storage_overview" as never, {} as never);
    setD((data as Overview) ?? null); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const recompute = async () => { setBusy("compute"); const { data, error } = await supabase.rpc("compute_storage_usage" as never, {} as never); if (error) toast.error(error.message); else toast.success(`Snapshotted ${data ?? 0} users`); await load(); setBusy(null); };
  const runBilling = async () => {
    const ok = await confirmAsync({
      title: "Run storage billing?",
      description: "This posts real credit charges to every attributed user's ledger for this month. Only run once per month — re-running double-charges unless bill_storage is month-idempotent.",
      confirmLabel: "Charge users",
      destructive: true,
    });
    if (!ok) return;
    setBusy("bill");
    const { data, error } = await supabase.rpc("bill_storage" as never, {} as never);
    if (error) toast.error(error.message);
    else { const r = data as { users_billed: number; revenue_usd: number }; toast.success(`Billed ${r?.users_billed ?? 0} users · ${usd(r?.revenue_usd ?? 0)}`); setBilledThisSession(true); }
    await load();
    setBusy(null);
  };

  const projRevenue = useMemo(() => (d?.users ?? []).reduce((a, r) => a + r.est_charge_credits, 0) * 0.10, [d]);
  const margin = useMemo(() => { const cogs = d?.monthly_cogs_usd ?? 0; return projRevenue > 0 ? Math.round(((projRevenue - cogs) / projRevenue) * 100) : 0; }, [projRevenue, d]);

  return (
    <AdminPageShell
      eyebrow="Money // storage"
      code="STO"
      title="Storage"
      italic="billing."
      description="Per-user storage metered and billed in credits above the free tier — priced for margin, posted to the ledger."
      actions={
        <>
          <DeckButton onClick={recompute} disabled={!!busy}><RefreshCw className={busy === "compute" ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> Recompute</DeckButton>
          <DeckButton primary onClick={runBilling} disabled={!!busy || billedThisSession}><Play className="h-3 w-3" /> {busy === "bill" ? "Billing…" : billedThisSession ? "Billed ✓" : "Run billing"}</DeckButton>
        </>
      }
    >
      <div className="space-y-14">
        {/* KPI rail — floating figures */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
          <StatOrb index={0} aura={ORB_AURAS[0]} label="Total storage" value={`${(d?.total_gb ?? 0).toFixed(2)} GB`} icon={HardDrive} accentNumber />
          <StatOrb index={1} aura={ORB_AURAS[1]} label="Attributed users" value={d?.attributed_users ?? 0} icon={Users} />
          <StatOrb index={2} aura={ORB_AURAS[2]} label="Monthly COGS" value={usd(d?.monthly_cogs_usd ?? 0)} icon={Cpu} />
          <StatOrb index={3} aura={ORB_AURAS[3]} label="Proj. revenue" value={usd(projRevenue)} icon={DollarSign} />
          <StatOrb index={4} aura={ORB_AURAS[4]} label="Margin" value={`${margin}%`} icon={Percent} />
          <StatOrb index={5} aura={ORB_AURAS[5]} label="Free tier" value={`${d?.free_gb ?? 0} GB`} icon={HardDrive} />
        </div>

        <FloatSection title="Pricing" meta={`snapshot · ${d?.snapshot_day ?? "—"}`}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[11px] text-white/55">
            <span>Price: <span style={{ color: ACCENT_HSL }}>{d?.price_credits_per_gb ?? 0} credits / GB / mo</span> (= {usd((d?.price_credits_per_gb ?? 0) * 0.10)}/GB)</span>
            <span>Cost: {usd(d?.cost_per_gb_usd ?? 0)}/GB</span>
            <span>Free tier: {d?.free_gb ?? 0} GB</span>
          </div>
        </FloatSection>

        <FloatSection title="Per-user storage">
          {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
            : <FloatTable
                columns={[
                  { key: "name", label: "User" },
                  { key: "gb", label: "Storage", align: "right" },
                  { key: "objects", label: "Objects", align: "right" },
                  { key: "billable", label: "Billable", align: "right" },
                  { key: "est", label: "Est. charge", align: "right" },
                ]}
                rows={(d?.users ?? []).map((r) => ({
                  _key: r.user_id,
                  name: <span>{r.name || r.user_id.slice(0, 8)}</span>,
                  gb: <span style={{ color: ACCENT_HSL }}>{Number(r.gb).toFixed(3)} GB</span>,
                  objects: <span className="text-white/55">{Number(r.objects).toLocaleString()}</span>,
                  billable: <span className="text-white/55">{Number(r.billable_gb).toFixed(3)} GB</span>,
                  est: <span className="text-white/70">{Number(r.est_charge_credits).toLocaleString()} cr</span>,
                }))}
                empty="No attributed storage yet — run Recompute."
              />}
        </FloatSection>
      </div>
    </AdminPageShell>
  );
}
