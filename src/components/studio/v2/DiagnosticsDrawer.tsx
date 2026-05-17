import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronRight, CircleDot, Copy, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SceneDraft, SceneEvent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// DiagnosticsDrawer — full-bleed in-app log & forensics viewer.
// Correlates the client-side SceneDraft (scene_id, prediction_id,
// credit_hold_id, event timeline) with the backend rows that the renderer +
// reserve-credits + replicate-webhook stamp asynchronously:
//   • video_clips   (shot_index → status, error_message, retry_count, …)
//   • credit_holds  (holdId    → status, amount, consumed_at, released_at)
//   • credit_transactions (projectId → recent deduct/refund history)
// Renders every failure path as a single correlated record so the user can
// see exactly where in the pipeline a scene fell out of sync.
// ─────────────────────────────────────────────────────────────────────────────

interface ClipRow {
  shot_index: number;
  status: string;
  video_url: string | null;
  error_message: string | null;
  last_error_category: string | null;
  retry_count: number | null;
  debug_attempts: number | null;
  frame_extraction_status: string | null;
  engine: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface HoldRow {
  id: string;
  status: string;
  amount: number;
  description: string | null;
  expires_at: string;
  consumed_at: string | null;
  released_at: string | null;
  created_at: string;
}

interface TxRow {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  balance_after: number | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scenes: SceneDraft[];
  projectId?: string;
  focusSceneId?: string;
}

export function DiagnosticsDrawer({ open, onClose, scenes, projectId, focusSceneId }: Props) {
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(focusSceneId ?? scenes[0]?.id ?? null);

  const holdIds = useMemo(
    () => Array.from(new Set(scenes.map(s => s.creditHoldId).filter(Boolean) as string[])),
    [scenes],
  );

  const refresh = useMemo(() => async () => {
    if (!open) return;
    setLoading(true);
    try {
      const tasks: Array<Promise<unknown>> = [];
      if (projectId) {
        tasks.push(
          supabase.from("video_clips")
            .select("shot_index,status,video_url,error_message,last_error_category,retry_count,debug_attempts,frame_extraction_status,engine,duration_seconds,created_at,updated_at,completed_at")
            .eq("project_id", projectId)
            .order("shot_index", { ascending: true })
            .then(({ data }) => setClips((data as ClipRow[]) || [])),
        );
        tasks.push(
          supabase.from("credit_transactions")
            .select("id,amount,transaction_type,description,balance_after,created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(20)
            .then(({ data }) => setTxs((data as TxRow[]) || [])),
        );
      } else {
        setClips([]); setTxs([]);
      }
      if (holdIds.length) {
        tasks.push(
          supabase.from("credit_holds")
            .select("id,status,amount,description,expires_at,consumed_at,released_at,created_at")
            .in("id", holdIds)
            .then(({ data }) => setHolds((data as HoldRow[]) || [])),
        );
      } else {
        setHolds([]);
      }
      await Promise.all(tasks);
      setLastFetch(Date.now());
    } catch (err) {
      console.warn("[diagnostics] refresh failed", err);
      toast.error("Could not load backend rows — showing client state only");
    } finally {
      setLoading(false);
    }
  }, [open, projectId, holdIds]);

  useEffect(() => { void refresh(); }, [refresh]);
  // Soft auto-refresh every 10s while open so live runs stay current.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => { void refresh(); }, 10000);
    return () => clearInterval(t);
  }, [open, refresh]);

  useEffect(() => { if (focusSceneId) setExpandedSceneId(focusSceneId); }, [focusSceneId]);

  const clipByShot = useMemo(() => new Map(clips.map(c => [c.shot_index, c])), [clips]);
  const holdById = useMemo(() => new Map(holds.map(h => [h.id, h])), [holds]);

