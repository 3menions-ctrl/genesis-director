/**
 * Script — for v1: inline-editable screenplay text. Click to edit,
 * ⌘↵ to save, Esc to cancel. Saves the full text back to
 * movie_projects.script_content on commit.
 *
 * The richer Descript-style mode (delete-a-word trims a clip via
 * editor-transcribe word timings; AI re-record on changed lines)
 * lands when transcripts are wired. The plain-text edit here is the
 * foundation that builds towards it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Layers, Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorProject } from "@/lib/editor/types";
import { setScriptContent } from "@/lib/editor/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  project: EditorProject;
}

export function Script({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const initial = project.scriptContent?.trim() ?? "";
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Reset draft if the underlying project's script changes (e.g.,
  // a Studio regeneration produced a new one).
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
    // Optimistic: update local store immediately.
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

  // Word count for the header
  const wordCount = (value || initial)
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <section className="relative flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12">
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_PREMIUM }}
        className="mx-auto max-w-[760px] py-10 pb-32"
      >
        {/* Header — eyebrow + words + save state */}
        <header className="flex items-end justify-between gap-3 mb-7">
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
                {wordCount > 0 ? `${wordCount.toLocaleString()} words.` : "Untitled."}
              </span>
            </h2>
          </div>

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
        </header>

        {/* Body — display or edit */}
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
        ) : initial ? (
          <button
            type="button"
            onClick={enterEdit}
            className={cn(
              "group/script block w-full text-left",
              "font-display italic font-light text-foreground/90 leading-[1.6] whitespace-pre-wrap",
              "transition-colors hover:text-foreground",
            )}
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)",
            }}
          >
            {initial}
          </button>
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
              Generate one in Studio, or click below to draft one inline
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

        <p className={cn(TYPE_META, "mt-16 text-muted-foreground/40 tracking-[0.32em] text-center")}>
          ◆ Word-level edit ↔ clip trim via AI re-record · coming next
        </p>
      </motion.div>
    </section>
  );
}
