/**
 * BusinessApprovals — /business/approvals
 *
 * Reviewer sign-off queue, org-scoped. Reuses the exact data logic from
 * WorkspaceApprovals (approval_requests + movie_projects lookups, decide
 * mutation with workspace_audit_events trail, reviewer permission gate),
 * re-skinned into the borderless cover-hero BusinessPage language.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, Film } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, StatCard, SectionHead, EmptyState, SkeletonRows, Badge, StaggerList, StaggerItem } from "@/components/business/BusinessPage";
import { ChartCard, DonutChart, ChartLegend, CHART_AMBER, CHART_EMERALD, CHART_ROSE } from "@/components/business/BusinessCharts";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { cn } from "@/lib/utils";

interface ApprovalRow {
  id: string;
  project_id: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  reviewer_note: string | null;
  submitted_by: string;
  reviewed_at: string | null;
  created_at: string;
  project_title?: string;
  project_thumb?: string | null;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function ApprovalsContent() {
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canReview = hasPermission("reviewer");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("approval_requests")
      .select("id, project_id, status, note, reviewer_note, submitted_by, reviewed_at, created_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map((r) => r.project_id);
    const projMap: Record<string, { title: string; thumb: string | null }> = {};
    if (ids.length > 0) {
      const { data: projs } = await supabase
        .from("movie_projects")
        .select("id, title, thumbnail_url")
        .in("id", ids);
      for (const p of projs ?? []) projMap[p.id] = { title: p.title, thumb: p.thumbnail_url };
    }
    setRows((data ?? []).map((r) => ({
      ...(r as ApprovalRow),
      project_title: projMap[r.project_id]?.title ?? "Untitled production",
      project_thumb: projMap[r.project_id]?.thumb ?? null,
    })));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (row: ApprovalRow, status: "approved" | "rejected") => {
    if (!user || !canReview) return;
    setBusyId(row.id);
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status,
        reviewer_id: user.id,
        reviewer_note: noteDraft[row.id] ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error(safeErrorMessage(error, "Couldn't update approval."));
      return;
    }
    toast.success(status === "approved" ? "Approved" : "Rejected");
    // Best-effort audit trail
    if (currentOrg) {
      await supabase.from("workspace_audit_events").insert({
        organization_id: currentOrg.id,
        actor_id: user.id,
        category: "approvals",
        action: status === "approved" ? "approval.approved" : "approval.rejected",
        target_kind: "project",
        target_id: row.project_id,
        metadata: { request_id: row.id },
      });
    }
    void load();
  };

  const pending = rows.filter((r) => r.status === "pending");
  const closed = rows.filter((r) => r.status !== "pending");

  const stats = useMemo(() => {
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    const pendingCount = rows.filter((r) => r.status === "pending").length;
    const decided = approved + rejected;
    const approvalRate = decided ? Math.round((approved / decided) * 100) : 0;
    const donut = [
      { name: "Pending", value: pendingCount, color: CHART_AMBER },
      { name: "Approved", value: approved, color: CHART_EMERALD },
      { name: "Rejected", value: rejected, color: CHART_ROSE },
    ];
    return { approved, rejected, pendingCount, decided, approvalRate, donut };
  }, [rows]);

  const showPending = statusFilter === "all" || statusFilter === "pending";
  const visibleClosed =
    statusFilter === "all" ? closed
      : statusFilter === "approved" ? closed.filter((r) => r.status === "approved")
      : statusFilter === "rejected" ? closed.filter((r) => r.status === "rejected")
      : [];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Pending" value={stats.pendingCount} accent loading={loading} hint="Awaiting sign-off" />
          <StatCard label="Decided" value={stats.decided} loading={loading} hint={`${stats.approved} approved · ${stats.rejected} rejected`} />
          <StatCard label="Approval rate" value={loading ? "—" : `${stats.approvalRate}%`} loading={loading} hint="Approved of decided" />
        </div>
        <ChartCard title="Decision mix" subtitle="All requests in the workspace">
          {loading ? (
            <div className="h-[170px] rounded-xl bg-white/[0.02] animate-pulse" />
          ) : rows.length === 0 ? (
            <div className="h-[170px] flex items-center justify-center text-center">
              <p className="text-[13px] text-white/40 font-light max-w-xs">No approval requests yet.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2"><DonutChart data={stats.donut} height={170} centerValue={rows.length} centerLabel="Requests" /></div>
              <ChartLegend className="sm:w-1/2 sm:flex-col sm:gap-2.5" items={stats.donut.map((d) => ({ label: d.name, color: d.color, value: d.value }))} />
            </div>
          )}
        </ChartCard>
      </div>

      <div className="mt-8 flex items-center gap-1 p-1 rounded-xl ring-1 ring-white/[0.07] bg-white/[0.015] w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "px-3.5 h-8 rounded-lg text-[12px] font-light transition-colors",
              statusFilter === f.key ? "bg-[hsl(215,90%,55%)] text-white" : "text-white/55 hover:text-white/85",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showPending && <SectionHead label="Awaiting review" count={loading ? undefined : pending.length} />}
      {showPending && (
      loading ? (
        <SkeletonRows rows={3} />
      ) : pending.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing pending review."
          description="When a Producer submits a production for sign-off, reviewers see it here with approve and reject controls."
        />
      ) : (
        <StaggerList className="rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
          {pending.map((row) => (
            <StaggerItem key={row.id} className="p-5 flex flex-col md:flex-row gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-xl ring-1 ring-white/10 bg-white/[0.04] flex items-center justify-center overflow-hidden shrink-0">
                  {row.project_thumb
                    ? <img src={row.project_thumb} alt="" className="w-full h-full object-cover" />
                    : <Film className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-white/90 font-light truncate">{row.project_title}</div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                    <Clock className="w-3 h-3" />Submitted {new Date(row.created_at).toLocaleString()}
                  </div>
                  {row.note && <div className="mt-2 text-[12.5px] text-white/55 italic font-light">"{row.note}"</div>}
                  {canReview && (
                    <textarea
                      placeholder="Reviewer note (optional)…"
                      rows={2}
                      value={noteDraft[row.id] ?? ""}
                      onChange={(e) => setNoteDraft((s) => ({ ...s, [row.id]: e.target.value }))}
                      className="mt-3 w-full max-w-xl px-3.5 py-2.5 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[13px] text-white placeholder:text-white/35 outline-none resize-none transition"
                    />
                  )}
                </div>
              </div>
              <div className="flex md:flex-col gap-2 shrink-0 items-stretch md:w-36">
                <button
                  type="button"
                  disabled={!canReview || busyId === row.id}
                  onClick={() => void decide(row, "approved")}
                  className="inline-flex items-center justify-center gap-2 flex-1 md:flex-none h-10 px-4 rounded-xl bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} /> Approve
                </button>
                <button
                  type="button"
                  disabled={!canReview || busyId === row.id}
                  onClick={() => void decide(row, "rejected")}
                  className="inline-flex items-center justify-center gap-2 flex-1 md:flex-none h-10 px-4 rounded-xl ring-1 ring-rose-400/30 bg-rose-400/10 text-rose-200/90 text-[13px] font-medium hover:bg-rose-400/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="w-4 h-4" strokeWidth={1.8} /> Reject
                </button>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      ))}

      {!loading && visibleClosed.length > 0 && (
        <>
          <SectionHead label={statusFilter === "all" ? "Recent decisions" : `${STATUS_FILTERS.find((f) => f.key === statusFilter)?.label} decisions`} count={Math.min(visibleClosed.length, 50)} />
          <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
            {visibleClosed.slice(0, 50).map((row) => (
              <div key={row.id} className="flex items-center gap-3.5 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <Clock className="w-3.5 h-3.5 text-white/35 shrink-0" />
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 w-44 shrink-0">
                  {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : "—"}
                </div>
                <Badge tone={row.status === "approved" ? "good" : "bad"} className="shrink-0">{row.status}</Badge>
                <div className="flex-1 truncate text-[13px] text-white/80">{row.project_title}</div>
                {row.reviewer_note && <div className="hidden md:block text-[12px] text-white/45 italic truncate max-w-xs">"{row.reviewer_note}"</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function BusinessApprovals() {
  usePageMeta({ title: "Approvals — Business" });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Govern</span><span className="text-white/20">·</span><span>Sign-off queue</span></>}
      title="Approvals."
      subtitle="Productions awaiting reviewer sign-off before publish or export — approve or reject with an optional note."
    >
      <ApprovalsContent />
    </BusinessPage>
  );
}
