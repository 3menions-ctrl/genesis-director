/** Database health — live row counts across key tables. */
import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatRow, DeckButton } from "@/admin/ui/primitives";
import { CategoryBars, topN } from "@/admin/ui/charts";
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

  const countBars = useMemo(
    () => topN(
      TABLES.map(t => ({ key: t, value: counts[t] ?? 0 })).filter(d => d.value > 0).sort((a, b) => b.value - a.value),
      12,
    ),
    [counts],
  );

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
      actions={<DeckButton onClick={() => setReload(k=>k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</DeckButton>}
    >
      {!loading && countBars.length > 0 && (
        <div className="mb-14">
          <FloatSection title="Row volume by table" meta="live counts">
            <CategoryBars data={countBars} valueSuffix="rows" />
          </FloatSection>
          <p className="mt-3 text-[11px] text-white/35 italic">point-in-time snapshot — live row counts, not a historical growth trend.</p>
        </div>
      )}

      <FloatSection title="Tables" meta="live row counts">
        {TABLES.map((t, i) => (
          <FloatRow
            key={t}
            last={i === TABLES.length - 1}
            left={
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-primary/80" />
                <span className="text-white/80 font-mono text-[12px]">{t}</span>
              </div>
            }
            right={
              <span className={`font-mono tabular-nums text-2xl ${counts[t] === null ? "text-rose-300" : "text-white"}`}>
                {counts[t] === null ? "ERR" : (counts[t] ?? "—").toLocaleString()}
              </span>
            }
          />
        ))}
      </FloatSection>
    </AdminPageShell>
  );
}