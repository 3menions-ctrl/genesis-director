/**
 * CreatePanel — inline scene/clip generator.
 *
 * The editor never has to send the user away to make a new clip.
 * Press N (or click "+ Create" in the top bar) to open this surface,
 * type a brief, pick a duration, hit Generate. The clip lands at the
 * end of the V1 chain as a pending atom that swaps in its rendered
 * video as soon as the edge function returns.
 *
 * Architecture:
 *   1. Optimistic insert via `appendPendingClip` so the timeline
 *      shows the clip block instantly.
 *   2. INSERT into `video_clips` with status="generating" so a
 *      refresh / second user sees the same pending state.
 *   3. POST to the `editor-generate-clip` edge function with
 *      action="submit" → receives predictionId.
 *   4. Poll the same function with action="status" every 3s until
 *      it resolves to videoUrl (succeeded) or fails.
 *   5. On success: UPDATE `video_clips` with video_url + status,
 *      then `resolvePendingClip` in the store so the block becomes
 *      playable.
 *   6. On failure: `dropPendingClip` + delete the video_clips row +
 *      refund the user via the edge function's own refund path.
 *
 * The "Start new film" button hands off to Studio for the full
 * project-creation flow — that's a different shape of work and
 * Studio's mode-router does it well.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Loader2, Film, ChevronRight, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { EditorProject } from "@/lib/editor/types";
import { useEditor } from "@/hooks/editor/useEditor";
import { toast } from "sonner";
import {
  Surface,
  SurfaceHeader,
  SurfaceBody,
  SurfaceFooter,
  SurfaceKbdHint,
} from "./Surface";

interface Props {
  project: EditorProject;
  open: boolean;
  onClose: () => void;
}

type Duration = 5 | 10;
const DURATIONS: Duration[] = [5, 10];

const ASPECT_OPTIONS: { value: string; label: string }[] = [
  { value: "16:9", label: "Wide · 16:9" },
  { value: "9:16", label: "Vertical · 9:16" },
  { value: "1:1", label: "Square · 1:1" },
  { value: "21:9", label: "Cinematic · 21:9" },
];

/**
 * In-component polling — keeps this concern local rather than
 * leaking a hook + scheduler into the global state graph. The
 * function returns a `cancel` callback so React unmount or a panel
 * close stops the poll cleanly.
 */
function pollUntilDone(
  predictionId: string,
  onUpdate: (result: { status: string; videoUrl?: string; error?: string }) => void,
): () => void {
  let cancelled = false;
  let timer: number | null = null;

  const tick = async () => {
    if (cancelled) return;
    try {
      const { data, error } = await supabase.functions.invoke<{
        status: string;
        videoUrl?: string;
        error?: string;
      }>("editor-generate-clip", {
        body: { action: "status", predictionId },
      });
      if (cancelled) return;
      if (error) {
        onUpdate({ status: "error", error: error.message });
        return;
      }
      if (!data) {
        timer = window.setTimeout(tick, 3000);
        return;
      }
      onUpdate(data);
      if (data.status === "succeeded" || data.status === "completed") return;
      if (data.status === "error" || data.status === "failed") return;
      timer = window.setTimeout(tick, 3000);
    } catch (e) {
      if (cancelled) return;
      onUpdate({ status: "error", error: e instanceof Error ? e.message : "poll_failed" });
    }
  };

  timer = window.setTimeout(tick, 1500); // first poll after a short grace
  return () => {
    cancelled = true;
    if (timer !== null) window.clearTimeout(timer);
  };
}

