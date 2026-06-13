/**
 * TakesDrawer — versions-not-undo, surfaced.
 *
 * Floating right-side panel that appears when a clip is selected.
 * Lists every take for that clip's shot_index (from supabase
 * shot_takes, already loaded by useProject and now living on
 * clip.takes). Click a take → it becomes the active take for that
 * clip (the clip's videoUrl / thumbnailUrl / prompt swap).
 *
 * Hosts the inline AI regenerate composer at the bottom — press R
 * anywhere in the editor (with a clip selected) and the textarea
 * focuses; type a modifier ("make it night"), ⌘↵ to commit. The
 * call goes to the editor-generate-clip edge function, which
 * already exists. An optimistic pending take appears at the top of
 * the list immediately so the user sees something happen before the
 * server returns.
 *
 * Container-less inside (per the floating language); the drawer
 * itself does have a thin frosted-glass surface because it has to
 * float over the timeline / stage content and a hairless overlay
 * would mush into the canvas behind it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Wand2,
  Check,
  Loader2,
  Crown,
  Film,
  X,
  CornerDownLeft,
  Sparkles,
  Volume2,
  Eye,
  Maximize2,
  Type as TypeIcon,
  ArrowRightToLine,
  ArrowLeftToLine,
  VolumeX,
  Headphones,
  Gauge,
} from "lucide-react";
import { getClipProperty } from "@/lib/editor/types";
import { setClipProperty, addKeyframeAtPlayhead, clearKeyframes } from "@/lib/editor/store";
import { useEditor } from "@/hooks/editor/useEditor";
import { toast } from "sonner";
import { Diamond } from "lucide-react";
import type { AnimatableProperty } from "@/lib/editor/types";

function fmtTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import type {
  ClipTransition,
  EditorClip,
  EditorProject,
  EditorTake,
  TransitionKind,
} from "@/lib/editor/types";
import { TRANSITION_KINDS, TRANSITION_LABELS } from "@/lib/editor/types";
import {
  switchActiveTake,
  appendPendingTake,
  selectClip,
  selectTransition,
  updateTransition,
  removeTransition,
} from "@/lib/editor/store";
import { useEditor } from "@/hooks/editor/useEditor";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
  /** Render inline as a persistent right rail (no fixed positioning,
   *  no close button, always visible). Default false keeps the
   *  original floating-drawer behaviour for any legacy mount. */
  embedded?: boolean;
}

