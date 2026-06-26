import { useEffect, useMemo, useState } from "react";
import { AdminContentModeration } from "@/components/admin/AdminContentModeration";
import { AdminPageShell } from "../components/AdminPageShell";
import { FloatSection } from "@/admin/ui/primitives";
import { TrendArea, Donut, CategoryBars, countBy, bucketByDay, CYAN, ROSE } from "@/admin/ui/charts";
import { supabase } from "@/integrations/supabase/client";

interface ProjectRow { is_public: boolean | null; status: string | null; created_at: string | null }

export default function AdminModerationPage() {
  const [k, setK] = useState({ total: 0, pub: 0, hidden: 0, flagged: 0 });
  const [rows, setRows] = useState<ProjectRow[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("movie_projects")
        .select("is_public,status,created_at")
        .limit(2000);
      if (!alive || !data) return;
      let pub = 0, hidden = 0, flagged = 0;
      data.forEach((r: any) => {
        if (r.is_public) pub++; else hidden++;
        if (r.status === "flagged" || r.status === "reported") flagged++;
      });
      setK({ total: data.length, pub, hidden, flagged });
      setRows(data as ProjectRow[]);
    };
    load();
    return () => { alive = false; };
  }, []);

  // Breakdowns derived from the same 2,000-row fetch — no extra query.
  const byStatus = useMemo(() => countBy(rows, (r) => r.status), [rows]);
  const visibility = useMemo(() => [
    { key: "Public", value: rows.filter((r) => r.is_public).length, color: CYAN },
    { key: "Private", value: rows.filter((r) => !r.is_public).length, color: "rgba(255,255,255,0.22)" },
  ], [rows]);
  const flaggedPerDay = useMemo(
    () => bucketByDay(rows.filter((r) => r.status === "flagged" || r.status === "reported"), (r) => r.created_at, { days: 30 }),
    [rows],
  );

  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="MOD"
      title="Moderation"
      italic="Queue."
      description="Reported assets, flagged scenes, and policy violations awaiting operator judgement."
      stats={[
        { label: "Public Assets",  value: k.total.toLocaleString(),   tone: "blue",    sub: "indexed" },
        { label: "Visible",        value: k.pub.toLocaleString(),     tone: "emerald", sub: "live to public" },
        { label: "Hidden",         value: k.hidden.toLocaleString(),  tone: "neutral", sub: "removed from feed" },
        { label: "Flagged",        value: k.flagged.toLocaleString(), tone: "rose",    sub: "needs review" },
      ]}
    >
      {rows.length > 0 && (
        <div className="mb-14 space-y-14">
          <FloatSection title="Flagged over time" meta="reported / flagged · last 30 days">
            <TrendArea data={flaggedPerDay} valueLabel="flagged" color={ROSE} height={220} />
          </FloatSection>
          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="By status" meta={`${k.total.toLocaleString()} assets`}>
              <Donut data={byStatus} centerLabel="assets" />
            </FloatSection>
            <FloatSection title="Visibility" meta="public vs private">
              <CategoryBars data={visibility} valueSuffix="assets" />
            </FloatSection>
          </div>
        </div>
      )}
      <AdminContentModeration />
    </AdminPageShell>
  );
}
