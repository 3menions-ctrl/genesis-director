/** Provider — aggregated cost & reliability per upstream provider. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton } from "@/admin/ui/primitives";
import { CategoryBars } from "@/admin/ui/charts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = { service: string; operation: string; status: string; credits_charged: number; real_cost_cents: number; duration_seconds: number | null };

export default function AdminProvidersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      // paginate all to avoid 1k cap
      const all: Row[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("api_cost_logs")
          .select("service,operation,status,credits_charged,real_cost_cents,duration_seconds")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .range(offset, offset + 999);
        if (error) { toast.error(error.message); break; }
        if (!data?.length) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (!on) return;
      setRows(all);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [reload]);

  const groups = useMemo(() => {
    const m = new Map<string, { service: string; invocations: number; failures: number; cost_cents: number; credits: number; durations: number[] }>();
    for (const r of rows) {
      const k = r.service || "unknown";
      const g = m.get(k) ?? { service: k, invocations: 0, failures: 0, cost_cents: 0, credits: 0, durations: [] };
      g.invocations++;
      if (r.status !== "success" && r.status !== "completed") g.failures++;
      g.cost_cents += r.real_cost_cents || 0;
      g.credits += r.credits_charged || 0;
      if (r.duration_seconds != null) g.durations.push(r.duration_seconds);
      m.set(k, g);
    }
    return Array.from(m.values()).map(g => ({
      ...g,
      avg_duration: g.durations.length ? Math.round(g.durations.reduce((a,b)=>a+b,0)/g.durations.length) : 0,
      success_rate: g.invocations ? Math.round(((g.invocations - g.failures) / g.invocations) * 100) : 100,
    })).sort((a,b) => b.cost_cents - a.cost_cents);
  }, [rows]);

  const totalCost = groups.reduce((s,g)=>s+g.cost_cents,0) / 100;

  const costByProvider = useMemo(() => groups.map(g => ({ key: g.service, value: g.cost_cents / 100 })), [groups]);
  const latencyByProvider = useMemo(
    () => groups.filter(g => g.avg_duration > 0).map(g => ({ key: g.service, value: g.avg_duration })).sort((a, b) => b.value - a.value),
    [groups],
  );

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="PRV"
      title="Providers"
      italic="Roster."
      description="7-day aggregated spend and reliability per upstream provider."
      stats={[
        { label: "Providers", value: groups.length, tone: "blue" },
        { label: "7d Spend", value: `$${totalCost.toFixed(2)}`, tone: "amber" },
        { label: "Invocations", value: rows.length, tone: "emerald" },
        { label: "Failures", value: groups.reduce((s,g)=>s+g.failures,0), tone: "rose" },
      ]}
      actions={<DeckButton onClick={() => setReload(k=>k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</DeckButton>}
    >
      {!loading && groups.length > 0 && (
        <div className="mb-14 grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
          <FloatSection title="Spend by provider" meta="last 7d">
            <CategoryBars data={costByProvider} formatValue={(v) => `$${v.toFixed(2)}`} />
          </FloatSection>
          <FloatSection title="Avg latency by provider" meta="seconds">
            <CategoryBars data={latencyByProvider} valueSuffix="s" emptyLabel="No latency recorded." />
          </FloatSection>
        </div>
      )}

      <FloatSection title="Providers" meta="7-day spend & reliability">
        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">Loading…</div>
        ) : (
          <FloatTable
            columns={[
              { key: "service", label: "Provider" },
              { key: "invocations", label: "Invocations", align: "right" },
              { key: "success", label: "Success", align: "right" },
              { key: "avg_duration", label: "Avg Duration", align: "right" },
              { key: "credits", label: "Credits", align: "right" },
              { key: "cost", label: "Cost (7d)", align: "right" },
            ]}
            rows={groups.map(g => ({
              _key: g.service,
              service: <span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary/80 font-mono text-[11px]">{g.service}</span>,
              invocations: <span className="text-white/70 font-mono text-[11px] tabular-nums">{g.invocations}</span>,
              success: <span className={`font-mono text-[11px] tabular-nums ${g.success_rate >= 95 ? "text-emerald-300" : g.success_rate >= 80 ? "text-amber-300" : "text-rose-300"}`}>{g.success_rate}%</span>,
              avg_duration: <span className="text-white/60 font-mono text-[11px] tabular-nums">{g.avg_duration}s</span>,
              credits: <span className="text-white/60 font-mono text-[11px] tabular-nums">{g.credits}</span>,
              cost: <span className="text-amber-300/80 font-mono text-[11px] tabular-nums">${(g.cost_cents/100).toFixed(2)}</span>,
            }))}
            empty="No provider activity in last 7 days."
          />
        )}
      </FloatSection>
    </AdminPageShell>
  );
}