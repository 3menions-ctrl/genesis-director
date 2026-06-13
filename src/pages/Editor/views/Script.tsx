/**
 * Script — the screenplay lens.
 *
 * Three jobs, one surface:
 *   1. READ — the screenplay parses into clickable slug-line
 *      anchors. Clicking an anchor seeks the playhead to the
 *      first clip of that scene + selects the scene so Stage and
 *      Storyboard reflect the same context immediately.
 *   2. EDIT — click anywhere in the body to enter inline edit
 *      mode. ⌘↵ saves to movie_projects.script_content. Esc cancels.
 *   3. APPROVE / REGENERATE — when an AI draft is in flight
 *      (movie_projects.generated_script is the freshest write
 *      and differs from script_content), the user can Approve
 *      (promote generated_script → script_content) or Regenerate
 *      (call the generate-script edge function for a new draft).
 *
 * Schema split:
 *   script_content    = user-approved canonical text
 *   generated_script  = latest AI draft awaiting review
 * The editor reads `pr.script_content ?? pr.generated_script` so
 * either lands in the UI; the approval flow is the user explicitly
 * committing the draft as canonical.
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject, EditorClip } from "@/lib/editor/types";
import {
  setScriptContent,
  selectScene,
  setPlayhead,
} from "@/lib/editor/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
}

/**
 * Screenplay slug-line detector. Industry-standard format:
 *   INT. KITCHEN - DAY
 *   EXT. SUBWAY PLATFORM - NIGHT
 *   FADE IN:
 *   FADE OUT.
 * Also catches Hollywood-style scene headings prefixed with
 * "SCENE 1." / "SHOT 03 —". We treat any all-caps line that starts
 * with one of these tokens as an anchor.
 */
const SLUG_TOKENS =
  /^(?:(?:INT|EXT|EST|I\/E|INT\.\/EXT)\.?\s|FADE\s+(?:IN|OUT)|SCENE\s+\d+|SHOT\s+\d+)/i;

interface Block {
  kind: "slug" | "body";
  text: string;
  /** Sequential slug index — body blocks inherit the most recent
   *  slug's index so clicking anywhere in a scene knows which clip
   *  to anchor against. */
  sceneIdx: number;
}

function parseScript(raw: string): Block[] {
  if (!raw.trim()) return [];
  const lines = raw.split(/\r?\n/);
  const blocks: Block[] = [];
  let sceneIdx = -1; // becomes 0 on the first slug-line
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    blocks.push({
      kind: "body",
      text: buffer.join("\n").trim(),
      sceneIdx: Math.max(0, sceneIdx),
    });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && SLUG_TOKENS.test(trimmed)) {
      flushBuffer();
      sceneIdx += 1;
      blocks.push({ kind: "slug", text: trimmed, sceneIdx });
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  // If the script has no slug-lines at all, fold the entire text into
  // one body block under scene 0 so it still renders.
  if (blocks.length === 0) {
    blocks.push({ kind: "body", text: raw.trim(), sceneIdx: 0 });
  }
  return blocks;
}

