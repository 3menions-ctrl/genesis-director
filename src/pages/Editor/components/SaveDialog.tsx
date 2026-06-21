/**
 * SaveDialog — cinematic, centered, epic.
 *
 * Built from scratch on a Portal + fixed-overlay foundation so the
 * shadcn Dialog primitive's positioning quirks (and any editor-side
 * z-index conflicts with the top status bar) can't push it
 * off-screen. The dialog itself is a flex-centered card on top of a
 * full-bleed scrim.
 *
 * Two-step flow:
 *   1. METADATA — title (required), category (movie_genre enum),
 *      short description. Pre-fills from the project's current
 *      columns so a quick re-save is one click.
 *   2. NEXT-STEPS — after Save lands, ask the user if they want to
 *      render + publish. "Render now" hands off to the Export panel;
 *      "Just save" closes; auto-save still runs underneath.
 *
 * Writes:
 *   movie_projects.title       ← user input
 *   movie_projects.genre       ← enum from picker
 *   movie_projects.synopsis    ← description text
 *   movie_projects.status      ← 'completed' (pins to Library, badge)
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, ArrowRight, Check, Sparkles, X as CloseIcon,
  Loader2, Film, Camera, GraduationCap, Megaphone, Mic,
  HeartHandshake, Smile, Sparkle, Heart, Cross,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EditorProject } from "@/lib/editor/types";
import { flushNow } from "@/lib/editor/document-store";

interface Props {
  open: boolean;
  onClose: () => void;
  project: EditorProject | null;
  onOpenExport?: () => void;
}

type Genre =
  | "ad" | "educational" | "documentary" | "cinematic" | "funny"
  | "religious" | "motivational" | "storytelling" | "explainer" | "vlog";

const GENRES: { id: Genre; label: string; hint: string; Icon: typeof Film }[] = [
  { id: "cinematic",    label: "Cinematic",    hint: "Narrative film",        Icon: Film },
  { id: "storytelling", label: "Storytelling", hint: "Personal / fiction",    Icon: Sparkle },
  { id: "documentary",  label: "Documentary",  hint: "Real subject",          Icon: Camera },
  { id: "ad",           label: "Ad",           hint: "Marketing / brand",     Icon: Megaphone },
  { id: "explainer",    label: "Explainer",    hint: "How-to / talking head", Icon: Mic },
  { id: "educational",  label: "Educational",  hint: "Tutorial / lesson",     Icon: GraduationCap },
  { id: "motivational", label: "Motivational", hint: "Inspirational",         Icon: HeartHandshake },
  { id: "funny",        label: "Funny",        hint: "Comedy / meme",         Icon: Smile },
  { id: "vlog",         label: "Vlog",         hint: "Day-in-the-life",       Icon: Heart },
  { id: "religious",    label: "Religious",    hint: "Faith content",         Icon: Cross },
];

type Phase = "metadata" | "saving" | "next-steps";

export function SaveDialog({ open, onClose, project, onOpenExport }: Props) {
  const [phase, setPhase] = useState<Phase>("metadata");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<Genre>("cinematic");
  const [synopsis, setSynopsis] = useState("");

  // Pre-fill when the dialog opens. Guard against the rapid open/close
  // race: if the user closes the dialog before the async prefill
  // resolves, the setState calls would land on a closed dialog and
  // re-render stale form values when the next open happens. Cancel
  // flag short-circuits the late callback.
  useEffect(() => {
    if (!open || !project) return;
    setPhase("metadata");
    setTitle(project.title ?? "");
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("movie_projects")
        .select("genre, synopsis")
        .eq("id", project.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const g = data as { genre?: string | null; synopsis?: string | null };
        if (g.genre && GENRES.find((x) => x.id === g.genre)) setGenre(g.genre as Genre);
        setSynopsis(g.synopsis ?? "");
      }
    })();
    return () => { cancelled = true; };
  }, [open, project]);

  // Esc to close, body scroll lock while open. stopPropagation +
  // capture-phase so the Shell's Esc-clears-selection handler doesn't
  // also fire — the user previously lost their timeline selection
  // every time they aborted the save dialog. Also prevents JKL
  // transport from firing when the dialog has focus (the genre
  // picker holds focus, not an INPUT, so the Shell's input guard
  // doesn't catch it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // Swallow JKL while dialog is open so the player doesn't
      // scrub behind the modal.
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k" || k === "l") {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true); // capture-phase
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // `publishAfter` controls what happens once the save resolves:
  //   • false → land on the next-steps screen (the user picks render-now)
  //   • true  → close the dialog and immediately open the Export panel,
  //             which kicks off the render + publish flow. This is the
  //             one-click "Save & Publish" path the metadata-phase CTA
  //             drives so users don't have to traverse a second screen.
  const handleSave = async (publishAfter = false) => {
    if (!project) return;
    if (!title.trim()) { toast.error("Give your video a title"); return; }
    setPhase("saving");
    try {
      // 1. FLUSH every pending clip-properties debounce so the render
      //    pipeline reads the user's latest grades + VFX, not stale data.
      //    Was missing from the save path → ExportPanel had to flush
      //    again, and any user saving without exporting lost their work.
      const sync = await import("@/hooks/editor/useClipPropertiesSync");
      await sync.flushPendingClipWrites();
      // Force-write the timeline arrangement (clips, transitions, titles,
      // overlays, tracks) to editor_state NOW — otherwise a Save within
      // the 600ms debounce window persists only clip rows and the
      // structural edit (splits/reorders/effects) is lost on reload.
      const esSync = await import("@/hooks/editor/useEditorStateSync");
      await esSync.flushEditorState();
      await flushNow();

      // 2. AUTH PRECHECK — RLS silently returns 0 rows on auth/policy
      //    fail and the supabase client reports no error. Verify the
      //    session up front so we can surface a real error instead of
      //    a celebratory toast for a no-op write.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You're signed out. Sign in again to save.");
      }

      // 3. UPDATE with .select() — `data` is non-null only when at
      //    least one row was actually updated. If RLS rejects, data
      //    is null and we throw.
      //
      //    Privacy: is_public is ONLY set when the user explicitly
      //    chose Save & Publish. Plain Save now preserves the project's
      //    current privacy state. The old behavior silently published
      //    drafts (and combined with the first-clip-as-video_url
      //    fallback, made a single uploaded clip publicly visible
      //    after one click of Save). We never auto-flip-OFF either:
      //    a project that was already public stays public.
      const updatePayload: {
        title: string;
        genre: Genre;
        synopsis: string | null;
        status: string;
        is_public?: boolean;
      } = {
        title:    title.trim(),
        genre,
        synopsis: synopsis.trim() || null,
        status:   "completed",
      };
      if (publishAfter) updatePayload.is_public = true;
      const { data, error } = await supabase
        .from("movie_projects")
        .update(updatePayload)
        .eq("id", project.id)
        .select("id, title, genre, synopsis, status, is_public")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("Save was blocked — this project may not belong to your account.");
      }

      // 4. REFRESH the in-memory editor store so the TopStatusBar +
      //    Project tab pick up the new title/status immediately,
      //    instead of waiting for a full reload.
      try {
        const store = await import("@/lib/editor/store");
        const state = store.getEditorState();
        if (state.project && state.project.id === project.id) {
          store.setProject({
            ...state.project,
            title: title.trim(),
            status: "completed",
          });
        }
      } catch { /* best-effort */ }

      if (publishAfter) {
        // Backfill — surface a self-notification so the bell records
        // the "I published this" moment alongside the trigger-driven
        // published_reels fan-out. Best-effort; failure is silent.
        try {
          await supabase.rpc("notify_self" as never, {
            p_type: "video_complete",
            p_title: `Publishing · ${title.trim()}`,
            p_body: "Publishing to the Lobby — your edit plays there with your effects.",
            p_link: `/editor/${project.id}`,
            p_data: { project_id: project.id, source: "save-dialog" },
          } as never);
        } catch { /* best-effort */ }

        toast.success("Saved · opening publish", {
          description: "Publishing to the Lobby — it plays there with your effects, no render.",
        });
        onClose();
        window.setTimeout(() => onOpenExportRef.current?.(), 120);
        return;
      }
      // Save without publish — drop a quiet system notification too so
      // the bell remembers the checkpoint. Best-effort; doesn't block.
      try {
        await supabase.rpc("notify_self" as never, {
          p_type: "system",
          p_title: `Saved · ${title.trim()}`,
          p_body: "Pinned to your Library. Render anytime from the Export icon.",
          p_link: `/editor/${project.id}`,
          p_data: { project_id: project.id, source: "save-dialog" },
        } as never);
      } catch { /* best-effort */ }
      toast.success("Saved · marked Complete", {
        description: "Pinned to your Library with a Completed badge.",
      });
      setPhase("next-steps");
    } catch (e) {
      setPhase("metadata");
      toast.error("Couldn't save", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  // Stable ref so the timeout callback always invokes the LATEST
  // onOpenExport, not a snapshot from when handleRenderNow was bound.
  const onOpenExportRef = useRef(onOpenExport);
  onOpenExportRef.current = onOpenExport;
  const handleRenderNow = () => {
    onClose();
    window.setTimeout(() => onOpenExportRef.current?.(), 120);
  };

  if (typeof document === "undefined") return null;

  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="save-dialog"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* SCRIM — heavy blur + dark wash so the editor underneath
              recedes and the dialog reads as the only thing in the room. */}
          <motion.div
            className="absolute inset-0 bg-[hsl(220_40%_2%/0.78)] backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden
          />

          {/* CARD — flex-centered on the scrim. Width caps at 600px. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            className={cn(
              "relative w-full max-w-[600px] max-h-[90vh] overflow-y-auto",
              "rounded-3xl border border-white/[0.08]",
              "bg-gradient-to-b from-[hsl(220_30%_7%)] to-[hsl(220_35%_4%)]",
              "shadow-[0_40px_120px_-20px_hsla(0_0%_0%/0.85),0_0_80px_-30px_hsla(45_95%_55%/0.25),inset_0_1px_0_hsla(0_0%_100%/0.06)]",
            )}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* Top shine */}
            <div
              aria-hidden
              className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent pointer-events-none"
            />

            {/* Accent halo behind the title — gives the card a "stage" feel. */}
            <div
              aria-hidden
              className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[80%] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, hsla(45_95%_55%/0.18), transparent 70%)" }}
            />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close save dialog"
              className="absolute top-4 right-4 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              <CloseIcon className="h-4 w-4" strokeWidth={1.6} />
            </button>

            {/* CONTENT */}
            <div className="relative px-7 py-8 sm:px-10 sm:py-10">
              {phase !== "next-steps" ? (
                <MetadataForm
                  title={title} setTitle={setTitle}
                  genre={genre} setGenre={setGenre}
                  synopsis={synopsis} setSynopsis={setSynopsis}
                  onSave={() => handleSave(false)}
                  onSaveAndPublish={() => handleSave(true)}
                  onCancel={onClose}
                  saving={phase === "saving"}
                />
              ) : (
                <NextSteps
                  onRender={handleRenderNow}
                  onJustSave={onClose}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal-mount on body so the dialog escapes the editor's transform
  // contexts (which can break `position: fixed` centering when a
  // ancestor has `transform`/`filter`/`perspective`).
  return createPortal(dialog, document.body);
}

// ─────────────────────────────────────────────────────────────────────
// STEP 1 — Metadata form
// ─────────────────────────────────────────────────────────────────────
function MetadataForm({
  title, setTitle,
  genre, setGenre,
  synopsis, setSynopsis,
  onSave, onSaveAndPublish, onCancel, saving,
}: {
  title: string; setTitle: (v: string) => void;
  genre: Genre; setGenre: (g: Genre) => void;
  synopsis: string; setSynopsis: (v: string) => void;
  onSave: () => void;
  onSaveAndPublish: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <>
      {/* HEADER */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className={cn(TYPE_META, "text-emerald-300/80 tracking-[0.32em]")}>◆ Save</span>
        </div>
        <h2
          id="save-dialog-title"
          className="text-[clamp(1.7rem,3.2vw,2.2rem)] font-display italic font-light leading-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
            Mark this complete.
          </span>
        </h2>
        <p className="mt-3 text-[13.5px] font-light leading-relaxed text-muted-foreground/65 max-w-md mx-auto">
          Give your project a name + category so it&apos;s easy to find later.
          Auto-save is running underneath; this is the explicit checkpoint.
        </p>
      </div>

      {/* TITLE */}
      <div className="mb-6">
        <label className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] block mb-2.5")}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My short film"
          autoFocus
          maxLength={120}
          className={cn(
            "w-full h-12 px-4 rounded-xl",
            "bg-white/[0.025] ring-1 ring-inset ring-white/[0.08]",
            "focus:ring-emerald-400/40 focus:bg-white/[0.04]",
            "text-[15px] text-foreground placeholder:text-muted-foreground/35",
            "outline-none transition-all",
            "font-display italic",
          )}
          style={{ fontFamily: "'Fraunces', serif" }}
        />
      </div>

      {/* CATEGORY */}
      <div className="mb-6">
        <label className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] block mb-2.5")}>
          Category
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
          {GENRES.map((g) => {
            const active = genre === g.id;
            const { Icon } = g;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenre(g.id)}
                className={cn(
                  "group/cat relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all",
                  "ring-1 ring-inset",
                  active
                    ? "bg-gradient-to-br from-emerald-400/15 to-emerald-400/[0.04] ring-emerald-400/40 text-foreground"
                    : "bg-white/[0.02] ring-white/[0.06] text-foreground/85 hover:ring-white/[0.18] hover:bg-white/[0.04]",
                )}
              >
                <span className={cn(
                  "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                  active ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.03] text-foreground/55 group-hover/cat:text-foreground/85",
                )}>
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-tight">{g.label}</div>
                  <div className={cn(TYPE_META, "text-muted-foreground/55 mt-0.5 truncate")}>{g.hint}</div>
                </div>
                {active && (
                  <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" strokeWidth={2.2} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="mb-8">
        <label className={cn(TYPE_META, "text-muted-foreground/65 tracking-[0.22em] block mb-2.5")}>
          Short description <span className="text-muted-foreground/40 normal-case tracking-normal">· optional</span>
        </label>
        <textarea
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          placeholder="One-line synopsis that shows on the Library card and Lobby reel."
          maxLength={280}
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl resize-none",
            "bg-white/[0.025] ring-1 ring-inset ring-white/[0.08]",
            "focus:ring-emerald-400/40 focus:bg-white/[0.04]",
            "text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/35",
            "outline-none transition-all",
          )}
        />
        <div className={cn(TYPE_META, "text-muted-foreground/45 mt-1.5 text-right")}>
          {synopsis.length} / 280
        </div>
      </div>

      {/* ACTIONS — three CTAs: Cancel, Save, Save & Publish. The
          "Save & Publish" path is the explicit one-click outcome users
          asked for (saved + rendering + heading to the Lobby). Plain
          "Save" still goes through the next-steps screen so users who
          want to think about it can. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(
            "px-5 h-11 rounded-full text-[13.5px] text-muted-foreground/75 hover:text-foreground transition-colors",
            saving && "opacity-50 cursor-not-allowed",
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !title.trim()}
          className={cn(
            "px-5 h-11 rounded-full inline-flex items-center gap-2 text-[13.5px]",
            "border border-white/[0.12] bg-white/[0.04]",
            "text-foreground/85 hover:border-white/[0.24] hover:bg-white/[0.07]",
            "transition-all",
            (saving || !title.trim()) && "opacity-65 cursor-not-allowed",
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          ) : (
            <Save className="h-4 w-4 text-foreground/65" strokeWidth={1.8} />
          )}
          <span>{saving ? "Saving…" : "Save"}</span>
        </button>
        <button
          type="button"
          onClick={onSaveAndPublish}
          disabled={saving || !title.trim()}
          className={cn(
            "px-6 h-11 rounded-full inline-flex items-center gap-2.5 text-[13.5px] font-medium",
            "border border-accent/45 bg-gradient-to-br from-accent/20 to-accent/[0.06]",
            "text-foreground shadow-[0_8px_24px_-8px_hsl(var(--accent)/0.4)]",
            "hover:border-accent/65 hover:from-accent/30 hover:shadow-[0_12px_32px_-8px_hsl(var(--accent)/0.55)]",
            "transition-all",
            (saving || !title.trim()) && "opacity-65 cursor-not-allowed",
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          ) : (
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.8} />
          )}
          <span>{saving ? "Saving…" : "Save & Publish"}</span>
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 2 — Next steps (render + publish, or just save)
// ─────────────────────────────────────────────────────────────────────
function NextSteps({ onRender, onJustSave }: { onRender: () => void; onJustSave: () => void }) {
  return (
    <>
      <div className="text-center mb-7">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-400/15 ring-1 ring-inset ring-emerald-400/40 mb-4"
        >
          <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.2} />
        </motion.div>
        <h2
          className="text-[clamp(1.7rem,3.2vw,2.2rem)] font-display italic font-light leading-tight"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/65 bg-clip-text text-transparent">
            Saved.
          </span>
        </h2>
        <p className="mt-3 text-[13.5px] font-light leading-relaxed text-muted-foreground/65 max-w-md mx-auto">
          Now: publish it so it shows up in the Lobby and on your profile —
          it plays with your effects, no render needed.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onRender}
          className={cn(
            "group/cta w-full inline-flex items-center justify-between gap-4 px-5 h-16 rounded-2xl text-left transition-all",
            "border border-accent/45 bg-gradient-to-br from-accent/18 to-accent/[0.04]",
            "shadow-[0_12px_36px_-12px_hsl(var(--accent)/0.45)]",
            "hover:border-accent/65 hover:from-accent/28 hover:shadow-[0_18px_44px_-12px_hsl(var(--accent)/0.6)] hover:-translate-y-px",
          )}
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-accent/15 ring-1 ring-inset ring-accent/30">
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-[14px] font-medium text-foreground">Publish to Lobby</div>
              <div className={cn(TYPE_META, "text-muted-foreground/65 mt-0.5 tracking-[0.18em]")}>
                Shares to Lobby + Profile — plays with your effects, no render
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover/cta:translate-x-0.5" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onJustSave}
          className={cn(
            "group/cta w-full inline-flex items-center justify-between gap-4 px-5 h-16 rounded-2xl text-left transition-all",
            "border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.20] hover:bg-white/[0.04]",
          )}
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
              <Save className="h-4 w-4 text-foreground/75" strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-[14px] font-medium text-foreground">Just save for now</div>
              <div className={cn(TYPE_META, "text-muted-foreground/65 mt-0.5 tracking-[0.18em]")}>
                Pinned to Library — publish anytime from the Export icon
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-foreground/55 transition-transform group-hover/cta:translate-x-0.5" strokeWidth={1.8} />
        </button>
      </div>
    </>
  );
}