export function TakesDrawer({ project, selectedClipId, embedded = false }: Props) {
  const reducedMotion = useReducedMotion();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(embedded);
  const [composerOpen, setComposerOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { selectedTransitionId } = useEditor();

  const clip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const s of project.scenes) {
      const c = s.clips.find((c) => c.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [project, selectedClipId]);

  const transition: ClipTransition | null = useMemo(() => {
    if (!selectedTransitionId) return null;
    return (project.transitions ?? []).find((t) => t.id === selectedTransitionId) ?? null;
  }, [project.transitions, selectedTransitionId]);
  const transitionClips = useMemo(() => {
    if (!transition) return null;
    const all = project.scenes.flatMap((s) => s.clips);
    return {
      from: all.find((c) => c.id === transition.fromClipId) ?? null,
      to: all.find((c) => c.id === transition.toClipId) ?? null,
    };
  }, [project, transition]);

  // Auto-open the drawer the moment a clip gets selected; auto-close
  // it on deselection. In embedded mode (persistent right rail) we
  // stay open always — empty-clip state surfaces an idle hint
  // instead.
  useEffect(() => {
    if (embedded) {
      setOpen(true);
      return;
    }
    setOpen(!!clip);
  }, [clip, embedded]);

  // R key opens the composer (input-aware)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key !== "r" && e.key !== "R") return;
      if (!clip) {
        toast.message("Select a clip first to regenerate");
        return;
      }
      e.preventDefault();
      setOpen(true);
      setComposerOpen(true);
      setTimeout(() => composerRef.current?.focus(), 60);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clip]);

  const close = () => {
    setOpen(false);
    selectClip(null);
  };

  const submitRegenerate = async () => {
    if (!clip || !prompt.trim()) return;
    setSubmitting(true);
    // Optimistic pending take so the user sees something instantly.
    const optimisticId = `pending-${Date.now()}`;
    const nextTakeNumber =
      (clip.takes[0]?.takeNumber ?? 0) + 1;
    appendPendingTake(clip.id, {
      id: optimisticId,
      takeNumber: nextTakeNumber,
      promptUsed: prompt.trim(),
    });
    try {
      // editor-generate-clip is the existing edge function; the exact
      // shape may need refinement once we wire end-to-end, but this
      // matches the pattern of the rest of the AI pipeline. Failure
      // surfaces as a toast and we leave the pending take in place
      // (the user can retry).
      const { error } = await supabase.functions.invoke(
        "editor-generate-clip",
        {
          body: {
            projectId: project.id,
            clipId: clip.id,
            shotIndex: clip.index,
            takeNumber: nextTakeNumber,
            prompt: prompt.trim(),
          },
        },
      );
      if (error) throw error;
      toast.success("Take queued — it'll appear when ready");
      setPrompt("");
      setComposerOpen(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[TakesDrawer] regenerate failed", e);
      toast.error(
        e instanceof Error
          ? e.message
          : "Couldn't queue the regenerate. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Empty Inspector state in embedded mode — gentle "select a clip"
  // hint instead of unmounting.
  if (embedded && !clip) {
    return (
      <aside
        aria-label="Inspector"
        className="shrink-0 w-[340px] border-l border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex flex-col"
      >
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <Sparkles className="h-5 w-5 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-4 font-display italic text-[15px] font-light text-foreground/85"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Pick a clip to inspect.
            </p>
            <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55")}>
              click any block on the timeline
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // Transition takes priority — when a transition is selected, the
  // right rail surfaces TransitionInspector instead of the clip body.
  // Stays in embedded mode (persistent rail) only.
  if (embedded && transition && transitionClips?.from && transitionClips?.to) {
    return (
      <aside
        aria-label="Transition inspector"
        className="shrink-0 w-[340px] border-l border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex flex-col overflow-hidden"
      >
        <TransitionInspector
          transition={transition}
          fromClip={transitionClips.from}
          toClip={transitionClips.to}
        />
      </aside>
    );
  }

  if (!clip) {
    if (embedded) {
      return (
        <aside
          aria-label="Inspector"
          className="shrink-0 w-[340px] border-l border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex flex-col overflow-hidden"
        >
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <Sparkles className="h-5 w-5 text-muted-foreground/45" strokeWidth={1.4} />
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 tracking-[0.30em]")}>
              ◆ Inspector
            </p>
            <p
              className="mt-2 font-display italic text-[15px] text-foreground/75"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Select a clip or transition
            </p>
          </div>
        </aside>
      );
    }
    return null;
  }

  // ── Embedded (persistent right rail) ────────────────────────────────
  if (embedded) {
    return (
      <aside
        aria-label="Inspector"
        className="shrink-0 w-[340px] border-l border-white/[0.04] bg-[hsl(220_30%_4%/0.35)] flex flex-col overflow-hidden"
      >
        <InspectorBody
          clip={clip}
          composerOpen={composerOpen}
          setComposerOpen={setComposerOpen}
          prompt={prompt}
          setPrompt={setPrompt}
          submitting={submitting}
          submit={submitRegenerate}
          composerRef={composerRef}
          onClose={null /* persistent */}
        />
      </aside>
    );
  }

  // ── Floating drawer (legacy) ───────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          transition={{ duration: 0.32, ease: EASE_PREMIUM }}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 right-3 z-40",
            "w-[340px] max-h-[78vh] overflow-hidden flex flex-col",
            "rounded-2xl border border-white/[0.07]",
            "bg-[hsl(220_30%_4%/0.78)] backdrop-blur-2xl",
            "shadow-[0_30px_80px_-30px_hsl(0_0%_0%/0.75)]",
          )}
        >
          {/* Header — Inspector eyebrow + clip identity */}
          <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                <Sparkles className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
                <span>◆ Inspector · Clip {String(clip.index + 1).padStart(2, "0")}</span>
              </div>
              <h3
                className="mt-1 font-display italic text-[18px] font-light tracking-tight text-foreground/95 line-clamp-2"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {clip.prompt}
              </h3>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-muted-foreground/55 hover:text-foreground transition-colors"
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </header>

          {/* Static identity row — In / Length / Track */}
          <div className="shrink-0 px-5 pb-3 grid grid-cols-3 gap-x-4">
            <div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>
                In
              </div>
              <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-foreground/95">
                {fmtTimecode(clip.timelineStartSec)}
              </div>
            </div>
            <div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>
                Length
              </div>
              <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-foreground/95">
                {clip.durationSec.toFixed(2)}s
              </div>
            </div>
            <div>
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>
                Track
              </div>
              <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-accent">
                {clip.kind === "title" ? "V2" : "V1"}
              </div>
            </div>
          </div>

          {/* Hairline divider before properties */}
          <div className="shrink-0 mx-5 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* PROPERTIES — editable sliders */}
          {clip.kind === "title" ? (
            <TitleProperties clip={clip} />
          ) : (
            <VideoProperties clip={clip} />
          )}

          {/* Hairline divider before takes list */}
          <div className="shrink-0 mx-5 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Takes section eyebrow */}
          <div className="shrink-0 px-5 pb-2">
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em]")}>
              ◆ Takes · {clip.takes.length} {clip.takes.length === 1 ? "version" : "versions"}
            </div>
          </div>

          {/* Take list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2">
            {clip.takes.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Film className="h-5 w-5 text-muted-foreground/50 mx-auto" strokeWidth={1.4} />
                <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
                  Press R to spin a new take
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {clip.takes.map((t, i) => (
                  <TakeRow
                    key={t.id}
                    take={t}
                    isActive={i === 0}
                    onSelect={() => switchActiveTake(clip.id, t.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Composer (collapsed by default) */}
          <div className="shrink-0 border-t border-white/[0.05] px-4 pt-3 pb-4">
            <AnimatePresence initial={false} mode="wait">
              {composerOpen ? (
                <motion.div
                  key="composer"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: EASE_PREMIUM }}
                >
                  <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-2")}>
                    ◆ Regenerate
                  </div>
                  <textarea
                    ref={composerRef}
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value.slice(0, 320))}
                    placeholder="Make it night… same blocking, golden-hour rim light…"
                    className={cn(
                      "block w-full resize-none bg-transparent outline-none",
                      "text-[14px] leading-relaxed text-foreground placeholder:text-foreground/30",
                      "border-b border-accent/40 focus:border-accent pb-2",
                      "caret-accent font-display italic font-light",
                    )}
                    style={{ fontFamily: "'Fraunces', serif" }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setComposerOpen(false);
                        setPrompt("");
                      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void submitRegenerate();
                      }
                    }}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={submitRegenerate}
                      disabled={submitting || !prompt.trim()}
                      className={cn(
                        "inline-flex items-center gap-2 text-[12.5px] text-accent transition-opacity",
                        "disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-85",
                      )}
                    >
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      <span>{submitting ? "Queuing…" : "Spin take"}</span>
                      <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>
                        ⌘
                        <CornerDownLeft className="inline h-2.5 w-2.5 ml-0.5" strokeWidth={2} />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComposerOpen(false);
                        setPrompt("");
                      }}
                      className="text-[12.5px] text-muted-foreground/55 hover:text-foreground transition-colors"
                    >
                      Cancel
                      <span className={cn(TYPE_META, "ml-2 text-muted-foreground/40 font-mono")}>esc</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="trigger"
                  type="button"
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.2, ease: EASE_PREMIUM }}
                  onClick={() => {
                    setComposerOpen(true);
                    setTimeout(() => composerRef.current?.focus(), 60);
                  }}
                  className="group/regen flex w-full items-center gap-2 text-left text-[13px] text-foreground/80 hover:text-foreground transition-colors"
                >
                  <Wand2 className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
                  <span>Regenerate this clip</span>
                  <span className={cn(TYPE_META, "ml-auto font-mono text-muted-foreground/40")}>
                    R
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InspectorBody — shared content between the embedded persistent rail
// and the legacy floating drawer. Mirrors the floating drawer's JSX
// 1:1 minus the AnimatePresence/motion.aside wrapper.
// ─────────────────────────────────────────────────────────────────────────────
function InspectorBody({
  clip,
  composerOpen,
  setComposerOpen,
  prompt,
  setPrompt,
  submitting,
  submit,
  composerRef,
  onClose,
}: {
  clip: import("@/lib/editor/types").EditorClip;
  composerOpen: boolean;
  setComposerOpen: (v: boolean) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  submitting: boolean;
  submit: () => Promise<void>;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: (() => void) | null;
}) {
  return (
    <>
      {/* Header */}
      <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
            <Sparkles className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Inspector · Clip {String(clip.index + 1).padStart(2, "0")}</span>
          </div>
          <h3
            className="mt-1 font-display italic text-[18px] font-light tracking-tight text-foreground/95 line-clamp-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {clip.prompt}
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground/55 hover:text-foreground transition-colors"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </header>

      {/* Identity row */}
      <div className="shrink-0 px-5 pb-3 grid grid-cols-3 gap-x-4">
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>In</div>
          <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-foreground/95">
            {fmtTimecode(clip.timelineStartSec)}
          </div>
        </div>
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>Length</div>
          <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-foreground/95">
            {clip.durationSec.toFixed(2)}s
          </div>
        </div>
        <div>
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>Track</div>
          <div className="mt-0.5 font-mono text-[12.5px] tabular-nums text-accent">
            {clip.kind === "title" ? "V2" : "V1"}
          </div>
        </div>
      </div>

      <div className="shrink-0 mx-5 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {clip.kind === "title" ? <TitleProperties clip={clip} /> : <VideoProperties clip={clip} />}

      <div className="shrink-0 mx-5 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="shrink-0 px-5 pb-2">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em]")}>
          ◆ Takes · {clip.takes.length} {clip.takes.length === 1 ? "version" : "versions"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-2">
        {clip.takes.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Film className="h-5 w-5 text-muted-foreground/50 mx-auto" strokeWidth={1.4} />
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
              Press R to spin a new take
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {clip.takes.map((t, i) => (
              <TakeRow
                key={t.id}
                take={t}
                isActive={i === 0}
                onSelect={() => switchActiveTake(clip.id, t.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.05] px-4 pt-3 pb-4">
        <AnimatePresence initial={false} mode="wait">
          {composerOpen ? (
            <motion.div
              key="composer"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE_PREMIUM }}
            >
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] mb-2")}>
                ◆ Regenerate
              </div>
              <textarea
                ref={composerRef}
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 320))}
                placeholder="Make it night… same blocking, golden-hour rim light…"
                className={cn(
                  "block w-full resize-none bg-transparent outline-none",
                  "text-[14px] leading-relaxed text-foreground placeholder:text-foreground/30",
                  "border-b border-accent/40 focus:border-accent pb-2",
                  "caret-accent font-display italic font-light",
                )}
                style={{ fontFamily: "'Fraunces', serif" }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setComposerOpen(false);
                    setPrompt("");
                  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || !prompt.trim()}
                  className={cn(
                    "inline-flex items-center gap-2 text-[12.5px] text-accent transition-opacity",
                    "disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-85",
                  )}
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  <span>{submitting ? "Queuing…" : "Spin take"}</span>
                  <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono")}>
                    ⌘
                    <CornerDownLeft className="inline h-2.5 w-2.5 ml-0.5" strokeWidth={2} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    setPrompt("");
                  }}
                  className="text-[12.5px] text-muted-foreground/55 hover:text-foreground transition-colors"
                >
                  Cancel
                  <span className={cn(TYPE_META, "ml-2 text-muted-foreground/40 font-mono")}>esc</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="trigger"
              type="button"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2, ease: EASE_PREMIUM }}
              onClick={() => {
                setComposerOpen(true);
                setTimeout(() => composerRef.current?.focus(), 60);
              }}
              className="group/regen flex w-full items-center gap-2 text-left text-[13px] text-foreground/80 hover:text-foreground transition-colors"
            >
              <Wand2 className="h-3.5 w-3.5 text-accent/85" strokeWidth={1.5} />
              <span>Regenerate this clip</span>
              <span className={cn(TYPE_META, "ml-auto font-mono text-muted-foreground/40")}>R</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoProperties — Volume / Opacity / Scale sliders for V1 clips.
