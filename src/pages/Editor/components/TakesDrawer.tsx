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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import type { EditorClip, EditorProject, EditorTake } from "@/lib/editor/types";
import {
  switchActiveTake,
  appendPendingTake,
  selectClip,
} from "@/lib/editor/store";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
}

export function TakesDrawer({ project, selectedClipId }: Props) {
  const reducedMotion = useReducedMotion();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clip = useMemo(() => {
    if (!selectedClipId) return null;
    for (const s of project.scenes) {
      const c = s.clips.find((c) => c.id === selectedClipId);
      if (c) return c;
    }
    return null;
  }, [project, selectedClipId]);

  // Auto-open the drawer the moment a clip gets selected; auto-close
  // it on deselection.
  useEffect(() => {
    setOpen(!!clip);
  }, [clip]);

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

  if (!clip) return null;

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
          {/* Header — pure typography */}
          <header className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
                <Sparkles className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
                <span>◆ Takes · Clip {String(clip.index + 1).padStart(2, "0")}</span>
              </div>
              <h3
                className="mt-1 font-display italic text-[18px] font-light tracking-tight text-foreground/95"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {clip.takes.length === 0
                  ? "No takes yet."
                  : `${clip.takes.length} ${clip.takes.length === 1 ? "take" : "takes"}.`}
              </h3>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-muted-foreground/55 hover:text-foreground transition-colors"
              aria-label="Close takes panel"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </header>

          {/* Take list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-3">
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
