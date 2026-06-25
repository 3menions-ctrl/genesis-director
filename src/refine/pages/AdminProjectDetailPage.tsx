/**
 * AdminProjectDetailPage — /admin/projects/:projectId
 *
 * Rich detail card for a single project with every admin power surfaced:
 *   • Hero — title, status, owner shortcut, thumbnail
 *   • Pipeline tab — every video clip's status, retry-failed, cancel
 *   • Costs tab — approximate credit spend attributable to this project,
 *                 plus the user's recent ledger entries that mention it
 *   • Failures tab — recent admin events + clip error messages
 *   • Tabs share a single state slice; switching is instant + URL-stable
 *
 * Fallback: when admin_get_project_detail isn't yet pushed to Supabase, the
 * page falls back to direct queries on movie_projects + video_clips, so it
 * always renders something useful.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Coins, Trash2, RefreshCcw, AlertTriangle,
  ExternalLink, ImageOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSafeNavigation } from "@/lib/navigation";
import { AdminPageShell } from "../components/AdminPageShell";
import { FloatSection, StatusPill, DeckButton } from "@/admin/ui/primitives";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProjectDetail {
  project: {
    id: string;
    user_id: string | null;
    title: string;
    status: string;
    video_url: string | null;
    thumbnail_url: string | null;
    synopsis: string | null;
    setting: string | null;
    mood: string | null;
    genre: string | null;
    universe_id: string | null;
    parent_project_id: string | null;
    is_template: boolean | null;
    target_duration_minutes: number | null;
    created_at: string;
    updated_at: string;
  };
  owner: {
    id?: string;
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    credits_balance?: number;
  };
  clip_stats: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  cost: {
    total_credits_spent: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: string;
      description: string;
      created_at: string;
    }>;
  };
  recent_events: Array<{
    id: string;
    admin_id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
}

interface ClipRow {
  id: string;
  status: string;
  shot_index: number | null;
  error_message: string | null;
  video_url: string | null;
  prompt: string | null;
}

type TabKey = "pipeline" | "costs" | "failures" | "metadata";

type PillTone = "accent" | "positive" | "warn" | "danger" | "neutral";

export default function AdminProjectDetailPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { navigate } = useSafeNavigation();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("pipeline");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "admin_get_project_detail" as never,
        { p_project_id: projectId } as never,
      );
      if (!rpcErr && rpcData) {
        setDetail(rpcData as unknown as ProjectDetail);
      } else {
        if (rpcErr) console.warn("[AdminProjectDetail] RPC failed, fallback:", rpcErr.message);
        const { data: proj, error: projErr } = await supabase
          .from("movie_projects")
          .select("*")
          .eq("id", projectId)
          .maybeSingle();
        if (projErr) throw new Error(`movie_projects: ${projErr.message}`);
        if (!proj) { setLoadError("project_not_found"); setDetail(null); return; }
        const { data: owner } = await (
          supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> }
        )("admin_get_profile", { p_user_id: proj.user_id }).maybeSingle();
        const [tAll, tDone, tFail, tPend] = await Promise.all([
          supabase.from("video_clips").select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("video_clips").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "completed"),
          supabase.from("video_clips").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "failed"),
          supabase.from("video_clips").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("status", "in", "(completed,failed)"),
        ]);
        setDetail({
          project: proj as ProjectDetail["project"],
          owner: (owner ?? {}) as ProjectDetail["owner"],
          clip_stats: {
            total: tAll.count ?? 0,
            completed: tDone.count ?? 0,
            failed: tFail.count ?? 0,
            pending: tPend.count ?? 0,
          },
          cost: { total_credits_spent: 0, transactions: [] },
          recent_events: [],
        });
      }

      // Pull clip rows for the pipeline tab (always — not in the RPC bundle).
      const { data: clipRows } = await supabase
        .from("video_clips")
        .select("id, status, shot_index, error_message, video_url, prompt")
        .eq("project_id", projectId)
        .order("shot_index", { ascending: true });
      setClips((clipRows ?? []) as ClipRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load project";
      console.error("[AdminProjectDetail] load error", e);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const retryFailedClips = async () => {
    if (!projectId) return;
    // Retry through the REAL generation path (retry-failed-clip →
    // generate-single-clip), not a raw status flip. Flipping video_clips.status
    // to 'pending' re-renders nothing: the pipeline watchdog only acts on
    // 'generating' projects via pending_video_tasks and is disabled by default,
    // so a status flip leaves the clip stuck. The edge function runs as the
    // project owner (admin-on-behalf), so spend/locks/continuity bind to them.
    const failed = clips
      .filter((c) => c.status === "failed" && c.shot_index != null)
      .sort((a, b) => (a.shot_index ?? 0) - (b.shot_index ?? 0));
    if (!failed.length) { toast.info("No failed clips to retry"); return; }
    setActing(true);
    let ok = 0, failures = 0;
    try {
      // Sequential: the edge function holds a per-project generation lock, so
      // concurrent retries 409; continuity also requires shot-order retries.
      for (const clip of failed) {
        const { data, error } = await supabase.functions.invoke("retry-failed-clip", {
          body: { projectId, clipIndex: clip.shot_index },
        });
        if (error || data?.success === false) {
          failures++;
          console.warn("[AdminProjectDetail] retry failed for shot", clip.shot_index, error?.message ?? data?.message);
        } else {
          ok++;
        }
      }
      if (ok && !failures) toast.success(`Re-queued ${ok} clip${ok === 1 ? "" : "s"} for re-render`);
      else if (ok) toast.info(`Re-queued ${ok}; ${failures} could not retry (see console)`);
      else toast.error("No clips could be retried — check continuity/locks");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setActing(false);
    }
  };

  const deleteProject = async () => {
    if (!projectId) return;
    if (!window.confirm("Delete this project permanently? This cannot be undone.")) return;
    setActing(true);
    try {
      const { error } = await supabase.rpc("admin_moderate_content", {
        p_project_id: projectId,
        p_action: "delete",
        p_reason: "Admin manual deletion",
      });
      if (error) throw error;
      toast.success("Project deleted");
      navigate("/admin/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActing(false);
    }
  };

  const statusTone = useMemo<PillTone>(() => {
    const s = (detail?.project.status || "").toLowerCase();
    if (s === "completed" || s === "done") return "positive";
    if (s === "failed" || s === "error") return "danger";
    if (s === "draft") return "neutral";
    return "warn";
  }, [detail?.project.status]);

  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="PRJ"
      title={detail?.project.title ?? "Project"}
      italic="Profile."
      description={detail?.project.synopsis ?? "Single-pane view of one project — pipeline, cost, failures, and intervention controls."}
      stats={detail ? [
        { label: "Status",     value: detail.project.status.toUpperCase(), tone: statusTone === "positive" ? "emerald" : statusTone === "danger" ? "rose" : statusTone === "neutral" ? "neutral" : "amber", sub: detail.project.is_template ? "template" : "scene" },
        { label: "Clips",      value: `${detail.clip_stats.completed}/${detail.clip_stats.total}`, tone: "blue", sub: `${detail.clip_stats.failed} failed` },
        { label: "Spend",      value: `${detail.cost.total_credits_spent.toLocaleString()}`, tone: "amber", sub: "credits (approx)" },
        { label: "Updated",    value: new Date(detail.project.updated_at).toLocaleDateString(), tone: "neutral", sub: "last touched" },
      ] : undefined}
      actions={
        <DeckButton onClick={() => navigate("/admin/projects")}>
          <ArrowLeft className="w-3 h-3" /> Back
        </DeckButton>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-white/55">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading project…</span>
        </div>
      ) : !detail ? (
        <div className="text-center py-12 text-white/65 max-w-xl mx-auto">
          <AlertCircle className="w-5 h-5 mx-auto mb-3 text-rose-300" />
          <div className="text-[15px] mb-2 text-white">Project not found.</div>
          {loadError && (
            <div className="font-mono text-[11px] text-rose-200/80 bg-rose-500/[0.06] border border-rose-500/20 rounded-md px-3 py-2 mt-3 text-left">
              {loadError}
            </div>
          )}
          <div className="mt-5 flex justify-center">
            <DeckButton onClick={() => void load()}>Retry</DeckButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-14 gap-y-12">
          {/* Left — hero + tabs */}
          <div className="space-y-12">
            {/* Hero — thumbnail + meta */}
            <div className="flex items-start gap-5">
              {detail.project.thumbnail_url ? (
                <img
                  src={detail.project.thumbnail_url}
                  alt=""
                  className="w-32 h-20 rounded-xl object-cover border border-white/[0.08] shrink-0"
                />
              ) : (
                <div className="w-32 h-20 rounded-xl border border-white/[0.08] bg-glass flex items-center justify-center text-white/35 shrink-0">
                  <ImageOff className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/35 mb-1">
                  {detail.project.id.slice(0, 8)}…
                </div>
                <h2 className="font-display text-[24px] text-white font-light truncate">
                  {detail.project.title || "Untitled scene"}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                  <StatusPill tone="accent">{detail.project.status}</StatusPill>
                  {detail.project.genre && <StatusPill>{detail.project.genre}</StatusPill>}
                  {detail.project.mood && <StatusPill>{detail.project.mood}</StatusPill>}
                  {detail.project.is_template && <StatusPill tone="warn">template</StatusPill>}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex border-b border-white/[0.05]">
                {(["pipeline", "costs", "failures", "metadata"] as TabKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={cn(
                      "px-5 py-3 text-[11px] font-mono uppercase tracking-[0.28em] transition-colors relative",
                      tab === k ? "text-white" : "text-white/35 hover:text-white/70",
                    )}
                  >
                    {k}
                    {tab === k && (
                      <span className="absolute bottom-[-1px] left-3 right-3 h-px bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-6">
                {tab === "pipeline" && (
                  <PipelineTab clips={clips} />
                )}
                {tab === "costs" && (
                  <CostsTab cost={detail.cost} />
                )}
                {tab === "failures" && (
                  <FailuresTab clips={clips} events={detail.recent_events} />
                )}
                {tab === "metadata" && (
                  <MetadataTab project={detail.project} />
                )}
              </div>
            </div>
          </div>

          {/* Right — owner + actions */}
          <div className="space-y-12">
            {/* Owner */}
            <FloatSection title="Owner">
              {detail.owner.id ? (
                <Link
                  to={`/admin/users/${detail.owner.id}`}
                  className="group flex items-center gap-3 p-3 -mx-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  {detail.owner.avatar_url ? (
                    <img
                      src={detail.owner.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-white/[0.08]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-white/[0.08] bg-glass flex items-center justify-center text-white/55 text-[12px] font-mono">
                      {(detail.owner.email?.[0] || detail.owner.display_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white truncate">
                      {detail.owner.display_name || detail.owner.email || "Unknown user"}
                    </div>
                    <div className="text-[11px] text-white/40 truncate font-mono">
                      {detail.owner.email}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/35 group-hover:text-primary" />
                </Link>
              ) : (
                <div className="text-[12px] text-white/40">No owner attached.</div>
              )}
              {typeof detail.owner.credits_balance === "number" && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/45 font-mono">
                  <Coins className="w-3 h-3" />
                  {detail.owner.credits_balance.toLocaleString()} credits available
                </div>
              )}
            </FloatSection>

            {/* Actions */}
            <FloatSection title="Intervene">
              <div className="flex flex-col items-start gap-2">
                <DeckButton
                  onClick={retryFailedClips}
                  disabled={acting || detail.clip_stats.failed === 0}
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Retry failed clips · {detail.clip_stats.failed}
                </DeckButton>
                <DeckButton onClick={deleteProject} disabled={acting}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete project
                </DeckButton>
              </div>
            </FloatSection>

            {/* Recent admin events */}
            <FloatSection title="Recent events" meta={`${detail.recent_events.length}`}>
              {detail.recent_events.length === 0 ? (
                <div className="text-[12px] text-white/35 py-2">No admin actions recorded.</div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {detail.recent_events.map((e) => (
                    <div key={e.id} className="text-[11px] font-mono border-l-2 border-white/[0.08] pl-3 py-1.5">
                      <div className="text-white/75">{e.action}</div>
                      <div className="text-white/35">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

function PipelineTab({ clips }: { clips: ClipRow[] }) {
  if (clips.length === 0) {
    return <div className="text-[12px] text-white/40 py-4">No clips yet.</div>;
  }
  return (
    <div className="space-y-1.5">
      {clips.map((c) => {
        const tone: PillTone = c.status === "completed" ? "positive"
          : c.status === "failed" ? "danger"
          : "warn";
        return (
          <div
            key={c.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.015]"
          >
            <span className="font-mono text-[10px] text-white/35 w-8 shrink-0">
              #{String(c.shot_index ?? 0).padStart(2, "0")}
            </span>
            <StatusPill tone={tone}>{c.status}</StatusPill>
            <div className="text-[12px] text-white/65 truncate flex-1">
              {c.prompt ?? c.error_message ?? "(no prompt)"}
            </div>
            {c.video_url && (
              <a
                href={c.video_url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-white"
              >
                view
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CostsTab({ cost }: { cost: ProjectDetail["cost"] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="text-4xl font-display font-light text-amber-200 tabular-nums">
          {cost.total_credits_spent.toLocaleString()}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/35 pb-2">
          credits attributed
        </div>
      </div>
      <p className="text-[11px] text-white/35 font-mono">
        Approximate — the ledger tags spend by description match, not by FK. Use the user&apos;s full ledger for absolute totals.
      </p>
      {cost.transactions.length === 0 ? (
        <div className="text-[12px] text-white/40 py-4">No matched transactions.</div>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {cost.transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.015]">
              <span className={cn(
                "font-mono text-[11px] w-16 shrink-0 tabular-nums",
                t.amount < 0 ? "text-rose-300" : "text-emerald-300",
              )}>
                {t.amount > 0 ? "+" : ""}{t.amount}
              </span>
              <div className="text-[11px] text-white/55 truncate flex-1">{t.description}</div>
              <div className="text-[10px] text-white/30 font-mono shrink-0">
                {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FailuresTab({ clips, events }: { clips: ClipRow[]; events: ProjectDetail["recent_events"] }) {
  const failed = clips.filter((c) => c.status === "failed");
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35 mb-3">
          Clip failures · {failed.length}
        </div>
        {failed.length === 0 ? (
          <div className="text-[12px] text-white/40">No failed clips.</div>
        ) : (
          <div className="space-y-1.5">
            {failed.map((c) => (
              <div key={c.id} className="px-3 py-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.04]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-rose-300" />
                  <span className="font-mono text-[10px] text-rose-300">
                    Shot #{c.shot_index ?? "?"}
                  </span>
                </div>
                <div className="text-[12px] text-rose-100/80 mt-1.5 font-mono">
                  {c.error_message ?? "(no error message)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35 mb-3">
          Admin events
        </div>
        {events.length === 0 ? (
          <div className="text-[12px] text-white/40">No admin actions recorded.</div>
        ) : (
          <div className="space-y-1.5">
            {events.map((e) => (
              <div key={e.id} className="px-3 py-2 rounded-lg bg-white/[0.015] text-[11px] font-mono">
                <div className="text-white/75">{e.action}</div>
                <div className="text-white/35">{new Date(e.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataTab({ project }: { project: ProjectDetail["project"] }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["ID", <span className="font-mono text-white/75">{project.id}</span>],
    ["Owner ID", project.user_id ? <span className="font-mono text-white/75">{project.user_id}</span> : "—"],
    ["Universe", project.universe_id ?? "—"],
    ["Parent", project.parent_project_id ?? "—"],
    ["Genre", project.genre ?? "—"],
    ["Setting", project.setting ?? "—"],
    ["Mood", project.mood ?? "—"],
    ["Target duration", project.target_duration_minutes ? `${project.target_duration_minutes} min` : "—"],
    ["Created", new Date(project.created_at).toLocaleString()],
    ["Updated", new Date(project.updated_at).toLocaleString()],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-2">
          <dt className="text-white/40 font-mono uppercase tracking-[0.22em] text-[10px]">{k}</dt>
          <dd className="text-white/85 text-right truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
