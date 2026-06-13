/**
 * Script — the screenplay page.
 *
 * Sheet music for film. Single-column screenplay surface that reads
 * cleanly, follows playback with a live cursor, supports click-to-
 * seek on every block, and exposes per-block approve + reshoot
 * controls inline.
 *
 * Layout (top to bottom, single column):
 *   ◆ Header        — counts + Edit / Redraft actions
 *   ◆ Scene strip   — horizontal scroller of slug-line chips
 *                     (the chapter index)
 *   ◆ Pending draft — amber banner when an AI draft awaits review
 *   ◆ Screenplay    — the body, scrollable, with each block
 *                     formatted to its kind
 *
 * Engineered for resilience:
 *   - Outer ErrorBoundary catches any render-time exception and
 *     shows a fallback instead of crashing the editor.
 *   - All property reads from the parsed block stream guard against
 *     undefined.
 *   - parseScreenplay is called with stable inputs; its output is
 *     memoized so playhead ticks don't re-parse.
 *   - The synthetic EMPTY_PROJECT path (project.id === "no-project")
 *     short-circuits into a friendly empty state before any
 *     network calls run.
 */
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
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
  AlertOctagon,
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

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary — the editor stays alive even if the screenplay
// path throws. Without it, a runtime error in the parser or render
// would white-screen the entire Script page.
// ─────────────────────────────────────────────────────────────────────────────
class ScriptErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[Script] render crashed:", err, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="relative flex-1 min-h-0 flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <AlertOctagon className="h-7 w-7 text-rose-300/85 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/90"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            The screenplay couldn&rsquo;t render.
          </p>
          <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
            {this.state.message || "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: "" })}
            className={cn(
              "mt-6 inline-flex items-center gap-2 px-4 h-9 rounded-full",
              "bg-white/[0.04] text-foreground/85 ring-1 ring-inset ring-white/[0.08]",
              "text-[13px] hover:bg-white/[0.08] transition-colors",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Try again</span>
          </button>
        </div>
      </section>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component — wraps the implementation in the boundary so
// the editor never loses Script tab survivability.
// ─────────────────────────────────────────────────────────────────────────────
export function Script({ project }: Props) {
  return (
    <ScriptErrorBoundary>
      <ScriptInner project={project} />
    </ScriptErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScriptInner — the actual surface
// ─────────────────────────────────────────────────────────────────────────────
function ScriptInner({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const { playheadSec } = useEditor();
  const isEmptyProject = !project.id || project.id === "no-project";
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

  // Load draft + per-block approvals from supabase.
  useEffect(() => {
    if (isEmptyProject) return;
    let cancelled = false;
    void (async () => {
      try {
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
        const ps =
          data.pipeline_state && typeof data.pipeline_state === "object"
            ? (data.pipeline_state as { scriptApprovals?: ApprovalMap })
            : {};
        if (ps.scriptApprovals && typeof ps.scriptApprovals === "object") {
          setApprovals(ps.scriptApprovals as ApprovalMap);
        } else {
          setApprovals({});
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Script] load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, isEmptyProject]);

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

  // V1 clip list — guard against missing scenes (synthetic project).
  const v1Clips = useMemo(() => {
    const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
    return scenes
      .flatMap((s) => (Array.isArray(s?.clips) ? s.clips : []))
      .filter((c) => c && c.kind !== "title");
  }, [project]);

  // Parse the screenplay. Wrap in try/catch so a parser bug never
  // crashes the page — surfaces as an empty block stream instead.
  const displayText = pendingDraft ?? (value || initial);
  const parsed = useMemo(() => {
    try {
      return parseScreenplay({ raw: displayText, clips: v1Clips });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Script] parse failed", e);
      return { blocks: [], sceneCount: 0, contentCount: 0 };
    }
  }, [displayText, v1Clips]);
  const { blocks, sceneCount } = parsed;

  const slugBlocks = useMemo(
    () => blocks.filter((b) => b.kind === "slug"),
    [blocks],
  );

  const activeIdx = useMemo(
    () => findActiveBlockIdx(blocks, playheadSec),
    [blocks, playheadSec],
  );

  // Auto-scroll active block into view.
  useEffect(() => {
    if (activeIdx < 0) return;
    const root = bodyRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-block-idx="${activeIdx}"]`);
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      try {
        const rRect = root.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const above = eRect.top < rRect.top + 80;
        const below = eRect.bottom > rRect.bottom - 80;
        if (above || below) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch {
        /* getBoundingClientRect / scrollIntoView failed — ignore */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeIdx]);

  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  // ── Actions ─────────────────────────────────────────────────────
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
    if (isEmptyProject) {
      toast.error("Open a project first to save the screenplay.");
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
  }, [value, initial, project.id, isEmptyProject]);

  const approveDraft = useCallback(async () => {
    if (!pendingDraft || isEmptyProject) return;
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
  }, [pendingDraft, project.id, isEmptyProject]);

  const rejectDraft = useCallback(async () => {
    if (isEmptyProject) return;
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
  }, [project.id, isEmptyProject]);

  const regenerate = useCallback(async () => {
    if (isEmptyProject) {
      toast.error("Open a project first to draft a screenplay.");
      return;
    }
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
  }, [project, initial, v1Clips.length, isEmptyProject]);

  const regenerateClipFromBlock = useCallback(
    async (block: ScreenplayBlock) => {
      const clip = block.clip;
      if (!clip) {
        toast.error("No clip mapped to this beat");
        return;
      }
      if (approvals[block.id]) {
        toast.message("This beat is locked — unlock to regenerate.");
        return;
      }
      if (isEmptyProject) return;
      setRegenClipId(clip.id);
      const toastId = toast.loading("Reshoot queued…", {
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
        toast.error("Couldn't reshoot the clip", {
          id: toastId,
          description: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        setRegenClipId(null);
      }
    },
    [project, approvals, isEmptyProject],
  );

  const toggleApproval = useCallback(
    async (block: ScreenplayBlock) => {
      if (isEmptyProject) return;
      const next: ApprovalMap = { ...approvals };
      if (next[block.id]) delete next[block.id];
      else next[block.id] = true;
      setApprovals(next);
      try {
        // Read current pipeline_state from the row before merging so
        // we never blow away another surface's writes.
        const { data } = await supabase
          .from("movie_projects")
          .select("pipeline_state")
          .eq("id", project.id)
          .maybeSingle();
        const existing =
          data?.pipeline_state && typeof data.pipeline_state === "object"
            ? (data.pipeline_state as Record<string, unknown>)
            : {};
        await supabase
          .from("movie_projects")
          .update({
            pipeline_state: { ...existing, scriptApprovals: next },
          })
          .eq("id", project.id);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Script] approval persist failed", e);
        toast.error("Approval didn't save — try again.");
      }
    },
    [approvals, project.id, isEmptyProject],
  );

  const seekToBlock = (b: ScreenplayBlock) => {
    if (!b.clip) return;
    setPlayhead(b.clip.timelineStartSec);
    selectClip(b.clip.id);
    const owningScene = project.scenes.find((s) =>
      s.clips?.some((c) => c.id === b.clip!.id),
    );
    if (owningScene) selectScene(owningScene.id);
  };

  const onTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  const wordCount = displayText.split(/\s+/).filter(Boolean).length;
  const approvedCount = Object.keys(approvals).length;
  const activeBlock = activeIdx >= 0 ? blocks[activeIdx] : null;

  // ── Render: empty project ──────────────────────────────────────
  if (isEmptyProject) {
    return (
      <section className="relative flex-1 min-h-0 flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <Layers className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Open a project to read its screenplay.
          </p>
          <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
            Pick a film from Library, or hit N to start a new clip in this canvas.
          </p>
        </div>
      </section>
    );
  }

  // ── Render: editing mode ───────────────────────────────────────
  if (editing) {
    return (
      <section className="relative flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 sm:px-10">
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_PREMIUM }}
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
            placeholder={"FADE IN:\n\nA dawn sky over the small bridges. The camera drifts…"}
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

  // ── Render: no screenplay yet ──────────────────────────────────
  if (!displayText.trim()) {
    return (
      <section className="relative flex-1 min-h-0 flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <Layers className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
          <p
            className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            No screenplay yet.
          </p>
          <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
            Draft one from your project's mood and clip count, or write it yourself.
          </p>
          <div className="mt-7 inline-flex items-center gap-3">
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={regenerating}
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

  // ── Render: the screenplay ─────────────────────────────────────
  return (
    <section className="relative flex-1 min-h-0 flex flex-col">
      {/* Header — counts + actions */}
      <header className="shrink-0 px-6 sm:px-10 pt-6 pb-3 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.32em] flex items-center gap-2")}>
            <Layers className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
            <span>◆ Screenplay</span>
          </div>
          <h2
            className="mt-1 font-display italic text-[clamp(1.5rem,2.4vw,2rem)] font-light tracking-tight leading-none"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              {wordCount.toLocaleString()} words
            </span>
          </h2>
          <p className={cn(TYPE_META, "mt-1 text-muted-foreground/55 flex items-center gap-3 flex-wrap")}>
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

        <div className="flex items-center gap-2 shrink-0">
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
            disabled={regenerating}
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

      {/* Scene strip — horizontal scroller of slug-line chips */}
      {slugBlocks.length > 0 && (
        <nav className="shrink-0 px-6 sm:px-10 py-2 border-y border-white/[0.04] bg-[hsl(220_30%_4%/0.20)]">
          <ul className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {slugBlocks.map((b) => {
              const isActiveScene = activeBlock?.sceneIdx === b.sceneIdx;
              return (
                <li key={b.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => seekToBlock(b)}
                    disabled={!b.clip}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 h-7 rounded-full",
                      "text-[11px] font-mono uppercase tracking-[0.14em]",
                      "transition-colors ring-1 ring-inset",
                      isActiveScene
                        ? "bg-[hsl(212_100%_60%/0.16)] text-accent ring-accent/45"
                        : "bg-white/[0.02] text-foreground/75 ring-white/[0.06] hover:bg-white/[0.06]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                    title={b.clip ? fmtSceneTimecode(b.clip.timelineStartSec) : undefined}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isActiveScene ? "bg-accent" : "bg-foreground/35",
                      )}
                    />
                    <span className="truncate max-w-[200px]">{b.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Pending AI draft banner */}
      {pendingDraft && (
        <div className="shrink-0 mx-6 sm:mx-10 mt-4 rounded-xl ring-1 ring-inset ring-amber-300/35 bg-amber-500/[0.06] p-4 flex items-start gap-3">
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

      {/* Screenplay body */}
      <div
        ref={bodyRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 sm:px-10 py-7"
      >
        <article className="mx-auto max-w-[720px]">
          {blocks.length === 0 ? (
            <p className={cn(TYPE_META, "text-muted-foreground/55 text-center py-10")}>
              Couldn&rsquo;t parse the screenplay. Click <strong>Edit</strong> to fix the formatting.
            </p>
          ) : (
            blocks.map((b, i) => (
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
            ))
          )}
        </article>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BlockRow — one screenplay block formatted to its kind, with
// click-to-seek + per-block actions on hover.
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
      ? { icon: <Mic className="h-3 w-3" strokeWidth={1.5} />, label: "A1 dialog" }
      : block.kind === "action"
      ? { icon: <Disc3 className="h-3 w-3" strokeWidth={1.5} />, label: "ambient" }
      : block.kind === "slug"
      ? { icon: <Music2 className="h-3 w-3" strokeWidth={1.5} />, label: "A2 score" }
      : null;

  const showActions =
    (block.kind === "action" || block.kind === "dialogue") && !!block.clip;

  return (
    <div
      data-block-idx={idx}
      className={cn(
        "group/blk relative pl-6 pr-2 transition-colors",
        isActive &&
          "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-accent before:rounded-full",
      )}
    >
      <button
        type="button"
        onClick={onSeek}
        disabled={!block.clip}
        className={cn(
          "block w-full text-left rounded-md py-1.5 transition-colors",
          isActive ? "text-foreground" : "text-foreground/75 hover:text-foreground",
        )}
      >
        {renderBlockContent(block, isActive)}
      </button>

      {showActions && (
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
                "text-[9.5px] font-mono uppercase tracking-[0.14em]",
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
        <div
          className={cn(
            "font-mono uppercase tracking-[0.18em] text-[12px] mt-7 mb-2 flex items-center gap-3",
            isActive ? "text-accent" : "text-accent/85",
          )}
        >
          <span>◆</span>
          <span>{block.text}</span>
          {block.clip && (
            <span
              className={cn(
                TYPE_META,
                "ml-auto font-mono tabular-nums text-muted-foreground/55",
              )}
            >
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
