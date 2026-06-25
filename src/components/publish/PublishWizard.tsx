/**
 * PublishWizard — premium modal that turns a finished project into a
 * published reel in the Lobby. Three steps:
 *
 *   1. World — choose a Channel World (Noir / Sci-Fi / Comedy / Docu /
 *      Music / Experimental). Hover-accents preview the chrome tint.
 *   2. Story — title (locked from project), tags, director's notes (the
 *      blurb the Theater overlay reveals).
 *   3. Confirm — review + a "Also enter today's prompt" toggle, then
 *      Publish. Hooks `publish_reel` then (if the toggle is on) inserts a
 *      `prompt_submissions` row referencing the new reel id.
 *
 * Driver-agnostic — mount it once in any project surface, control via the
 * `open` / `onClose` pair and the `projectId` prop.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, Sparkles, Wand2, Send, Calendar, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useReelPublisher } from "@/hooks/useReelPublisher";
import { useSafeNavigation } from "@/lib/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

interface Project {
  id: string;
  title: string;
  synopsis: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
}

interface World {
  slug: string;
  name: string;
  description: string | null;
  accent_hsl: string;
  glyph: string | null;
}

interface DailyPrompt {
  id: string;
  prompt_text: string;
  prompt_hint: string | null;
  prompt_date: string;
}

interface Props {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
  /** Optional callback fired with the new reel id after a successful publish. */
  onPublished?: (reelId: string) => void;
}