// Every slider commits to setClipProperty on input. Stage's player
// applies them in lockstep (volume → <video>.volume, opacity/scale →
// CSS transform).
// ─────────────────────────────────────────────────────────────────────────────
function VideoProperties({ clip }: { clip: import("@/lib/editor/types").EditorClip }) {
  const volume = getClipProperty(clip, "volume");
  const opacity = getClipProperty(clip, "opacity");
  const scale = getClipProperty(clip, "scale");
  const fadeInSec = getClipProperty(clip, "fadeInSec");
  const fadeOutSec = getClipProperty(clip, "fadeOutSec");
  const speed = getClipProperty(clip, "speed");
  const muted = getClipProperty(clip, "muted");
  const soloed = getClipProperty(clip, "soloed");
  const { playheadSec } = useEditor();

  const kfCount = (prop: AnimatableProperty) =>
    (clip.keyframes ?? []).filter((k) => k.property === prop).length;

  const animate = (prop: AnimatableProperty, value: number) => {
    const ok = addKeyframeAtPlayhead(clip.id, prop, value);
    if (ok) {
      toast.message(`◇ Keyframe set on ${prop}`, {
        description: `${value.toFixed(2)} at ${(playheadSec - clip.timelineStartSec).toFixed(2)}s`,
      });
    } else {
      toast.message("Move the playhead inside this clip first");
    }
  };
  return (
    <div className="shrink-0 px-5 pb-3 space-y-3">
      {/* Mute / Solo row — quick toggles before the slider field */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setClipProperty(clip.id, { muted: !muted })}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors",
            muted
              ? "bg-rose-400/15 text-rose-300 ring-1 ring-inset ring-rose-400/40"
              : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
          )}
          aria-label={muted ? "Unmute clip" : "Mute clip"}
        >
          {muted ? (
            <VolumeX className="h-3 w-3" strokeWidth={1.6} />
          ) : (
            <Volume2 className="h-3 w-3" strokeWidth={1.6} />
          )}
          <span>{muted ? "muted" : "audio"}</span>
        </button>
        <button
          type="button"
          onClick={() => setClipProperty(clip.id, { soloed: !soloed })}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors",
            soloed
              ? "bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/40"
              : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04]",
          )}
          aria-label={soloed ? "Unsolo clip" : "Solo clip"}
        >
          <Headphones className="h-3 w-3" strokeWidth={1.6} />
          <span>solo</span>
        </button>
      </div>
      <AnimatableSlider
        label="Volume"
        Icon={Volume2}
        min={0}
        max={1}
        step={0.01}
        value={volume}
        display={`${Math.round(volume * 100)}%`}
        onChange={(v) => setClipProperty(clip.id, { volume: v })}
        kfCount={kfCount("volume")}
        onAddKeyframe={() => animate("volume", volume)}
        onClearKeyframes={() => clearKeyframes(clip.id, "volume")}
      />
      <AnimatableSlider
        label="Opacity"
        Icon={Eye}
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        display={`${Math.round(opacity * 100)}%`}
        onChange={(v) => setClipProperty(clip.id, { opacity: v })}
        kfCount={kfCount("opacity")}
        onAddKeyframe={() => animate("opacity", opacity)}
        onClearKeyframes={() => clearKeyframes(clip.id, "opacity")}
      />
      <AnimatableSlider
        label="Scale"
        Icon={Maximize2}
        min={0.5}
        max={2}
        step={0.01}
        value={scale}
        display={`${scale.toFixed(2)}×`}
        onChange={(v) => setClipProperty(clip.id, { scale: v })}
        kfCount={kfCount("scale")}
        onAddKeyframe={() => animate("scale", scale)}
        onClearKeyframes={() => clearKeyframes(clip.id, "scale")}
      />
      <div className="grid grid-cols-2 gap-x-3">
        <PropertySlider
          label="Fade in"
          Icon={ArrowRightToLine}
          min={0}
          max={Math.min(2, clip.durationSec / 2)}
          step={0.05}
          value={fadeInSec}
          display={fadeInSec > 0 ? `${fadeInSec.toFixed(1)}s` : "—"}
          onChange={(v) => setClipProperty(clip.id, { fadeInSec: v })}
        />
        <PropertySlider
          label="Fade out"
          Icon={ArrowLeftToLine}
          min={0}
          max={Math.min(2, clip.durationSec / 2)}
          step={0.05}
          value={fadeOutSec}
          display={fadeOutSec > 0 ? `${fadeOutSec.toFixed(1)}s` : "—"}
          onChange={(v) => setClipProperty(clip.id, { fadeOutSec: v })}
        />
      </div>

      {/* Speed — playback rate */}
      <PropertySlider
        label="Speed"
        Icon={Gauge}
        min={0.25}
        max={4}
        step={0.05}
        value={speed}
        display={`${speed.toFixed(2)}×`}
        onChange={(v) => setClipProperty(clip.id, { speed: v })}
      />
      <div className="flex items-center gap-1 mt-1">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setClipProperty(clip.id, { speed: s })}
            className={cn(
              TYPE_META,
              "px-1.5 h-5 rounded text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.04] font-mono transition-colors",
              Math.abs(speed - s) < 0.025 && "text-accent bg-[hsl(var(--accent)/0.10)]",
            )}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimatableSlider — PropertySlider + a diamond keyframe button at the
