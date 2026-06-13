/**
 * ExportPanel — multi-aspect simultaneous render.
 *
 * Press E (or click "Export" in the top bar) to open. Pick the
 * aspect ratios you want delivered — each one fires its own
 * final-assembly job on the backend, optionally going through
 * Smart Reframe if it differs from the project's native aspect.
 *
 * Status per aspect: idle → queued → rendering → done | error. The
 * panel stays open through the queue so the user sees every job
 * resolve. "Open in Library" or "Publish to reel" land when the
 * job returns a played-back URL.
 */
import { useEffect, useState } from "react";
import {
  Loader2,
  Check,
  AlertOctagon,
  Crop,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { Surface, SurfaceHeader, SurfaceBody, SurfaceFooter } from "./Surface";
import { supabase } from "@/integrations/supabase/client";
import type { AspectRatio, EditorProject } from "@/lib/editor/types";
import { ASPECT_RATIOS } from "@/lib/editor/types";
import { addRenderJob, updateRenderJob } from "@/lib/editor/renderQueue";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
  open: boolean;
  onClose: () => void;
}

type JobStatus = "idle" | "queued" | "rendering" | "done" | "error";

interface RenderJob {
  aspect: AspectRatio;
  status: JobStatus;
  message?: string;
}

const ALL_ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "21:9", "4:5", "4:3"];