export function PublishWizard({ open, projectId, onClose, onPublished }: Props) {
  const { navigate } = useSafeNavigation();
  const { publish, publishing } = useReelPublisher();

  const [project, setProject] = useState<Project | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [worldSlug, setWorldSlug] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [enterPrompt, setEnterPrompt] = useState(true);

  // Load data on open.
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [projRes, worldsRes, promptRes] = await Promise.all([
          supabase.from("movie_projects").select("id, title, synopsis, thumbnail_url, video_url").eq("id", projectId).maybeSingle(),
          supabase.from("channel_worlds").select("*").eq("is_live", true).order("sort_order"),
          supabase.rpc("current_daily_prompt" as never),
        ]);
        if (cancelled) return;
        setProject((projRes.data as Project) ?? null);
        setWorlds((worldsRes.data as World[]) ?? []);
        const promptBundle = (promptRes as { data?: unknown }).data as { prompt: DailyPrompt } | null;
        setPrompt(promptBundle?.prompt ?? null);
      } catch (e) {
        console.error("[PublishWizard] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  // Reset state every time the modal opens fresh.
  useEffect(() => {
    if (!open) {
      setStep(1); setWorldSlug(null); setTags(""); setNotes(""); setEnterPrompt(true);
    }
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const accent = worlds.find((w) => w.slug === worldSlug)?.accent_hsl ?? "213 100% 60%";

  const submit = async () => {
    if (!project) return;
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
    const reelId = await publish(project.id, {
      worldSlug,
      directorNotes: notes.trim() || null,
      tags: tagArr,
      toastWorldLabel: worlds.find((w) => w.slug === worldSlug)?.name,
    });
    if (!reelId) return;

    // Optional daily-prompt entry.
    if (enterPrompt && prompt) {
      try {
        let { error } = await supabase.from("prompt_submissions").insert({
          prompt_id: prompt.id,
          reel_id: reelId,
          user_id: undefined, // RLS uses auth.uid()
        });
        if (error) {
          // RLS on prompt_submissions requires user_id = auth.uid() — fetch and retry.
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const retry = await supabase.from("prompt_submissions").insert({
              prompt_id: prompt.id, reel_id: reelId, user_id: user.id,
            });
            error = retry.error;
          }
        }
        // Only claim success when the insert actually landed. Previously
        // the toast fired unconditionally — if both attempts were
        // blocked by RLS the user was told their prompt entry succeeded
        // when it silently failed.
        if (error) {
          console.warn("[PublishWizard] prompt entry failed", error.message);
          toast.error("Couldn't enter today's prompt", { description: safeErrorMessage(error, "Please try again.") });
        } else {
          toast.success("Entered today's prompt");
        }
      } catch (e) {
        console.warn("[PublishWizard] prompt entry failed", e);
        toast.error("Couldn't enter today's prompt");
      }
    }

    onPublished?.(reelId);
    onClose();
    // Land the user on their fresh reel for instant gratification.
    setTimeout(() => navigate(`/watch/${reelId}`), 250);
  };

  if (!open) return null;
  const target = typeof document !== "undefined" ? document.body : null;
  if (!target) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-md animate-fade-in" />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[720px] max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.08] bg-background/95 backdrop-blur-2xl shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95)] animate-fade-in-up"
      >
        {/* Accent rail */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-px transition-colors"
          style={{ background: `linear-gradient(to bottom, transparent, hsla(${accent} / 0.6), transparent)` }}
        />

        {/* Header */}
        <header className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.05]">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] mb-2" style={{ color: `hsl(${accent})` }}>
              Publish · step {step} of 3
            </div>
            <h2 className="font-display text-[24px] font-light text-white tracking-tight">
              {step === 1 ? "Pick a world" : step === 2 ? "Tell the story" : "Confirm the print"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-white/[0.10] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {loading ? (
          <div className="p-12 text-center text-[12px] font-mono uppercase tracking-[0.22em] text-white/45">
            Loading…
          </div>
        ) : !project ? (
          <div className="p-12 text-center text-white/55">Couldn't load project.</div>
        ) : !project.video_url ? (
          <div className="p-12 text-center text-white/55">
            This project has no rendered video yet. Finish a render before publishing.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* PREVIEW STRIP — visible across all steps */}
            <div className="flex items-center gap-4 p-3 rounded-2xl border border-white/[0.06] bg-glass">
              {project.thumbnail_url ? (
                <img src={project.thumbnail_url} alt="" className="w-20 h-14 rounded-lg object-cover border border-white/[0.06] shrink-0" />
              ) : (
                <div className="w-20 h-14 rounded-lg bg-black/40 flex items-center justify-center text-white/30 shrink-0">
                  <Wand2 className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-white truncate font-light">{project.title}</div>
                <div className="text-[10px] text-white/45 font-mono uppercase tracking-[0.22em]">{project.id.slice(0, 8)}…</div>
              </div>
            </div>

            {step === 1 && (
              <div>
                <p className="text-[13px] text-white/55 mb-5 leading-relaxed">
                  The world determines where the reel shows up. You can skip and stay world-less.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <WorldOption
                    selected={worldSlug === null}
                    name="No world"
                    glyph="◯"
                    accent="0 0% 70%"
                    onClick={() => setWorldSlug(null)}
                  />
                  {worlds.map((w) => (
                    <WorldOption
                      key={w.slug}
                      selected={worldSlug === w.slug}
                      name={w.name}
                      glyph={w.glyph ?? "✦"}
                      accent={w.accent_hsl}
                      onClick={() => setWorldSlug(w.slug)}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <Field label="Tags">
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="noir, ai, short film, monologue"
                    className="w-full bg-glass-hover border border-white/[0.08] rounded-lg px-3 h-10 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  />
                  <p className="text-[10px] text-white/35 mt-1.5 font-mono">comma-separated · up to 12</p>
                </Field>
                <Field label="Director's notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="What were you going for? Inspirations, surprises, intent. Surfaces on the Theater overlay."
                    className="w-full bg-glass-hover border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <Summary label="World" value={worlds.find((w) => w.slug === worldSlug)?.name ?? "No world"} />
                <Summary label="Tags" value={tags.trim() || "—"} />
                <Summary label="Notes" value={notes.trim() ? `${notes.trim().slice(0, 120)}${notes.length > 120 ? "…" : ""}` : "—"} />

                {prompt && (
                  <label className={cn(
                    "flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors",
                    enterPrompt ? "border-amber-300/40 bg-amber-400/[0.06]" : "border-white/[0.06] bg-white/[0.015] hover:border-white/15",
                  )}>
                    <input
                      type="checkbox"
                      checked={enterPrompt}
                      onChange={(e) => setEnterPrompt(e.target.checked)}
                      className="mt-1 w-3.5 h-3.5 accent-amber-300 rounded border border-white/20 bg-transparent"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.32em] text-amber-200 mb-1">
                        <Calendar className="w-3 h-3" /> Today's prompt
                      </div>
                      <div className="text-[13px] text-white leading-snug">{prompt.prompt_text}</div>
                      {prompt.prompt_hint && (
                        <div className="text-[11px] text-white/45 mt-1">{prompt.prompt_hint}</div>
                      )}
                      <div className="text-[10px] text-white/40 font-mono mt-2">
                        Enter for the leaderboard · top picks featured tomorrow
                      </div>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between p-6 pt-4 border-t border-white/[0.05]">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-white/[0.10] hover:border-white/30 text-[11px] font-mono uppercase tracking-[0.22em] text-white/65 hover:text-white"
            >
              Back
            </button>
          ) : <span />}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={!project}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50"
            >
              Next <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={publishing || !project}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50"
            >
              {publishing ? (<><Sparkles className="w-3 h-3 animate-pulse" />Publishing…</>) : (<><Send className="w-3 h-3" />Publish to Lobby</>)}
            </button>
          )}
        </footer>
      </div>
    </div>,
    target,
  );
}

function WorldOption({ selected, name, glyph, accent, onClick }: { selected: boolean; name: string; glyph: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl border px-4 py-3 transition-colors text-left",
        selected ? "border-white/30 bg-glass-hover" : "border-white/[0.06] bg-white/[0.015] hover:border-white/15 hover:bg-glass",
      )}
      style={selected ? { boxShadow: `0 0 28px -8px hsla(${accent} / 0.45)` } : undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-[24px] leading-none"
          style={{ color: `hsl(${accent})`, textShadow: `0 0 14px hsla(${accent} / 0.5)` }}
        >
          {glyph}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] text-white truncate">{name}</div>
        </div>
        {selected && <CheckCircle2 className="ml-auto w-4 h-4" style={{ color: `hsl(${accent})` }} />}
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.04]">
      <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40 shrink-0">{label}</span>
      <span className="text-[12px] text-white/85 text-right break-words">{value}</span>
    </div>
  );
}