// right. Click ◇ to capture the current value at the playhead. The
// button glows accent + shows a count when keyframes already exist.
// Shift-click clears every keyframe for the property.
// ─────────────────────────────────────────────────────────────────────────────
function AnimatableSlider({
  label,
  Icon,
  min,
  max,
  step,
  value,
  display,
  onChange,
  kfCount,
  onAddKeyframe,
  onClearKeyframes,
}: {
  label: string;
  Icon: typeof Volume2;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
  kfCount: number;
  onAddKeyframe: () => void;
  onClearKeyframes: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>
            {label}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-foreground/90">
            {display}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent/55"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          if (e.shiftKey) onClearKeyframes();
          else onAddKeyframe();
        }}
        title={
          kfCount === 0
            ? "Add keyframe at playhead"
            : `${kfCount} keyframes · click to add another · ⇧click to clear`
        }
        aria-label="Add keyframe at playhead"
        className={cn(
          "shrink-0 inline-flex items-center gap-1 h-5 px-1 rounded transition-colors",
          kfCount > 0
            ? "text-accent bg-[hsl(var(--accent)/0.10)]"
            : "text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04]",
        )}
      >
        <Diamond
          className="h-3 w-3"
          strokeWidth={1.8}
          fill={kfCount > 0 ? "currentColor" : "none"}
        />
        {kfCount > 0 && (
          <span className={cn(TYPE_META, "font-mono tabular-nums")}>{kfCount}</span>
        )}
      </button>
    </div>
  );
}