export function ExportPanel({ project, open, onClose }: Props) {
  const native = project.aspectRatio;

  const [selected, setSelected] = useState<Set<AspectRatio>>(() => new Set([native]));
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [exporting, setExporting] = useState(false);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setSelected(new Set([native]));
      setJobs([]);
      setExporting(false);
    }
  }, [open, native]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, exporting, onClose]);

  const toggle = (a: AspectRatio) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      // Always keep at least one selected
      if (next.size === 0) next.add(native);
      return next;
    });
  };

  const startExport = async () => {
    if (selected.size === 0 || exporting) return;
    setExporting(true);
    const list: RenderJob[] = Array.from(selected).map((a) => ({
      aspect: a,
      status: "queued",
    }));
    setJobs(list);

    // Add each job to the persistent render queue immediately so the
    // user sees it in the Q panel even if they navigate away.
    const queueIds: string[] = list.map((job) =>
      addRenderJob({
        projectId: project.id,
        projectTitle: project.title,
        aspect: job.aspect,
        reframe: job.aspect !== native,
        status: "queued",
      }),
    );

    await Promise.all(
      list.map(async (job, i) => {
        const qid = queueIds[i];
        setJobs((curr) =>
          curr.map((j, idx) => (idx === i ? { ...j, status: "rendering" } : j)),
        );
        updateRenderJob(qid, { status: "rendering" });
        try {
          const { error } = await supabase.functions.invoke("final-assembly", {
            body: {
              projectId: project.id,
              aspectRatio: job.aspect,
              reframe: job.aspect !== native,
              // Per-boundary transition data — the FFmpeg xfade
              // filter on the backend consumes this to render the
              // exact transitions the user authored on the timeline.
              // Backwards-compatible: an older final-assembly that
              // ignores the field just renders hard cuts.
              transitions: (project.transitions ?? []).map((t) => ({
                fromClipId: t.fromClipId,
                toClipId: t.toClipId,
                kind: t.kind,
                durationSec: t.durationSec,
              })),
            },
          });
          if (error) throw error;
          setJobs((curr) =>
            curr.map((j, idx) => (idx === i ? { ...j, status: "done" } : j)),
          );
          updateRenderJob(qid, {
            status: "done",
            completedAt: new Date().toISOString(),
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[Export] job failed", job.aspect, e);
          const msg = e instanceof Error ? e.message : "Render failed";
          setJobs((curr) =>
            curr.map((j, idx) =>
              idx === i ? { ...j, status: "error", message: msg } : j,
            ),
          );
          updateRenderJob(qid, { status: "error", error: msg });
        }
      }),
    );
    setExporting(false);
    const okCount = jobs.filter((j) => j.status === "done").length;
    if (okCount > 0) {
      toast.success(`${okCount} ${okCount === 1 ? "render" : "renders"} queued`);
    }
  };

  return (
    <Surface
      open={open}
      onClose={onClose}
      size="md"
      labelledBy="export-title"
      blockBackdropClose={exporting}
      blockEscClose={exporting}
    >
      <SurfaceHeader
        id="export-title"
        eyebrow="◆ Export"
        title="Render in every aspect."
        description="Smart Reframe re-blocks non-native aspects so the subject stays centered."
        onClose={exporting ? undefined : onClose}
      />

      <SurfaceBody noPadding className="px-7 py-5">
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>
                ◆ Aspect ratios
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ALL_ASPECTS.map((a) => {
                  const dim = ASPECT_RATIOS[a];
                  const isNative = a === native;
                  const isSelected = selected.has(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggle(a)}
                      disabled={exporting}
                      className={cn(
                        "group/asp relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all",
                        "ring-1 ring-inset",
                        isSelected
                          ? "ring-accent/55 bg-[hsl(var(--accent)/0.07)]"
                          : "ring-white/[0.06] hover:ring-white/[0.18] hover:bg-white/[0.02]",
                        exporting && "opacity-65 cursor-not-allowed",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block shrink-0 rounded",
                          isSelected
                            ? "bg-accent/70"
                            : "bg-white/[0.10] group-hover/asp:bg-white/[0.18]",
                        )}
                        style={{
                          width: 28,
                          height: 28 * (dim.h / dim.w),
                          maxHeight: 32,
                          minHeight: 8,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-mono text-[12.5px] tabular-nums tracking-[0.06em] text-foreground/95">
                          {a}
                        </div>
                        <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5")}>
                          {dim.label}
                          {isNative && " · native"}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="ml-auto h-3.5 w-3.5 text-accent" strokeWidth={2} />
                      )}
                    </button>
                  );
                })}
              </div>
        {selected.size > 1 && (
          <p className={cn(TYPE_META, "mt-4 text-muted-foreground/55 flex items-center gap-2")}>
            <Crop className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>Smart Reframe re-blocks each non-native aspect so subjects stay centered</span>
          </p>
        )}

        {/* Job status — appears once exporting */}
        {jobs.length > 0 && (
          <div className="mt-6">
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-3")}>
              ◆ Status
            </div>
            <ul className="space-y-2">
              {jobs.map((j) => (
                <li
                  key={j.aspect}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="font-mono text-foreground/85">{j.aspect}</span>
                  <JobStatusBadge status={j.status} message={j.message} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </SurfaceBody>

      <SurfaceFooter className="!normal-case">
        <span className={cn(TYPE_META, "tracking-[0.30em] text-muted-foreground/55")}>
          {selected.size} {selected.size === 1 ? "aspect" : "aspects"} selected
        </span>
        <div className="flex items-center gap-4">
          {!exporting && (
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] normal-case tracking-normal text-muted-foreground/65 hover:text-foreground transition-colors font-sans"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={startExport}
            disabled={exporting || selected.size === 0}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 h-10",
              "border border-accent/40 bg-gradient-to-br from-accent/22 to-accent/6",
              "text-[13.5px] normal-case tracking-normal font-sans text-foreground transition-all",
              "hover:border-accent/60 hover:from-accent/30",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={1.5} />
            ) : (
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
            )}
            <span>{exporting ? "Rendering…" : "Render"}</span>
          </button>
        </div>
      </SurfaceFooter>
    </Surface>
  );
}

function JobStatusBadge({
  status,
  message,
}: {
  status: JobStatus;
  message?: string;
}) {
  switch (status) {
    case "queued":
      return (
        <span className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/45 animate-pulse" />
          queued
        </span>
      );
    case "rendering":
      return (
        <span className={cn(TYPE_META, "text-accent flex items-center gap-1.5")}>
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
          rendering
        </span>
      );
    case "done":
      return (
        <span className={cn(TYPE_META, "text-emerald-300/90 flex items-center gap-1.5")}>
          <Check className="h-3 w-3" strokeWidth={2} />
          queued for delivery
        </span>
      );
    case "error":
      return (
        <span
          className={cn(TYPE_META, "text-rose-300/85 flex items-center gap-1.5")}
          title={message}
        >
          <AlertOctagon className="h-3 w-3" strokeWidth={1.5} />
          {message ? "failed" : "error"}
        </span>
      );
    case "idle":
    default:
      return null;
  }
}