export function Script({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const initial = (project.scriptContent ?? "").trim();
  const generated = ""; // placeholder — server-fetched separately below
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Fetch generated_script directly — useProject only surfaces the
  // resolved value (script_content || generated_script), so we pull
  // both columns here to distinguish "AI draft awaiting approval"
  // from "user-approved final".
  useEffect(() => {
    if (!project.id || project.id === "no-project") return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("movie_projects")
        .select("script_content, generated_script")
        .eq("id", project.id)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const draft = (data.generated_script ?? "").trim();
      const approved = (data.script_content ?? "").trim();
      // Only surface the draft when it materially differs from the
      // approved version. Trim + lowercase comparison so trailing
      // whitespace doesn't trigger a spurious "review me" pill.
      if (draft && draft.toLowerCase() !== approved.toLowerCase()) {
        setPendingDraft(draft);
      } else {
        setPendingDraft(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, generated]);

  // Mirror new initial values when the underlying project changes
  // (e.g. another tab regenerated the script).
  useEffect(() => {
    if (!editing) setValue(initial);
  }, [initial, editing]);

  // Auto-resize the textarea as the user types
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || !editing) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, editing]);

  // Flat list of V1 clips — the anchor target for each slug-line.
  const clips = useMemo(
    () =>
      project.scenes
        .flatMap((s) => s.clips)
        .filter((c): c is EditorClip => c.kind !== "title"),
    [project],
  );

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
      // eslint-disable-next-line no-console
      console.warn("[Script] save failed", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't save the script. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [value, initial, project.id]);

  /** Promote pending AI draft into the canonical script. */
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
        description: "Promoted as the canonical version of the screenplay.",
      });
    } catch (e) {
      toast.error("Approval failed", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [pendingDraft, project.id]);

  /** Reject the pending AI draft and discard. */
  const rejectDraft = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("movie_projects")
        .update({ generated_script: null })
        .eq("id", project.id);
      if (error) throw error;
      setPendingDraft(null);
      toast.message("Draft discarded", {
        description: "Returned to the approved version.",
      });
    } catch (e) {
      toast.error("Couldn't discard the draft", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [project.id]);

  /** Call the generate-script edge function for a fresh AI draft. */
  const regenerate = useCallback(async () => {
    setRegenerating(true);
    const toastId = toast.loading("Generating a new draft…", {
      description: `${project.title} · ${clips.length} clips on V1`,
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
          clipCount: clips.length || undefined,
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
      // Persist the draft into generated_script so other surfaces can
      // see it too. The user must then explicitly Approve to promote.
      const { error: upErr } = await supabase
        .from("movie_projects")
        .update({ generated_script: draft })
        .eq("id", project.id);
      if (upErr) throw upErr;
      setPendingDraft(draft);
      toast.success("Draft ready for review", {
        id: toastId,
        description: "Approve to make it the canonical version.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error("Couldn't generate a new draft", {
        id: toastId,
        description: msg,
      });
    } finally {
      setRegenerating(false);
    }
  }, [project, initial, clips.length]);

  /** Anchor a slug-line click to the corresponding V1 clip. */
  const jumpToScene = useCallback(
    (sceneIdx: number) => {
      const clip = clips[sceneIdx];
      if (!clip) return;
      setPlayhead(clip.timelineStartSec);
      // Selecting the scene context too so the storyboard mirrors.
      const owningScene = project.scenes.find((s) =>
        s.clips.some((c) => c.id === clip.id),
      );
      if (owningScene) selectScene(owningScene.id);
    },
    [clips, project.scenes],
  );

  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  const display = pendingDraft ?? (value || initial);
  const blocks = useMemo(() => parseScript(display), [display]);
  const wordCount = display.split(/\s+/).filter(Boolean).length;
  const sceneCount = blocks.filter((b) => b.kind === "slug").length;

  return (
    <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_PREMIUM }}
        className="mx-auto max-w-[760px] py-10 pb-32"
      >
        {/* Header */}
        <header className="flex items-end justify-between gap-3 mb-6 flex-wrap">
          <div>
            <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
              <Layers className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
              <span>◆ Script</span>
            </div>
            <h2
              className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                {wordCount > 0
                  ? `${wordCount.toLocaleString()} words${sceneCount > 0 ? ` · ${sceneCount} ${sceneCount === 1 ? "scene" : "scenes"}` : ""}.`
                  : "Untitled."}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
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
                  className={cn(TYPE_META, "text-accent flex items-center gap-1.5")}
                >
                  <Check className="h-3 w-3" strokeWidth={2} />
                  Saved
                </motion.span>
              ) : !editing && initial ? (
                <motion.button
                  key="edit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  type="button"
                  onClick={enterEdit}
                  className={cn(
                    TYPE_META,
                    "text-muted-foreground/45 hover:text-accent transition-colors flex items-center gap-1.5",
                  )}
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.5} />
                  Edit
                </motion.button>
              ) : null}
            </AnimatePresence>

            {!editing && project.id !== "no-project" && (
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
                title="Generate a fresh AI draft from the project's mood + genre"
              >
                {regenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                ) : (
                  <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
                )}
                <span>{regenerating ? "Drafting" : "Regenerate"}</span>
              </button>
            )}
          </div>
        </header>

        {/* Pending AI draft banner */}
        {pendingDraft && !editing && (
          <AnimatePresence>
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_PREMIUM }}
              className="mb-7 rounded-xl ring-1 ring-inset ring-amber-300/35 bg-amber-500/[0.06] p-4 flex items-start gap-3"
            >
              <Sparkles className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p
                  className="font-display italic text-[14px] text-foreground/95"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  Fresh AI draft awaiting your approval.
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground/75 leading-snug">
                  Reading the draft below. Approve to promote it as the canonical screenplay, or reject to keep the previous version.
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
            </motion.div>
          </AnimatePresence>
        )}

        {/* Body */}
        {editing ? (
          <>
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              placeholder="FADE IN:&#10;&#10;A dawn sky over the small bridges. The camera drifts…"
              rows={12}
              className={cn(
                "block w-full resize-none bg-transparent outline-none",
                "font-display italic font-light leading-[1.6] whitespace-pre-wrap",
                "text-[clamp(1.05rem,1.5vw,1.2rem)]",
                "text-foreground placeholder:text-foreground/30",
                "border-b border-accent/40 focus:border-accent pb-4",
                "caret-accent",
              )}
              style={{ fontFamily: "'Fraunces', serif" }}
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
          </>
        ) : blocks.length > 0 ? (
          <article
            className={cn(
              "group/script block w-full text-left",
              "font-display italic font-light text-foreground/90 leading-[1.6]",
            )}
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)",
            }}
          >
            {blocks.map((b, i) =>
              b.kind === "slug" ? (
                <SlugAnchor
                  key={`slug-${i}`}
                  text={b.text}
                  clip={clips[b.sceneIdx] ?? null}
                  onJump={() => jumpToScene(b.sceneIdx)}
                />
              ) : (
                <button
                  key={`body-${i}`}
                  type="button"
                  onClick={enterEdit}
                  className="block w-full text-left whitespace-pre-wrap mb-7 hover:text-foreground transition-colors"
                >
                  {b.text}
                </button>
              ),
            )}
          </article>
        ) : (
          <div className="py-12 text-center">
            <Layers className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-5 font-display italic text-[22px] font-light text-foreground/85"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No script yet.
            </p>
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md mx-auto")}>
              Regenerate above to draft one from your project's mood and clip count, or write it inline.
            </p>
            <button
              type="button"
              onClick={enterEdit}
              className={cn(
                "mt-7 group/start inline-flex items-center gap-2 text-[13.5px] text-accent",
              )}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="relative">
                Start writing
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/start:scale-x-100"
                />
              </span>
            </button>
          </div>
        )}

        <p className={cn(TYPE_META, "mt-16 text-muted-foreground/40 tracking-[0.30em] text-center")}>
          ◆ Click any slug-line to seek the playhead · click body text to edit
        </p>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SlugAnchor — clickable scene heading. On hover it surfaces the
// linked clip's prompt as a hint chip and the timecode it lands on.
// ─────────────────────────────────────────────────────────────────────────────
function SlugAnchor({
  text,
  clip,
  onJump,
}: {
  text: string;
  clip: EditorClip | null;
  onJump: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!clip}
      title={clip ? `Seek to ${clip.timelineStartSec.toFixed(1)}s` : undefined}
      className={cn(
        "group/anchor mt-8 mb-3 block w-full text-left",
        "font-mono uppercase not-italic tracking-[0.18em]",
        "text-[14px] text-accent",
        "hover:text-foreground transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      )}
    >
      <span className="inline-flex items-baseline gap-3">
        <span className="text-accent/70 group-hover/anchor:text-foreground/85 transition-colors">
          ◆
        </span>
        <span>{text}</span>
        {clip && (
          <span className={cn(TYPE_META, "ml-3 font-mono tabular-nums text-muted-foreground/55 not-italic")}>
            {Math.floor(clip.timelineStartSec / 60)
              .toString()
              .padStart(2, "0")}
            :
            {Math.floor(clip.timelineStartSec % 60)
              .toString()
              .padStart(2, "0")}
          </span>
        )}
      </span>
    </button>
  );
}