function PropertySlider({
  label,
  Icon,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  Icon: typeof Volume2;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em]")}>
            {label}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-foreground/90">
            {display}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent/55"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
          />
        </div>
      </div>
    </div>
  );
}

function TitleProperties({ clip }: { clip: import("@/lib/editor/types").EditorClip }) {
  return (
    <div className="shrink-0 px-5 pb-3 space-y-3">
      <div>
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] mb-1.5 flex items-center gap-1.5")}>
          <TypeIcon className="h-3 w-3" strokeWidth={1.5} />
          <span>Title text</span>
        </div>
        <input
          type="text"
          value={clip.titleText ?? ""}
          onChange={(e) => setClipProperty(clip.id, { titleText: e.target.value })}
          maxLength={120}
          className={cn(
            "block w-full bg-transparent outline-none",
            "font-display italic font-light text-[15px] text-foreground",
            "border-b border-accent/40 focus:border-accent pb-1.5",
            "caret-accent",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
          placeholder="TITLE"
        />
      </div>
      <div>
        <div className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] mb-1.5")}>
          Background color
        </div>
        <input
          type="color"
          value={clip.titleColor ?? "#0a0e16"}
          onChange={(e) => setClipProperty(clip.id, { titleColor: e.target.value })}
          className="w-full h-9 rounded-md cursor-pointer bg-white/[0.04] border border-white/[0.08]"
        />
      </div>
    </div>
  );
}

