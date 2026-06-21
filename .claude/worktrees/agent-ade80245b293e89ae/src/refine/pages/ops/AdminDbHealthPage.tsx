/** Database health — live row counts across key tables. */
import { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "profiles",
  "movie_projects",
  "video_clips",
  "api_cost_logs",
  "credit_transactions",
  "admin_audit_log",
  "support_messages",
  "gallery_showcase",
  "credit_packages",
  "subscriptions",
] as const;

export default function AdminDbHealthPage() {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const next: Record<string, number | null> = {};
      await Promise.all(TABLES.map(async (t) => {
        const { count, error } = await supabase.from(t as any).select("*", { count: "exact", head: true });
        next[t] = error ? null : (count ?? 0);
      }));
      if (!on) return;
      setCounts(next);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [reload]);

  const total = Object.values(counts).reduce<number>((s, v) => s + (v ?? 0), 0);

  return (
    <AdminPageShell
      eyebrow="06 // SYSTEM"
      code="DB"
      title="Database"
      italic="Health."
      description="Live row counts across critical tables — quick read on data volume and accessibility."
      stats={[
        { label: "Tables Probed", value: TABLES.length, tone: "blue" },
        { label: "Total Rows", value: total.toLocaleString(), tone: "emerald" },
        { label: "Errored", value: Object.values(counts).filter(v => v === null).length, tone: "rose" },
      ]}
      actions={<Button variant="outline" size="sm" onClick={() => setReload(k=>k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</Button>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TABLES.map(t => (
          <AdminSurface key={t} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-[#6FB6FF]" />
              <span className="text-white/80 font-mono text-[12px]">{t}</span>
            </div>
            <div className={`font-mono tabular-nums text-2xl ${counts[t] === null ? "text-rose-300" : "text-white"}`} style={{ fontFamily: "'Fraunces', serif" }}>
              {counts[t] === null ? "ERR" : (counts[t] ?? "—").toLocaleString()}
            </div>
          </AdminSurface>
        ))}
      </div>
    </AdminPageShell>
  );
}