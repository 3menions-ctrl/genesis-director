import { useEffect, useMemo, useState } from "react";
import { AdminProjectsBrowser } from "@/components/admin/AdminProjectsBrowser";
import { AdminPageShell } from "../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";
import { FloatSection } from "@/admin/ui/primitives";
import { Donut, TrendArea, countBy, bucketByDay } from "@/admin/ui/charts";

interface ProjRow { status: string | null; created_at: string | null }

export default function AdminProjectsPage() {
  const [k, setK] = useState({ total: 0, active: 0, completed: 0, failed: 0 });
  const [rows, setRows] = useState<ProjRow[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("movie_projects" as any).select("status, created_at").limit(5000);
      if (!alive || !data) return;
      let active = 0, completed = 0, failed = 0;
      (data as ProjRow[]).forEach((r) => {
        const s = (r.status || "").toLowerCase();
        if (s === "completed" || s === "done") completed++;
        else if (s === "failed" || s === "error") failed++;
        else active++;
      });
      setK({ total: data.length, active, completed, failed });
      setRows(data as ProjRow[]);
    };
    load();
    return () => { alive = false; };
  }, []);

  // Charts derive from the same status/created_at rows already fetched above.
  const statusDist = useMemo(() => countBy(rows, (r) => r.status), [rows]);
  const perDay = useMemo(() => bucketByDay(rows, (r) => r.created_at, { days: 30 }), [rows]);

  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="PRJ"
      title="Projects"
      italic="Registry."
      description="Inspect every active render across the membrane. Filter, audit, and intervene on production assets in real time."
      stats={[
        { label: "Total Projects", value: k.total.toLocaleString(),     tone: "blue",    sub: "indexed" },
        { label: "In-Flight",      value: k.active.toLocaleString(),    tone: "amber",   sub: "rendering / queued" },
        { label: "Completed",      value: k.completed.toLocaleString(), tone: "emerald", sub: "delivered" },
        { label: "Failed",         value: k.failed.toLocaleString(),    tone: "rose",    sub: "errored" },
      ]}
    >
      {rows.length > 0 && (
        <div className="mb-14 grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
          <FloatSection title="Status mix" meta={`${rows.length} projects`}>
            <Donut data={statusDist} centerLabel="projects" />
          </FloatSection>
          <FloatSection title="Created" meta="last 30 days">
            <TrendArea data={perDay} valueLabel="projects" />
          </FloatSection>
        </div>
      )}
      <AdminProjectsBrowser />
    </AdminPageShell>
  );
}
