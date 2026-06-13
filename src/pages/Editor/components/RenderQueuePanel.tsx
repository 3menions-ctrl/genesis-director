/**
 * RenderQueuePanel — persistent ledger of every render job the user
 * has queued. Replaces the old fire-and-forget ExportPanel UX.
 *
 * Press Q to open. Each row shows aspect, project, status, time
 * elapsed, and a download link when the job lands. Failed jobs offer
 * a retry. Completed jobs can be cleared in bulk.
 */
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Loader2,
  Check,
  AlertOctagon,
  Download,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { useRenderQueue } from "@/hooks/editor/useRenderQueue";
import type { RenderJob } from "@/lib/editor/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function RenderQueuePanel({ open, onClose }: Props) {
  const reducedMotion = useReducedMotion();
  const { jobs, updateRenderJob, removeRenderJob, clearCompletedJobs } = useRenderQueue();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const retry = async (job: RenderJob) => {
    updateRenderJob(job.id, { status: "rendering", error: undefined });
    try {
      const { error } = await supabase.functions.invoke("final-assembly", {
        body: {
          projectId: job.projectId,
          aspectRatio: job.aspect,
          reframe: job.reframe,
        },
      });
      if (error) throw error;
      updateRenderJob(job.id, {
        status: "done",
        completedAt: new Date().toISOString(),
      });
      toast.success("Retry queued");
    } catch (e) {
      updateRenderJob(job.id, {
        status: "error",
        error: e instanceof Error ? e.message : "Retry failed",
      });
      toast.error("Retry failed");
    }
  };

  const completedCount = jobs.filter((j) => j.status === "done").length;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          transition={{ duration: 0.3, ease: EASE_PREMIUM }}
          className={cn(
            "fixed top-3 right-3 bottom-3 z-40",
            "w-[min(380px,calc(100vw-1.5rem))] flex flex-col",
            "rounded-2xl border border-white/[0.07]",
            "bg-[hsl(220_30%_4%/0.85)] backdrop-blur-2xl",
            "shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.75)]",
          )}
        >
          <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                <ListChecks className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
                <span>◆ Render queue</span>
              </div>
              <h3
                className="mt-1 font-display italic text-[18px] font-light tracking-tight text-foreground/95"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {jobs.length === 0 ? "Empty." : `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}.`}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground/55 hover:text-foreground transition-colors"
              aria-label="Close render queue"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </header>

          {jobs.length > 0 && (
            <div className="shrink-0 px-5 pb-2 flex items-center justify-between">
              <span className={cn(TYPE_META, "text-muted-foreground/55")}>
                {jobs.filter((j) => j.status === "rendering").length} rendering ·{" "}
                {jobs.filter((j) => j.status === "queued").length} queued ·{" "}
                {completedCount} done
              </span>
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={clearCompletedJobs}
                  className={cn(
                    TYPE_META,
                    "text-muted-foreground/65 hover:text-foreground transition-colors",
                  )}
                >
                  clear done
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
            {jobs.length === 0 ? (
              <div className="px-3 py-12 text-center">
                <Download className="h-5 w-5 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
                <p
                  className="mt-4 font-display italic text-[15px] font-light text-foreground/85"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  No renders queued.
                </p>
                <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55")}>
                  Press E to open Export
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {jobs.map((j) => (
                  <li
                    key={j.id}
                    className="rounded-md px-3 py-2 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={j.status} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-foreground/95 truncate">
                          {j.projectTitle}
                        </div>
                        <div className={cn(TYPE_META, "mt-0.5 text-muted-foreground/55 flex items-center gap-2")}>
                          <span className="font-mono">{j.aspect}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span>{relTime(j.createdAt)}</span>
                          {j.reframe && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="text-accent/75">reframe</span>
                            </>
                          )}
                        </div>
                      </div>
                      {j.status === "done" && j.outputUrl && (
                        <a
                          href={j.outputUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:text-foreground transition-colors shrink-0"
                          aria-label="Download render"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </a>
                      )}
                      {j.status === "error" && (
                        <button
                          type="button"
                          onClick={() => void retry(j)}
                          className="text-muted-foreground/65 hover:text-accent transition-colors shrink-0"
                          aria-label="Retry render"
                          title={j.error}
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRenderJob(j.id)}
                        className="text-muted-foreground/45 hover:text-rose-300 transition-colors shrink-0"
                        aria-label="Remove from queue"
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </div>
                    {j.status === "error" && j.error && (
                      <p className={cn(TYPE_META, "mt-1.5 text-rose-300/75 truncate")} title={j.error}>
                        {j.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function StatusBadge({ status }: { status: RenderJob["status"] }) {
  switch (status) {
    case "queued":
      return (
        <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/[0.06]">
          <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/65 animate-pulse" />
        </span>
      );
    case "rendering":
      return (
        <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-[hsl(var(--accent)/0.16)]">
          <Loader2 className="h-3 w-3 animate-spin text-accent" strokeWidth={1.8} />
        </span>
      );
    case "done":
      return (
        <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-400/15">
          <Check className="h-3 w-3 text-emerald-300" strokeWidth={2} />
        </span>
      );
    case "error":
      return (
        <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-rose-400/15">
          <AlertOctagon className="h-3 w-3 text-rose-300" strokeWidth={1.8} />
        </span>
      );
  }
}