  // Roll-up metrics
  const summary = useMemo(() => {
    const total = scenes.length;
    const failed = scenes.filter(s => s.status === "failed").length;
    const running = scenes.filter(s => s.status === "generating" || s.status === "queued").length;
    const done = scenes.filter(s => s.status === "done").length;
    const heldCr = holds.filter(h => h.status === "held").reduce((a, b) => a + b.amount, 0);
    const consumedCr = holds.filter(h => h.status === "consumed").reduce((a, b) => a + b.amount, 0);
    return { total, failed, running, done, heldCr, consumedCr };
  }, [scenes, holds]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-md"
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 38 }}
            className="fixed right-0 top-0 z-[81] flex h-dvh w-full max-w-[920px] flex-col border-l border-border/40 bg-background"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-4 border-b border-border/40 px-6 py-5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">Diagnostics</div>
                <h2 className="mt-1 font-display text-[22px] italic leading-none text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                  Pipeline forensics
                </h2>
                <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70">
                  scene_id · prediction_id · credit_hold_id · video_clips · credit_transactions
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void refresh()}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" strokeWidth={1.75} />}
                  Refresh
                </button>
                <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>

            {/* Summary ledger */}
            <div className="grid grid-cols-2 gap-px border-b border-border/40 bg-border/40 sm:grid-cols-6">
              <SummaryTile label="Scenes" value={String(summary.total)} />
              <SummaryTile label="Done" value={String(summary.done)} tone="ok" />
              <SummaryTile label="Running" value={String(summary.running)} tone={summary.running ? "warn" : "muted"} />
              <SummaryTile label="Failed" value={String(summary.failed)} tone={summary.failed ? "bad" : "muted"} />
              <SummaryTile label="Held cr" value={String(summary.heldCr)} tone={summary.heldCr ? "warn" : "muted"} />
              <SummaryTile label="Spent cr" value={String(summary.consumedCr)} tone="ok" />
            </div>

            {/* Scene list with correlated rows */}
            <div className="flex-1 overflow-y-auto premium-scroll px-6 py-6">
              {!projectId && (
                <div className="mb-4 rounded-lg border border-border/40 bg-background/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                  No project bound yet — backend rows will appear after first render dispatches.
                </div>
              )}

              <div className="space-y-3">
                {scenes.map(s => {
                  const clip = clipByShot.get(s.index);
                  const hold = s.creditHoldId ? holdById.get(s.creditHoldId) : undefined;
                  const expanded = expandedSceneId === s.id;
                  return (
                    <article key={s.id} className="overflow-hidden rounded-xl border border-border/40 bg-card/30">
                      <button
                        onClick={() => setExpandedSceneId(expanded ? null : s.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-foreground/[0.02]"
                      >
                        <SceneStatusDot status={s.status} />
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                          S{String(s.index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-light text-[13px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                          {s.location || `Scene ${s.index + 1}`}
                        </span>
                        <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 sm:inline">
                          {clip ? `clip · ${clip.status}` : "no clip row"}
                        </span>
                        <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 sm:inline">
                          {hold ? `hold · ${hold.status}` : s.creditHoldId ? "hold · loading" : "no hold"}
                        </span>
                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/50 transition-transform", expanded && "rotate-90")} />
                      </button>

                      {/* Always-visible terminal failure surface */}
                      {(s.status === "failed" || clip?.status === "failed") && (
                        <div className="border-t border-destructive/20 bg-destructive/[0.05] px-4 py-3">
                          <div className="flex items-start gap-2 font-mono text-[10px] text-destructive/90">
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold uppercase tracking-[0.2em]">
                                Terminal failure {clip?.last_error_category ? `· ${clip.last_error_category}` : ""}
                              </div>
                              <div className="mt-1 break-all text-destructive/80">
                                {s.errorReason || clip?.error_message || "No reason captured"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {expanded && (
                        <div className="border-t border-border/30 px-4 py-4">
                          {/* Correlation IDs */}
                          <div className="grid gap-2 sm:grid-cols-3">
                            <IdField label="scene_id" value={s.id} />
                            <IdField label="prediction_id" value={s.predictionId} />
                            <IdField label="credit_hold_id" value={s.creditHoldId} />
                          </div>

                          {/* video_clips row */}
                          <section className="mt-5">
                            <Header label="video_clips" sublabel={clip ? `shot ${clip.shot_index} · ${clip.status}` : "not yet written"} />
                            {clip ? (
                              <div className="mt-2 grid gap-1.5 rounded-md bg-foreground/[0.02] px-3 py-3 font-mono text-[10px] leading-relaxed text-foreground/80">
                                <KV k="engine" v={clip.engine || "—"} />
                                <KV k="duration" v={clip.duration_seconds ? `${clip.duration_seconds}s` : "—"} />
                                <KV k="retries" v={`${clip.retry_count ?? 0} (debug ${clip.debug_attempts ?? 0})`} />
                                <KV k="frame_extract" v={clip.frame_extraction_status || "—"} />
                                <KV k="error_category" v={clip.last_error_category || "—"} tone={clip.last_error_category ? "bad" : undefined} />
                                <KV k="error_message" v={clip.error_message || "—"} tone={clip.error_message ? "bad" : undefined} />
                                <KV k="video_url" v={clip.video_url ? "ready" : "—"} tone={clip.video_url ? "ok" : undefined} link={clip.video_url || undefined} />
                                <KV k="created" v={fmtTs(clip.created_at)} />
                                <KV k="updated" v={fmtTs(clip.updated_at)} />
                                {clip.completed_at && <KV k="completed" v={fmtTs(clip.completed_at)} tone="ok" />}
                              </div>
                            ) : (
                              <div className="mt-2 rounded-md border border-dashed border-border/40 px-3 py-3 font-mono text-[10px] text-muted-foreground/60">
                                Renderer has not yet inserted a clip row for shot {s.index}.
                              </div>
                            )}
                          </section>

                          {/* credit_holds row */}
                          <section className="mt-5">
                            <Header label="credit_holds" sublabel={hold ? `${hold.status} · ${hold.amount} cr` : s.creditHoldId ? "lookup pending" : "no hold placed"} />
                            {hold ? (
                              <div className="mt-2 grid gap-1.5 rounded-md bg-foreground/[0.02] px-3 py-3 font-mono text-[10px] leading-relaxed text-foreground/80">
                                <KV k="status" v={hold.status} tone={hold.status === "released" ? "warn" : hold.status === "consumed" ? "ok" : undefined} />
                                <KV k="amount" v={`${hold.amount} cr`} />
                                <KV k="description" v={hold.description || "—"} />
                                <KV k="created" v={fmtTs(hold.created_at)} />
                                <KV k="expires" v={fmtTs(hold.expires_at)} />
                                {hold.consumed_at && <KV k="consumed" v={fmtTs(hold.consumed_at)} tone="ok" />}
                                {hold.released_at && <KV k="released" v={fmtTs(hold.released_at)} tone="warn" />}
                              </div>
                            ) : null}
                          </section>

                          {/* Event timeline */}
                          <section className="mt-5">
                            <Header label="event_timeline" sublabel={`${(s.events || []).length} entries`} />
                            <EventTimeline events={s.events || []} />
                          </section>
                        </div>
                      )}
                    </article>
                  );
                })}

                {scenes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/40 px-6 py-12 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">
                    No scenes written yet — diagnostics will populate after the first render.
                  </div>
                )}
              </div>

              {/* Project-wide credit transaction tail */}
              {txs.length > 0 && (
                <section className="mt-8">
                  <Header label="credit_transactions" sublabel={`last ${txs.length} for this project`} />
                  <ol className="mt-2 divide-y divide-border/30 overflow-hidden rounded-md border border-border/30 bg-foreground/[0.015]">
                    {txs.map(t => (
                      <li key={t.id} className="flex items-center gap-3 px-3 py-2 font-mono text-[10px]">
                        <span className="w-32 shrink-0 tabular-nums text-muted-foreground/60">{fmtTs(t.created_at)}</span>
                        <span className={cn(
                          "w-20 shrink-0 uppercase tracking-[0.18em]",
                          t.transaction_type === "deduct" || t.amount < 0 ? "text-destructive/80" :
                          t.transaction_type === "refund" ? "text-amber-400" : "text-emerald-400",
                        )}>{t.transaction_type}</span>
                        <span className="w-16 shrink-0 tabular-nums text-foreground/80">{t.amount > 0 ? `+${t.amount}` : t.amount} cr</span>
                        <span className="w-20 shrink-0 text-muted-foreground/60">bal {t.balance_after ?? "—"}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground/80">{t.description || "—"}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-border/40 px-6 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60">
              <span>{lastFetch ? `Synced ${new Date(lastFetch).toLocaleTimeString()}` : "Awaiting first sync"}</span>
              <span>Auto-refresh · 10s</span>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const tc = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex flex-col bg-background px-4 py-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground/60">{label}</span>
      <span className={cn("mt-1 font-display text-[22px] leading-none tabular-nums", tc)} style={{ fontFamily: "'Fraunces', serif" }}>{value}</span>
    </div>
  );
}

function Header({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">{label}</span>
      {sublabel && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">{sublabel}</span>}
    </div>
  );
}

function IdField({ label, value }: { label: string; value?: string }) {
  const has = !!value;
  return (
    <div className="rounded-md border border-border/40 bg-foreground/[0.02] px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/60">{label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground/85">{value || "—"}</code>
        {has && (
          <button
            onClick={() => { navigator.clipboard.writeText(value!); toast.success(`${label} copied`); }}
            className="text-muted-foreground/50 transition-colors hover:text-foreground"
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function KV({ k, v, tone, link }: { k: string; v: string; tone?: "ok" | "warn" | "bad"; link?: string }) {
  const tc = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-destructive" : "text-foreground/80";
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-muted-foreground/60">{k}</span>
      <span className={cn("min-w-0 flex-1 break-all", tc)}>{v}</span>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground/60 hover:text-foreground">
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function SceneStatusDot({ status }: { status: SceneDraft["status"] }) {
  const cls =
    status === "done" ? "bg-emerald-400" :
    status === "failed" ? "bg-destructive" :
    status === "generating" ? "bg-accent animate-pulse" :
    status === "queued" ? "bg-amber-400 animate-pulse" :
    "bg-muted-foreground/40";
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cls)} />;
}

function EventTimeline({ events }: { events: SceneEvent[] }) {
  if (!events.length) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-border/40 px-3 py-3 font-mono text-[10px] text-muted-foreground/60">
        No client-side events recorded for this scene.
      </div>
    );
  }
  return (
    <ol className="mt-2 divide-y divide-border/20 overflow-hidden rounded-md border border-border/30 bg-foreground/[0.015]">
      {events.slice().reverse().map((ev, i) => (
        <li key={`${ev.ts}-${i}`} className="flex items-start gap-3 px-3 py-2 font-mono text-[10px] leading-relaxed">
          <CircleDot className={cn("mt-0.5 h-2.5 w-2.5 shrink-0", kindIconColor(ev.kind))} />
          <span className="w-20 shrink-0 tabular-nums text-muted-foreground/60">
            {new Date(ev.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
          <span className={cn("w-24 shrink-0 uppercase tracking-[0.18em]", kindIconColor(ev.kind))}>{ev.kind}</span>
          <div className="min-w-0 flex-1">
            <div className="text-foreground/85">{ev.message}</div>
            {(ev.predictionId || ev.detail) && (
              <div className="mt-0.5 truncate text-muted-foreground/50">
                {ev.predictionId ? `pred:${ev.predictionId.slice(0, 12)} ` : ""}
                {ev.detail ? ev.detail : ""}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function kindIconColor(kind: string): string {
  switch (kind) {
    case "completed": return "text-emerald-400";
    case "failed": return "text-destructive";
    case "retry":
    case "waiting":
    case "queued": return "text-amber-400";
    case "dispatched":
    case "replicate_ack":
    case "polling": return "text-accent";
    case "reserving":
    case "reserved":
    case "released": return "text-muted-foreground";
    default: return "text-muted-foreground/70";
  }
}

function fmtTs(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "2-digit" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
}

// unused but kept for icon parity
export const __icons = { Check };