function TakeRow({
  take,
  isActive,
  onSelect,
}: {
  take: EditorTake;
  isActive: boolean;
  onSelect: () => void;
}) {
  const pending = take.status === "pending" || !take.videoUrl;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={pending}
        className={cn(
          "group/take w-full flex items-stretch gap-3 p-2 rounded-lg transition-colors",
          "hover:bg-white/[0.025]",
          isActive && "bg-white/[0.03]",
          pending && "opacity-65 cursor-not-allowed",
        )}
      >
        {/* Thumbnail */}
        <div className="relative shrink-0 w-[78px] aspect-video overflow-hidden rounded-md bg-[hsl(220_30%_8%)]">
          {take.thumbnailUrl ? (
            <img
              src={take.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {pending ? (
                <Loader2 className="h-4 w-4 text-accent/80 animate-spin" strokeWidth={1.5} />
              ) : (
                <Film className="h-3.5 w-3.5 text-muted-foreground/45" strokeWidth={1.4} />
              )}
            </div>
          )}
          {isActive && (
            <div className="absolute top-1 right-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent text-[hsl(220_30%_4%)]">
              <Crown className="h-2.5 w-2.5" strokeWidth={2.2} />
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={cn(TYPE_META, "font-mono tabular-nums tracking-[0.22em]", isActive ? "text-accent" : "text-muted-foreground/65")}>
              TAKE {String(take.takeNumber).padStart(2, "0")}
            </span>
            {pending && (
              <span className={cn(TYPE_META, "text-amber-300/75 tracking-[0.22em]")}>
                · pending
              </span>
            )}
            {isActive && !pending && (
              <Check className="h-3 w-3 text-accent" strokeWidth={2} />
            )}
          </div>
          <p
            className="mt-1 text-[12px] leading-snug text-foreground/80 line-clamp-2"
            title={take.promptUsed ?? ""}
          >
            {take.promptUsed ?? "—"}
          </p>
        </div>
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TransitionInspector — shown in the right rail when a between-clip
// transition is selected. Kind picker (grid of glyphs), duration
// slider with live preview, and a destructive Remove button at the
// bottom.
// ─────────────────────────────────────────────────────────────────────────────
function TransitionInspector({
  transition,
  fromClip,
  toClip,
}: {
  transition: ClipTransition;
  fromClip: EditorClip;
  toClip: EditorClip;
}) {
  const maxDur = Math.max(0.05, Math.min(fromClip.durationSec, toClip.durationSec) / 2);
  return (
    <>
      <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
            <Sparkles className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Transition</span>
          </div>
          <h3
            className="mt-1 font-display italic text-[18px] font-light tracking-tight text-foreground/95"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {TRANSITION_LABELS[transition.kind]}
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground/60 line-clamp-2">
            Between <span className="text-foreground/85">clip {fromClip.index + 1}</span>
            {" → "}
            <span className="text-foreground/85">clip {toClip.index + 1}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => selectTransition(null)}
          className="text-muted-foreground/55 hover:text-foreground transition-colors"
          aria-label="Close transition inspector"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </header>

      <div className="shrink-0 mx-5 mb-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Duration slider */}
      <div className="shrink-0 px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.24em]")}>
            ◆ Duration
          </span>
          <span className="font-mono tabular-nums text-[12px] text-foreground/85">
            {transition.durationSec.toFixed(2)}s
          </span>
        </div>
        <input
          type="range"
          min={0.05}
          max={maxDur}
          step={0.01}
          value={Math.min(maxDur, transition.durationSec)}
          onChange={(e) =>
            updateTransition(transition.id, { durationSec: parseFloat(e.target.value) })
          }
          className="w-full accent-foreground/85"
          aria-label="Transition duration"
        />
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground/45">
          <span>0.05s</span>
          <span>max {maxDur.toFixed(2)}s</span>
        </div>
      </div>

      <div className="shrink-0 mx-5 mb-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Kind grid */}
      <div className="shrink-0 px-5 pb-2">
        <span className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.24em]")}>
          ◆ Style
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-hide">
        <div className="grid grid-cols-2 gap-1.5">
          {TRANSITION_KINDS.map((k) => (
            <KindButton
              key={k}
              kind={k}
              active={transition.kind === k}
              onClick={() => updateTransition(transition.id, { kind: k })}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 mx-5 my-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="shrink-0 px-5 pb-5">
        <button
          type="button"
          onClick={() => {
            removeTransition(transition.id);
            selectTransition(null);
          }}
          className={cn(
            "w-full h-9 rounded-md",
            "text-[11px] font-mono uppercase tracking-[0.22em] text-rose-300",
            "bg-rose-500/[0.06] hover:bg-rose-500/[0.12] ring-1 ring-inset ring-rose-500/30",
            "transition-colors",
          )}
        >
          Remove transition
        </button>
      </div>
    </>
  );
}

function KindButton({
  kind,
  active,
  onClick,
}: {
  kind: TransitionKind;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={TRANSITION_LABELS[kind]}
      className={cn(
        "h-9 px-2 rounded-md flex items-center justify-between",
        "text-[11px] font-mono uppercase tracking-[0.14em]",
        "transition-colors ring-1 ring-inset",
        active
          ? "bg-[hsl(212_100%_60%/0.16)] text-accent ring-accent/50"
          : "bg-white/[0.02] text-foreground/75 ring-white/[0.06] hover:bg-white/[0.05]",
      )}
    >
      <span className="truncate">{TRANSITION_LABELS[kind]}</span>
      {active && <Check className="h-3 w-3 text-accent" strokeWidth={2} />}
    </button>
  );
}
