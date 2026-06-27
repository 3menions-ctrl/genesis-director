/** Status — composite health snapshot derived from queue + recent failures. */
import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatRow, DeckButton } from "@/admin/ui/primitives";
import { supabase } from "@/integrations/supabase/client";

type Component = { name: string; status: "operational" | "degraded" | "outage"; detail: string };

export default function AdminStatusPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const [costs, stuck, recentClips, auth] = await Promise.all([
        supabase.from("api_cost_logs").select("service,status").gte("created_at", cutoff),
        supabase.from("video_clips").select("id", { count: "exact", head: true }).in("status", ["pending","generating"]).lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()),
        supabase.from("video_clips").select("status").gte("created_at", cutoff),
        supabase.auth.getSession(),
      ]);

      const byService = new Map<string, { total: number; failed: number }>();
      for (const r of (costs.data ?? []) as { service: string; status: string }[]) {
        const g = byService.get(r.service) ?? { total: 0, failed: 0 };
        g.total++;
        if (r.status !== "success" && r.status !== "completed") g.failed++;
        byService.set(r.service, g);
      }
      const list: Component[] = Array.from(byService.entries()).map(([name, g]) => {
        const rate = g.total ? g.failed / g.total : 0;
        const status = rate >= 0.5 ? "outage" : rate >= 0.15 ? "degraded" : "operational";
        return { name, status, detail: `${g.total - g.failed}/${g.total} OK in last 15m` };
      });

      const clipsRows = (recentClips.data ?? []) as { status: string }[];
      const clipFailed = clipsRows.filter(c => c.status === "failed").length;
      const clipTotal = clipsRows.length;
      const clipRate = clipTotal ? clipFailed / clipTotal : 0;
      list.unshift({
        name: "Video Pipeline",
        status: clipRate >= 0.5 ? "outage" : clipRate >= 0.15 ? "degraded" : "operational",
        detail: clipTotal ? `${clipTotal - clipFailed}/${clipTotal} clips OK in 15m` : "Idle",
      });
      list.unshift({
        name: "Queue Watchdog",
        status: (stuck.count ?? 0) > 20 ? "outage" : (stuck.count ?? 0) > 5 ? "degraded" : "operational",
        detail: `${stuck.count ?? 0} stuck clips (>10m)`,
      });
      // Derive Database health from whether the live probe queries actually
      // succeeded — never assert "operational" blindly (it would read Nominal
      // mid-outage). All three errored → outage; some errored → degraded.
      const dbProbes = [costs.error, stuck.error, recentClips.error];
      const dbFailed = dbProbes.filter(Boolean).length;
      list.unshift({
        name: "Database",
        status: dbFailed === dbProbes.length ? "outage" : dbFailed > 0 ? "degraded" : "operational",
        detail: dbFailed === dbProbes.length
          ? "All probe queries failed"
          : dbFailed > 0
            ? `${dbFailed}/${dbProbes.length} probe queries failed`
            : "Probe queries OK (last 15m)",
      });
      // Auth derived from a real getSession() round-trip rather than pinned.
      list.unshift({
        name: "Auth",
        status: auth.error ? "outage" : "operational",
        detail: auth.error ? `getSession failed: ${auth.error.message}` : "getSession OK",
      });

      if (on) { setComponents(list); setLoading(false); }
    })();
    return () => { on = false; };
  }, [reload]);

  const overall = useMemo<"operational" | "degraded" | "outage">(() => {
    if (components.some(c => c.status === "outage")) return "outage";
    if (components.some(c => c.status === "degraded")) return "degraded";
    return "operational";
  }, [components]);

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="STA"
      title="Status"
      italic={overall === "operational" ? "Nominal." : overall === "degraded" ? "Degraded." : "Outage."}
      description="Real-time composite health derived from the live pipeline, watchdog, and provider telemetry."
      stats={[
        { label: "Overall", value: overall.toUpperCase(), tone: overall === "operational" ? "emerald" : overall === "degraded" ? "amber" : "rose" },
        { label: "Components", value: components.length, tone: "blue" },
        { label: "Healthy", value: components.filter(c => c.status === "operational").length, tone: "emerald" },
        { label: "Issues", value: components.filter(c => c.status !== "operational").length, tone: components.some(c => c.status !== "operational") ? "rose" : "neutral" },
      ]}
      actions={<DeckButton onClick={() => setReload(k=>k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</DeckButton>}
    >
      <FloatSection title="Components" meta="live health">
        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">Probing components…</div>
        ) : (
          <div>
            {components.map((c, i) => (
              <FloatRow
                key={c.name}
                last={i === components.length - 1}
                left={
                  <div className="flex items-center gap-4">
                    {c.status === "operational" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : c.status === "degraded" ? <Activity className="w-5 h-5 text-amber-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
                    <div>
                      <div className="text-white text-[14px] font-medium">{c.name}</div>
                      <div className="text-white/40 font-mono text-[11px] uppercase tracking-[0.18em] mt-0.5">{c.detail}</div>
                    </div>
                  </div>
                }
                right={
                  <span className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-[0.2em] border ${c.status === "operational" ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300" : c.status === "degraded" ? "border-amber-400/30 bg-amber-400/5 text-amber-300" : "border-rose-400/30 bg-rose-400/5 text-rose-300"}`}>{c.status}</span>
                }
              />
            ))}
          </div>
        )}
      </FloatSection>
    </AdminPageShell>
  );
}