export function CreatePanel({ project, open, onClose }: Props) {
  const { user } = useAuth();
  const { appendPendingClip, resolvePendingClip, dropPendingClip } = useEditor();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const [prompt, setPrompt] = useState("");
  const [durationSec, setDurationSec] = useState<Duration>(5);
  const [aspect, setAspect] = useState<string>("16:9");
  const [submitting, setSubmitting] = useState(false);

  // The active poll cancel function — when the user closes the
  // panel mid-poll OR submits another clip while one is in flight,
  // we cancel the previous one to avoid leaking handlers.
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    // Pick the project's native aspect so generated clips match the
    // existing film's framing by default. User can still override.
    setAspect(project.aspectRatio);
  }, [project.aspectRatio]);

  useEffect(() => () => cancelRef.current?.(), []);

  const isOnEmptyProject = project.id === "no-project";

  const submit = async () => {
    const brief = prompt.trim();
    if (!brief) return;
    if (!user) {
      toast.error("Sign in to generate clips");
      return;
    }
    if (isOnEmptyProject) {
      toast.error("Open a project first", {
        description: "Or hit Start new film below to create one in Studio.",
      });
      return;
    }
    setSubmitting(true);

    // ── 1. Insert the video_clips row first so a refresh / collaborator
    //       sees the pending atom too. The local store will optimistically
    //       mirror this shortly after.
    const shotIndex = project.scenes.flatMap((s) => s.clips).length;
    const idempotencyKey = `cp-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const { data: rowData, error: rowErr } = await supabase
      .from("video_clips")
      .insert({
        project_id: project.id,
        user_id: user.id,
        shot_index: shotIndex,
        prompt: brief,
        duration_seconds: durationSec,
        status: "generating",
      })
      .select("id")
      .single();
    if (rowErr || !rowData) {
      setSubmitting(false);
      toast.error("Couldn't queue the clip", {
        description: rowErr?.message ?? "Database insert failed.",
      });
      return;
    }
    const clipId = rowData.id as string;

    // ── 2. Optimistic local insert so the editor reads as in-flight
    //       within the same frame the user clicked Generate.
    appendPendingClip({
      id: clipId,
      prompt: brief,
      durationSec,
      thumbnailUrl: null,
      takeNumber: 1,
    });

    // ── 3. Kick off the edge function. The submit call returns a
    //       prediction id; the polling loop translates it into a
    //       final videoUrl.
    let predictionId: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke<{
        predictionId: string;
        error?: string;
      }>("editor-generate-clip", {
        body: {
          action: "submit",
          prompt: brief,
          duration: durationSec,
          aspectRatio: aspect,
          projectId: project.id,
          idempotencyKey,
        },
      });
      if (error) throw error;
      if (!data || data.error) throw new Error(data?.error ?? "submit_failed");
      predictionId = data.predictionId;
    } catch (e) {
      // Edge submit failed — roll back local + db.
      dropPendingClip(clipId);
      void supabase.from("video_clips").delete().eq("id", clipId);
      setSubmitting(false);
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(
        msg.includes("Insufficient credits")
          ? "Not enough credits to generate this clip"
          : "Generation didn't start",
        { description: msg },
      );
      return;
    }

    // ── 4. Start polling. Toast is loading-state until the poll
    //       resolves. The composer clears + closes so the user can
    //       keep working while the prediction renders.
    setPrompt("");
    setSubmitting(false);
    onClose();

    const toastId = toast.loading("Rendering clip…", {
      description: `${durationSec}s · ${aspect} · seedance-1-pro`,
    });

    cancelRef.current?.();
    cancelRef.current = pollUntilDone(predictionId!, (result) => {
      if (result.status === "succeeded" || result.status === "completed") {
        if (!result.videoUrl) return;
        const finalUrl = result.videoUrl;
        void supabase
          .from("video_clips")
          .update({
            video_url: finalUrl,
            status: "completed",
          })
          .eq("id", clipId);
        resolvePendingClip(clipId, {
          videoUrl: finalUrl,
        });
        toast.success("Clip ready", {
          id: toastId,
          description: "It just landed at the end of your timeline.",
        });
      } else if (result.status === "error" || result.status === "failed") {
        dropPendingClip(clipId);
        void supabase.from("video_clips").delete().eq("id", clipId);
        toast.error("Generation failed", {
          id: toastId,
          description: result.error ?? "The model couldn't finish the clip.",
        });
      }
    });
  };

  const wordCount = useMemo(
    () => prompt.trim().split(/\s+/).filter(Boolean).length,
    [prompt],
  );

  return (
    <Surface
      open={open}
      onClose={onClose}
      size="md"
      labelledBy="create-title"
      blockEscClose
    >
      <SurfaceHeader
        id="create-title"
        eyebrow="◆ Create"
        title="Add a clip to this film."
        description="Describe one shot. Pick a duration. The clip lands at the end of the V1 chain when the model finishes."
        onClose={onClose}
      />
      <SurfaceBody>
        <label className="block">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em]")}>
            ◆ Brief
          </span>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 1400))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !submitting) {
                e.preventDefault();
                void submit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            rows={5}
            placeholder={
              project.scenes.flatMap((s) => s.clips).length === 0
                ? "“A dawn sky over the city, camera drifting toward a window. Inside, a figure rises.”"
                : "“The figure walks down the bridge. Cold morning light, breath visible.”"
            }
            className={cn(
              "mt-2 block w-full resize-none rounded-xl px-3.5 py-3",
              "bg-white/[0.02] text-foreground placeholder:text-foreground/35",
              "text-[14.5px] leading-snug",
              "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
              "font-display italic",
            )}
            style={{ fontFamily: "'Fraunces', serif" }}
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.20em] text-muted-foreground/45">
            <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
            <span>⌘↵ to generate · Esc to close</span>
          </div>
        </label>

        <div className="mt-5 grid grid-cols-2 gap-5">
          <div>
            <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em]")}>
              ◆ Duration
            </span>
            <div className="mt-2 flex gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationSec(d)}
                  className={cn(
                    "flex-1 h-9 rounded-md text-[12.5px] font-mono uppercase tracking-[0.18em]",
                    "ring-1 ring-inset transition-colors",
                    durationSec === d
                      ? "bg-[hsl(212_100%_60%/0.14)] text-accent ring-accent/45"
                      : "bg-white/[0.02] text-foreground/75 ring-white/[0.07] hover:bg-white/[0.05]",
                  )}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.30em]")}>
              ◆ Aspect
            </span>
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              className={cn(
                "mt-2 block w-full h-9 rounded-md px-2",
                "bg-white/[0.02] text-foreground text-[12.5px]",
                "ring-1 ring-inset ring-white/[0.07] focus:ring-accent/45 outline-none",
              )}
            >
              {ASPECT_OPTIONS.map((a) => (
                <option key={a.value} value={a.value} className="bg-[hsl(220_30%_6%)]">
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 rounded-xl ring-1 ring-inset ring-white/[0.05] bg-white/[0.012] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p
                className="font-display italic text-[14px] text-foreground/90"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {durationSec === 5 ? "65 credits" : "95 credits"} · Seedance 1 Pro
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/65 leading-snug">
                Continuity chain auto-locks the look, lighting, and characters to your previous clip — no character drift between shots.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={cn(
              "h-10 px-4 rounded-full text-[13px] text-muted-foreground/70 hover:text-foreground",
              "transition-colors disabled:opacity-40",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!prompt.trim() || submitting || isOnEmptyProject}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-full",
              "bg-[hsl(var(--accent)/0.16)] text-accent ring-1 ring-inset ring-accent/40",
              "text-[13.5px] font-display italic",
              "transition-colors hover:bg-[hsl(var(--accent)/0.24)]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" strokeWidth={1.5} />
                <span>Generate clip</span>
                <SurfaceKbdHint keys="⌘↵" />
              </>
            )}
          </button>
        </div>

        {/* Secondary action — start a whole new film. Studio is built for
            that flow; we hand off cleanly rather than reproduce it here. */}
        <div className="mt-7 pt-5 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => navigate("/studio")}
            className="group/new w-full flex items-center justify-between p-3 -mx-3 rounded-xl hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] flex items-center justify-center">
                <Plus className="h-4 w-4 text-foreground/75" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className="text-[13.5px] text-foreground/95">Start a new film</p>
                <p className="text-[11.5px] text-muted-foreground/65">Pick a mode in Studio — Director, Avatar, Trailer…</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/45 group-hover/new:text-foreground transition-colors" strokeWidth={1.5} />
          </button>
        </div>
      </SurfaceBody>
      <SurfaceFooter>
        <span className="flex items-center gap-2">
          <SurfaceKbdHint keys="N" label="open" />
          <span aria-hidden>·</span>
          <SurfaceKbdHint keys="Esc" label="close" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Film className="h-3 w-3" strokeWidth={1.5} />
          <span>{project.scenes.flatMap((s) => s.clips).length} clips on V1</span>
        </span>
      </SurfaceFooter>
    </Surface>
  );
}
