/**
 * Script — the screenplay surface.
 *
 * Sheet music for film. The script renders as a properly-formatted
 * screenplay with a live playhead cursor that walks the blocks as
 * playback runs, and bidirectional click ↔ seek so jumping anywhere
 * in the script jumps the timeline too.
 *
 * Three columns:
 *   ◆ Scene strip (left)         — vertical list of slug-lines,
 *                                  click to seek to the scene's
 *                                  first clip. The active scene's
 *                                  ring fills with the accent.
 *   ◆ Screenplay (center)        — formatted blocks: slugs, action,
 *                                  character cues, parentheticals,
 *                                  dialogue, transitions. The active
 *                                  block has a left rail + accent
 *                                  ring. Click any block to seek.
 *   ◆ Inspector (right)          — context for the active block:
 *                                  speaker, target audio track,
 *                                  clip prompt, Approve toggle,
 *                                  Regenerate button.
 *
 * Top bar:
 *   ◆ Word + scene counts        — at a glance.
 *   ◆ Save state                 — saving / saved / dirty.
 *   ◆ Approve all                — promote generated_script →
 *                                  script_content.
 *   ◆ Regenerate                 — call generate-script for a
 *                                  fresh AI draft.
 *
 * Per-block approval state persists into
 * movie_projects.pipeline_state.scriptApprovals (a JSONB key map of
 * blockId → true) so reloads keep the locks the user set.
 *
 * Editing model:
 *   - Click body text to enter inline edit. ⌘↵ saves the whole
 *     screenplay back to script_content.
 *   - Per-clip regenerate uses the dialogue lines under the active
 *     CHARACTER as the prompt seed — the AI co-director understands
 *     "the new shot should depict X said by Y."
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Layers,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Lock,
  Mic,
  Music2,
  Disc3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject } from "@/lib/editor/types";
import {
  setScriptContent,
  selectScene,
  selectClip,
  setPlayhead,
} from "@/lib/editor/store";
import {
  parseScreenplay,
  findActiveBlockIdx,
  fmtSceneTimecode,
  type ScreenplayBlock,
} from "@/lib/editor/screenplay";
import { useEditor } from "@/hooks/editor/useEditor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
}

type ApprovalMap = Record<string, true>;

export function Script({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const { playheadSec } = useEditor();
  const initial = (project.scriptContent ?? "").trim();

  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalMap>({});
  const [regenClipId, setRegenClipId] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // ── Load extras (pending AI draft + per-block approvals) ────────
  useEffect(() => {
    if (!project.id || project.id === "no-project") return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("movie_projects")
        .select("script_content, generated_script, pipeline_state")
        .eq("id", project.id)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const draft = (data.generated_script ?? "").trim();
      const approved = (data.script_content ?? "").trim();
      if (draft && draft.toLowerCase() !== approved.toLowerCase()) {
        setPendingDraft(draft);
      } else {
        setPendingDraft(null);
      }
      // Approvals live in pipeline_state.scriptApprovals
      const ps = (data.pipeline_state ?? {}) as { scriptApprovals?: ApprovalMap };
      if (ps?.scriptApprovals && typeof ps.scriptApprovals === "object") {
        setApprovals(ps.scriptApprovals as ApprovalMap);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Mirror new initial values when the project changes externally.
  useEffect(() => {
    if (!editing) setValue(initial);
  }, [initial, editing]);

  // Auto-resize edit textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || !editing) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, editing]);

  // V1 clip list — the anchor target.
  const v1Clips = useMemo(
    () => project.scenes.flatMap((s) => s.clips).filter((c) => c.kind !== "title"),
    [project],
  );

  // Parse the screenplay → blocks + clip mapping.
  const displayText = pendingDraft ?? (value || initial);
  const { blocks, sceneCount } = useMemo(
    () => parseScreenplay({ raw: displayText, clips: v1Clips }),
    [displayText, v1Clips],
  );

  // Slugs only — for the left scene strip.
  const slugBlocks = useMemo(
    () => blocks.filter((b) => b.kind === "slug"),
    [blocks],
  );

  // Active block index from playhead.
  const activeIdx = useMemo(
    () => findActiveBlockIdx(blocks, playheadSec),
    [blocks, playheadSec],
  );
  const activeBlock = activeIdx >= 0 ? blocks[activeIdx] : null;

  // Auto-scroll the active block into view (smooth, debounced via
  // RAF so rapid playhead advances don't thrash the scroller).
  useEffect(() => {
    if (activeIdx < 0) return;
    const root = bodyRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-block-idx="${activeIdx}"]`);
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const rRect = root.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const above = eRect.top < rRect.top + 80;
      const below = eRect.bottom > rRect.bottom - 80;
      if (above || below) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeIdx]);

  const enterEdit = useCallback(() => {
    setEditing(true);
    setTimeout(() => {
      taRef.current?.focus();
      const ta = taRef.current;
      if (ta) ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 50);
  }, []);

  const cancel = () => {
    setValue(initial);
    setEditing(false);
  };

  const save = useCallback(async () => {
    const next = value.trim();
    if (next === initial.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setScriptContent(next);
    try {
      const { error } = await supabase
        .from("movie_projects")
        .update({ script_content: next })
        .eq("id", project.id);
      if (error) throw error;
      setSavedAt(Date.now());
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the script.");
    } finally {
      setSaving(false);
    }
  }, [value, initial, project.id]);

  /** Promote the pending AI draft as canonical. */
  const approveDraft = useCallback(async () => {
    if (!pendingDraft) return;
    setSaving(true);
    setScriptContent(pendingDraft);
    setValue(pendingDraft);
    try {
      const { error } = await supabase
        .from("movie_projects")
        .update({
          script_content: pendingDraft,
          generated_script: null,
        })
        .eq("id", project.id);
      if (error) throw error;
      setPendingDraft(null);
      setSavedAt(Date.now());
      toast.success("Script approved", {
        description: "Promoted as the canonical version.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setSaving(false);
    }
  }, [pendingDraft, project.id]);

  /** Reject the pending draft. */
  const rejectDraft = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("movie_projects")
        .update({ generated_script: null })
        .eq("id", project.id);
      if (error) throw error;
      setPendingDraft(null);
      toast.message("Draft discarded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't discard the draft.");
    } finally {
      setSaving(false);
    }
  }, [project.id]);

  /** Regenerate the WHOLE script via generate-script. */
  const regenerate = useCallback(async () => {
    setRegenerating(true);
    const toastId = toast.loading("Drafting a new screenplay…", {
      description: `${project.title} · ${v1Clips.length} clips on V1`,
    });
    try {
      const { data, error } = await supabase.functions.invoke<{
        script?: string;
        error?: string;
      }>("generate-script", {
        body: {
          title: project.title,
          topic: project.title,
          synopsis: initial || undefined,
          mood: project.mood ?? undefined,
          genre: project.genre ?? undefined,
          setting: project.setting ?? undefined,
          clipCount: v1Clips.length || undefined,
          targetDurationMinutes: project.durationSec
            ? Math.max(1, Math.round(project.durationSec / 60))
            : undefined,
        },
      });
      if (error) throw error;
      if (!data || data.error || !data.script) {
        throw new Error(data?.error ?? "no_script_returned");
      }
      const draft = data.script.trim();
      const { error: upErr } = await supabase
        .from("movie_projects")
        .update({ generated_script: draft })
        .eq("id", project.id);
      if (upErr) throw upErr;
      setPendingDraft(draft);
      toast.success("Draft ready for review", {
        id: toastId,
        description: "Approve to make it canonical.",
      });
    } catch (e) {
      toast.error("Couldn't generate a new draft", {
        id: toastId,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRegenerating(false);
    }
  }, [project, initial, v1Clips.length]);

  /** Regenerate a SINGLE clip from a block's text as the new prompt. */
  const regenerateClipFromBlock = useCallback(
    async (block: ScreenplayBlock) => {
      const clip = block.clip;
      if (!clip) {
        toast.error("No clip mapped to this beat");
        return;
      }
      if (approvals[block.id]) {
        toast.message("This beat is approved — unlock to regenerate.");
        return;
      }
      setRegenClipId(clip.id);
      const toastId = toast.loading("Reshoot in progress…", {
        description: `Clip ${clip.index + 1} · ${block.kind}`,
      });
      try {
        const { data, error } = await supabase.functions.invoke<{
          predictionId?: string;
          error?: string;
        }>("editor-generate-clip", {
          body: {
            action: "submit",
            prompt: block.text,
            duration: clip.durationSec > 10 ? 10 : 5,
            aspectRatio: project.aspectRatio,
            projectId: project.id,
            idempotencyKey: `script-regen:${block.id}`,
          },
        });
        if (error || !data || data.error) {
          throw new Error(data?.error ?? error?.message ?? "submit_failed");
        }
        toast.success("Reshoot queued", {
          id: toastId,
          description: "Drops into the timeline when ready.",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error("Couldn't reshoot the clip", { id: toastId, description: msg });
      } finally {
        setRegenClipId(null);
      }
    },
    [project, approvals],
  );

  /** Toggle per-block approval and persist to pipeline_state. */
  const toggleApproval = useCallback(
    async (block: ScreenplayBlock) => {
      const next: ApprovalMap = { ...approvals };
      if (next[block.id]) delete next[block.id];
      else next[block.id] = true;
      setApprovals(next);
      try {
        await supabase
          .from("movie_projects")
          .update({
            pipeline_state: {
              ...(project as unknown as { pipeline_state?: object })
                .pipeline_state,
              scriptApprovals: next,
            },
          })
          .eq("id", project.id);
      } catch {
        // Local state already updated optimistically; surface a quiet
        // toast so the user knows persistence failed.
        toast.error("Approval didn't save — try again.");
      }
    },
    [approvals, project],
  );

  const onTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  const seekToBlock = (b: ScreenplayBlock) => {
    if (!b.clip) return;
    setPlayhead(b.clip.timelineStartSec);
    selectClip(b.clip.id);
    const owningScene = project.scenes.find((s) =>
      s.clips.some((c) => c.id === b.clip!.id),
    );
    if (owningScene) selectScene(owningScene.id);
  };

  const wordCount = displayText.split(/\s+/).filter(Boolean).length;
  const approvedCount = Object.keys(approvals).length;

  // ── Render ──────────────────────────────────────────────────────
  if (editing) {
    return (
      <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM }}
          className="mx-auto max-w-[760px] py-10 pb-32"
        >
          <header className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] mb-3 flex items-center gap-2")}>
            <Pencil className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Editing — ⌘↵ to save · Esc to cancel</span>
          </header>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onTextareaKey}
            placeholder="FADE IN:&#10;&#10;A dawn sky over the small bridges. The camera drifts…"
            rows={16}
            className={cn(
              "block w-full resize-none bg-transparent outline-none",
              "font-mono text-[13.5px] leading-[1.7] whitespace-pre",
              "text-foreground placeholder:text-foreground/30",
              "border-b border-accent/40 focus:border-accent pb-4",
              "caret-accent",
            )}
          />
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={cn(
                "inline-flex items-center gap-2 text-[13px] text-accent",
                "transition-opacity hover:opacity-85 disabled:opacity-40",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Save</span>
              <span className={cn(TYPE_META, "text-muted-foreground/45")}>⌘ ↵</span>
            </button>
            <button
              type="button"
              onClick={cancel}
              className={cn(
                "inline-flex items-center gap-2 text-[13px] text-muted-foreground/65",
                "transition-colors hover:text-foreground",
              )}
            >
              Cancel
              <span className={cn(TYPE_META, "text-muted-foreground/45")}>Esc</span>
            </button>
          </div>
        </motion.div>
      </section>
    );
  }

  if (!displayText.trim()) {
    return (
      <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-[760px] py-20 text-center">
          <Layers className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            No screenplay yet.
          </p>
          <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md mx-auto")}>
            Regenerate to draft one from your project's mood + clip count, or click to write inline.
          </p>
          <div className="mt-7 inline-flex items-center gap-3">
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={regenerating || project.id === "no-project"}
              className={cn(
                "inline-flex items-center gap-2 px-4 h-9 rounded-full",
                "bg-[hsl(var(--accent)/0.14)] text-accent ring-1 ring-inset ring-accent/40",
                "text-[13px] font-display italic transition-colors",
                "hover:bg-[hsl(var(--accent)/0.22)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              <span>{regenerating ? "Drafting…" : "Draft with AI"}</span>
            </button>
            <button
              type="button"
              onClick={enterEdit}
              className={cn(
                "inline-flex items-center gap-2 px-4 h-9 rounded-full",
                "text-[13px] text-muted-foreground/75 hover:text-foreground",
              )}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Write it myself</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex-1 min-h-0 grid grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[260px_minmax(0,1fr)_320px] divide-x divide-white/[0.04]">
      {/* ── LEFT — scene strip ────────────────────────────────── */}
      <aside className="relative overflow-y-auto scrollbar-hide px-3 py-5">
        <header className="px-2 mb-4">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] flex items-center gap-2")}>
            <Layers className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Scenes</span>
          </div>
          <p
            className="mt-1 font-display italic text-[14px] text-foreground/85"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {sceneCount} {sceneCount === 1 ? "scene" : "scenes"}
          </p>
        </header>
        {slugBlocks.length === 0 ? (
          <p className={cn(TYPE_META, "px-2 text-muted-foreground/55")}>
            No slug-lines detected — try INT./EXT. headings to anchor scenes.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {slugBlocks.map((b) => {
              const isActive =
                activeBlock?.sceneIdx === b.sceneIdx;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => seekToBlock(b)}
                    disabled={!b.clip}
                    className={cn(
                      "group w-full text-left px-2.5 py-2 rounded-md",
                      "flex items-start gap-2.5 transition-colors",
                      isActive
                        ? "bg-[hsl(212_100%_60%/0.10)] ring-1 ring-inset ring-accent/40"
                        : "hover:bg-white/[0.03] ring-1 ring-inset ring-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full transition-colors",
                        isActive ? "bg-accent" : "bg-foreground/35",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "font-mono uppercase tracking-[0.10em] text-[11px] leading-tight truncate",
                          isActive ? "text-accent" : "text-foreground/85",
                        )}
                      >
                        {b.text}
                      </div>
                      {b.clip && (
                        <div className={cn(TYPE_META, "mt-1 font-mono tabular-nums text-muted-foreground/55")}>
                          {fmtSceneTimecode(b.clip.timelineStartSec)}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* ── CENTER — formatted screenplay ─────────────────────── */}
      <div className="relative flex flex-col min-h-0">
        {/* Header — counts + actions */}
        <header className="shrink-0 px-6 pt-6 pb-3 flex items-end justify-between gap-3 border-b border-white/[0.04]">
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] flex items-center gap-2")}>
              <Layers className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
              <span>◆ Screenplay</span>
            </div>
            <h2
              className="mt-1 font-display italic text-[24px] font-light tracking-tight leading-none"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                {wordCount.toLocaleString()} words
              </span>
            </h2>
            <p className={cn(TYPE_META, "mt-1 text-muted-foreground/55 flex items-center gap-3")}>
              <span>{sceneCount} {sceneCount === 1 ? "scene" : "scenes"}</span>
              <span className="text-muted-foreground/30">·</span>
              <span>{v1Clips.length} {v1Clips.length === 1 ? "clip" : "clips"} mapped</span>
              {approvedCount > 0 && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-emerald-300/85 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
                    {approvedCount} approved
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {saving ? (
                <motion.span
                  key="saving"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(TYPE_META, "text-muted-foreground/55 flex items-center gap-1.5")}
                >
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                  Saving
                </motion.span>
              ) : savedAt ? (
                <motion.span
                  key="saved"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(TYPE_META, "text-emerald-300 flex items-center gap-1.5")}
                >
                  <Check className="h-3 w-3" strokeWidth={2} />
                  Saved
                </motion.span>
              ) : null}
            </AnimatePresence>
            <button
              type="button"
              onClick={enterEdit}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                "text-[12px] font-mono uppercase tracking-[0.18em]",
                "bg-white/[0.03] text-foreground/85 ring-1 ring-inset ring-white/[0.06]",
                "hover:bg-white/[0.07] transition-colors",
              )}
            >
              <Pencil className="h-3 w-3" strokeWidth={1.5} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={regenerating || project.id === "no-project"}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                "text-[12px] font-mono uppercase tracking-[0.18em]",
                "bg-white/[0.03] text-foreground/85 ring-1 ring-inset ring-white/[0.06]",
                "hover:bg-white/[0.07] transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
              title="Generate a fresh AI draft"
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              ) : (
                <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
              )}
              <span>{regenerating ? "Drafting" : "Redraft"}</span>
            </button>
          </div>
        </header>

        {/* Pending AI draft banner */}
        {pendingDraft && (
          <div className="shrink-0 mx-6 mt-4 rounded-xl ring-1 ring-inset ring-amber-300/35 bg-amber-500/[0.06] p-4 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p
                className="font-display italic text-[14px] text-foreground/95"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                Fresh AI draft awaiting your approval.
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground/75 leading-snug">
                The screenplay below is the draft. Approve to make it canonical, or discard to keep the previous version.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void approveDraft()}
                  disabled={saving}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                    "text-[12px] font-mono uppercase tracking-[0.18em]",
                    "bg-emerald-500/[0.18] text-emerald-200 ring-1 ring-inset ring-emerald-400/40",
                    "hover:bg-emerald-500/[0.28] transition-colors",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void rejectDraft()}
                  disabled={saving}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-7 rounded-full",
                    "text-[12px] font-mono uppercase tracking-[0.18em]",
                    "bg-white/[0.03] text-foreground/75 ring-1 ring-inset ring-white/[0.06]",
                    "hover:bg-white/[0.07] transition-colors",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blocks */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 sm:px-10 py-7">
          <article className="mx-auto max-w-[680px]">
            {blocks.map((b, i) => (
              <BlockRow
                key={b.id}
                idx={i}
                block={b}
                isActive={i === activeIdx}
                approved={!!approvals[b.id]}
                regenerating={regenClipId === b.clip?.id}
                onSeek={() => seekToBlock(b)}
                onToggleApprove={() => void toggleApproval(b)}
                onRegenerate={() => void regenerateClipFromBlock(b)}
              />
            ))}
          </article>
        </div>
      </div>

      {/* ── RIGHT — block inspector ──────────────────────────── */}
      <aside className="relative overflow-y-auto scrollbar-hide px-5 py-5">
        <BlockInspector
          block={activeBlock}
          approved={activeBlock ? !!approvals[activeBlock.id] : false}
          regenerating={
            activeBlock?.clip ? regenClipId === activeBlock.clip.id : false
          }
          onToggleApprove={() => activeBlock && void toggleApproval(activeBlock)}
          onRegenerate={() =>
            activeBlock && void regenerateClipFromBlock(activeBlock)
          }
        />
      </aside>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BlockRow — formatted screenplay block + click-to-seek + per-block actions
// ─────────────────────────────────────────────────────────────────────────────

function BlockRow({
  idx,
  block,
  isActive,
  approved,
  regenerating,
  onSeek,
  onToggleApprove,
  onRegenerate,
}: {
  idx: number;
  block: ScreenplayBlock;
  isActive: boolean;
  approved: boolean;
  regenerating: boolean;
  onSeek: () => void;
  onToggleApprove: () => void;
  onRegenerate: () => void;
}) {
  const trackBadge =
    block.kind === "dialogue"
      ? { icon: <Mic className="h-3 w-3" strokeWidth={1.5} />, label: "A1 · dialog" }
      : block.kind === "action"
      ? { icon: <Disc3 className="h-3 w-3" strokeWidth={1.5} />, label: "ambient" }
      : block.kind === "slug"
      ? { icon: <Music2 className="h-3 w-3" strokeWidth={1.5} />, label: "A2 · score" }
      : null;

  return (
    <div
      data-block-idx={idx}
      className={cn(
        "group/blk relative pl-6 pr-2 transition-colors",
        isActive && "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-accent before:rounded-full",
      )}
    >
      <button
        type="button"
        onClick={onSeek}
        disabled={!block.clip}
        className={cn(
          "block w-full text-left rounded-md py-1.5 transition-colors",
          isActive
            ? "text-foreground"
            : "text-foreground/75 hover:text-foreground",
        )}
      >
        {renderBlockContent(block, isActive)}
      </button>

      {/* Hover actions — Approve toggle + Regenerate. Only on
          action / dialogue blocks; slug/transition/character are
          structural. */}
      {(block.kind === "action" || block.kind === "dialogue") && block.clip && (
        <div
          className={cn(
            "absolute right-0 top-1 flex items-center gap-1",
            "transition-opacity",
            isActive ? "opacity-100" : "opacity-0 group-hover/blk:opacity-100",
          )}
        >
          {trackBadge && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 h-5 rounded",
                "text-[9.5px] font-mono uppercase tracking-[0.16em]",
                "bg-white/[0.04] text-muted-foreground/75 ring-1 ring-inset ring-white/[0.06]",
              )}
            >
              {trackBadge.icon}
              <span>{trackBadge.label}</span>
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleApprove();
            }}
            title={approved ? "Locked — click to unlock" : "Lock this beat"}
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded",
              "transition-colors",
              approved
                ? "bg-emerald-500/[0.18] text-emerald-200 ring-1 ring-inset ring-emerald-400/40"
                : "bg-white/[0.04] text-muted-foreground/65 ring-1 ring-inset ring-white/[0.06] hover:text-foreground",
            )}
          >
            {approved ? (
              <Lock className="h-2.5 w-2.5" strokeWidth={1.8} />
            ) : (
              <ShieldCheck className="h-2.5 w-2.5" strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!approved) onRegenerate();
            }}
            disabled={approved || regenerating}
            title={
              approved
                ? "Unlock to regenerate"
                : "Reshoot this clip using this beat as the prompt"
            }
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded",
              "transition-colors",
              "bg-white/[0.04] text-muted-foreground/65 ring-1 ring-inset ring-white/[0.06]",
              !approved && "hover:text-accent",
              "disabled:opacity-30 disabled:cursor-not-allowed",
            )}
          >
            {regenerating ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={1.8} />
            ) : (
              <RefreshCw className="h-2.5 w-2.5" strokeWidth={1.8} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function renderBlockContent(block: ScreenplayBlock, isActive: boolean) {
  switch (block.kind) {
    case "slug":
      return (
        <div className={cn("font-mono uppercase tracking-[0.18em] text-[12px] text-accent mt-7 mb-2 flex items-center gap-3", !isActive && "text-accent/85")}>
          <span>◆</span>
          <span>{block.text}</span>
          {block.clip && (
            <span className={cn(TYPE_META, "ml-auto font-mono tabular-nums text-muted-foreground/55")}>
              {fmtSceneTimecode(block.clip.timelineStartSec)}
            </span>
          )}
        </div>
      );
    case "action":
      return (
        <p
          className={cn(
            "text-[14px] leading-[1.65] whitespace-pre-wrap",
            "font-display italic font-light",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {block.text}
        </p>
      );
    case "character":
      return (
        <div className="mt-4 mb-0 text-center">
          <span className="font-mono uppercase tracking-[0.18em] text-[12.5px] text-foreground/95">
            {block.speaker ?? block.text}
            {block.speakerExtension && (
              <span className="text-muted-foreground/55 ml-2">
                ({block.speakerExtension})
              </span>
            )}
          </span>
        </div>
      );
    case "paren":
      return (
        <div className="mx-auto max-w-[60%] text-center text-[12px] text-muted-foreground/65 italic mb-0.5">
          {block.text}
        </div>
      );
    case "dialogue":
      return (
        <p
          className={cn(
            "mx-auto max-w-[72%] text-center text-[14.5px] leading-[1.55] whitespace-pre-wrap mb-3",
            "font-display italic",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {block.text}
        </p>
      );
    case "transition":
      return (
        <div className="font-mono uppercase tracking-[0.16em] text-[12px] text-muted-foreground/65 text-right my-4">
          {block.text}
        </div>
      );
    default:
      return <p className="text-[14px]">{block.text}</p>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BlockInspector — right rail context for the active block
// ─────────────────────────────────────────────────────────────────────────────

function BlockInspector({
  block,
  approved,
  regenerating,
  onToggleApprove,
  onRegenerate,
}: {
  block: ScreenplayBlock | null;
  approved: boolean;
  regenerating: boolean;
  onToggleApprove: () => void;
  onRegenerate: () => void;
}) {
  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <Sparkles className="h-5 w-5 text-muted-foreground/45 mb-3" strokeWidth={1.4} />
        <p className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.28em]")}>
          ◆ Inspector
        </p>
        <p
          className="mt-2 font-display italic text-[14px] text-foreground/75"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Press play or click a line.
        </p>
      </div>
    );
  }

  const trackLabel =
    block.kind === "dialogue"
      ? "A1 · dialog"
      : block.kind === "slug"
      ? "A2 · score"
      : "ambient";

  return (
    <div className="space-y-5">
      <header>
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.30em] flex items-center gap-2")}>
          <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
          <span>◆ Beat</span>
        </div>
        <h3
          className="mt-1 font-display italic text-[18px] text-foreground/95 leading-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {block.kind === "character" || block.kind === "dialogue"
            ? block.speaker ?? "Unnamed"
            : block.kind === "slug"
            ? "Scene heading"
            : block.kind === "transition"
            ? "Transition"
            : block.kind === "action"
            ? "Action"
            : block.kind === "paren"
            ? "Parenthetical"
            : block.kind}
        </h3>
        <p className={cn(TYPE_META, "mt-0.5 text-muted-foreground/55")}>
          Scene {String(block.sceneIdx + 1).padStart(2, "0")}
          {block.clip && ` · clip ${String(block.clip.index + 1).padStart(2, "0")}`}
        </p>
      </header>

      <div className="rounded-xl ring-1 ring-inset ring-white/[0.05] bg-white/[0.012] px-3.5 py-3">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em]")}>
          ◆ Text
        </div>
        <p
          className="mt-1 text-[13px] text-foreground/90 leading-snug whitespace-pre-wrap"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {block.text}
        </p>
      </div>

      {block.clip && (
        <div className="rounded-xl ring-1 ring-inset ring-white/[0.05] bg-white/[0.012] px-3.5 py-3">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em]")}>
            ◆ Clip prompt
          </div>
          <p className="mt-1 text-[12.5px] text-foreground/80 leading-snug line-clamp-4">
            {block.clip.prompt}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground/55">
            <span>{block.clip.durationSec.toFixed(1)}s</span>
            <span>{fmtSceneTimecode(block.clip.timelineStartSec)}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl ring-1 ring-inset ring-white/[0.05] bg-white/[0.012] px-3.5 py-3 flex items-center gap-3">
        <div className="h-7 w-7 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] flex items-center justify-center text-muted-foreground/85">
          {block.kind === "dialogue" ? (
            <Mic className="h-3.5 w-3.5" strokeWidth={1.5} />
          ) : block.kind === "slug" ? (
            <Music2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          ) : (
            <Disc3 className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
        </div>
        <div className="min-w-0">
          <p className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.24em]")}>◆ Audio bus</p>
          <p className="text-[12.5px] text-foreground/85">{trackLabel}</p>
        </div>
      </div>

      {(block.kind === "action" || block.kind === "dialogue") && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleApprove}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full",
              "text-[12px] font-mono uppercase tracking-[0.18em] transition-colors",
              approved
                ? "bg-emerald-500/[0.18] text-emerald-200 ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-500/[0.28]"
                : "bg-white/[0.03] text-foreground/85 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.07]",
            )}
          >
            {approved ? (
              <>
                <Lock className="h-3 w-3" strokeWidth={1.8} />
                <span>Locked</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
                <span>Approve</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={approved || regenerating}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full",
              "text-[12px] font-mono uppercase tracking-[0.18em] transition-colors",
              "bg-[hsl(var(--accent)/0.12)] text-accent ring-1 ring-inset ring-accent/35",
              !approved && "hover:bg-[hsl(var(--accent)/0.20)]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            title={approved ? "Unlock to regenerate" : undefined}
          >
            {regenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
            )}
            <span>{regenerating ? "Reshooting" : "Reshoot"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
