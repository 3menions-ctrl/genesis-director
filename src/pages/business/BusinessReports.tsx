/**
 * BusinessReports — /business/reports
 *
 * Exportable summaries for finance, operations and leadership review. Reuses
 * the exact export-workspace-report edge function logic from WorkspaceReports,
 * re-skinned in the cover-hero BusinessPage language with borderless cards.
 */
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, Badge } from "@/components/business/BusinessPage";
import { GlassButton } from "@/components/foundation/Floating";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

type ReportKey = "usage_summary" | "member_burn" | "project_ledger" | "spend_events";

const REPORTS: { key: ReportKey; label: string; sub: string }[] = [
  { key: "usage_summary", label: "Monthly usage summary", sub: "Members · projects · credit burn" },
  { key: "member_burn", label: "Per-member burn", sub: "Credits consumed by each member" },
  { key: "spend_events", label: "Spend ledger", sub: "Every credit deduction with reason" },
  { key: "project_ledger", label: "Project ledger", sub: "Every project + status + cost" },
];

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function BusinessReports() {
  usePageMeta({ title: "Reports — Business" });

  const { currentOrg } = useWorkspace();
  const [range, setRange] = useState(defaultRange());
  const [busy, setBusy] = useState<string | null>(null);

  const exportReport = async (key: ReportKey, label: string) => {
    if (!currentOrg) return;
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("export-workspace-report", {
        body: { organization_id: currentOrg.id, report: key, start: range.start, end: range.end },
      });
      if (error) throw error;
      const csv = (data as { csv?: string } | null)?.csv;
      if (!csv) throw new Error("No data");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentOrg.slug}-${key}-${range.start}_to_${range.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} exported`);
    } catch (e) {
      toast.error(safeErrorMessage(e, "Export failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Optimize</span><span className="text-white/20">·</span><span>Export summaries</span></>}
      title="Reports."
      subtitle="Exportable summaries for finance, operations and leadership review — pick a window, pull the ledger."
    >
      <SectionHead label="Date range" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <label className="rounded-2xl py-3 pr-5 transition-colors">
          <span className={cn(TYPE_META, "text-white/45")}>From</span>
          <input
            type="date"
            value={range.start}
            onChange={(e) => setRange({ ...range, start: e.target.value })}
            className="mt-2 w-full bg-transparent text-[15px] text-white tabular-nums outline-none [color-scheme:dark]"
          />
          <span aria-hidden className="mt-3 block h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </label>
        <label className="rounded-2xl py-3 pr-5 transition-colors">
          <span className={cn(TYPE_META, "text-white/45")}>To</span>
          <input
            type="date"
            value={range.end}
            onChange={(e) => setRange({ ...range, end: e.target.value })}
            className="mt-2 w-full bg-transparent text-[15px] text-white tabular-nums outline-none [color-scheme:dark]"
          />
          <span aria-hidden className="mt-3 block h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </label>
      </div>

      <SectionHead label="Exports" count={REPORTS.length} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="flex items-center gap-4 rounded-2xl p-5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-white font-light truncate">{r.label}</div>
              <div className={cn(TYPE_META, "text-white/45 mt-1.5")}>{r.sub}</div>
            </div>
            <Badge tone="neutral">CSV</Badge>
            <GlassButton
              tone="accent"
              size="sm"
              disabled={busy === r.key}
              onClick={() => exportReport(r.key, r.label)}
            >
              {busy === r.key
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" strokeWidth={1.8} />}
              {busy === r.key ? "Exporting…" : "Export"}
            </GlassButton>
          </div>
        ))}
      </div>
    </BusinessPage>
  );
}
