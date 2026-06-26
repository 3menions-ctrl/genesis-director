/**
 * RenderTheater — premium full-screen celebration when a render completes.
 *
 * The flow:
 *   1. App subscribes to `movie_projects` realtime updates for the current
 *      user; when a row flips from a non-terminal status to `completed`
 *      AND we haven't already shown the theater for that project, we
 *      trigger this overlay.
 *   2. Renders a black-out backdrop, plays the FilmLeader 3-2-1 countdown,
 *      then reveals the new render with title + actions (Open · Publish to
 *      Lobby · Dismiss).
 *   3. Visible only ONCE per render completion. Records the project id in
 *      localStorage so refreshes don't re-trigger.
 *
 * Mount this once at the App root; it's invisible until a render lands.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Play, Send, X, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { openPublishWizard } from "@/components/publish/GlobalPublishWizard";

interface CompletedProject {
  id: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string;
}

const SHOWN_KEY = 'sb.render_theater_shown.v1';

function loadShown(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function saveShown(ids: Set<string>) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(Array.from(ids).slice(-50)));
  } catch { /* ignore */ }
}

export function RenderTheater() {
  const { user } = useAuth();
  const [active, setActive] = useState<CompletedProject | null>(null);
  const [phase, setPhase] = useState<"closed" | "countdown" | "reveal">("closed");
  const [count, setCount] = useState(3);
  const shownRef = useRef<Set<string>>(loadShown());

  const trigger = useCallback((proj: CompletedProject) => {
    if (shownRef.current.has(proj.id)) return;
    shownRef.current.add(proj.id);
    saveShown(shownRef.current);
    setActive(proj);
    setPhase("countdown");
    setCount(3);
  }, []);

  // Countdown driver.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      setPhase("reveal");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count]);

  // Subscribe to realtime updates on movie_projects for this user.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`render-theater-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "movie_projects", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as CompletedProject;
          const prev = (payload.old as CompletedProject) ?? { status: "draft" };
          if (next.status === "completed" && prev.status !== "completed" && next.video_url) {
            trigger(next);
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, trigger]);

  const close = () => {
    setPhase("closed");
    setActive(null);
  };

  const publish = () => {
    if (!active) return;
    // Hand off to the global wizard so the operator picks a world, tags,
    // director's notes, and (optionally) enters today's prompt — same
    // premium flow that's available from anywhere else in the app.
    openPublishWizard(active.id);
    close();
  };

  if (phase === "closed" || !active) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black text-white">
      {/* Backdrop with ambient glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 50%, rgba(10,132,255,0.20), transparent 60%), radial-gradient(circle at 70% 50%, rgba(255,140,0,0.15), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: "url('/noise.svg')" }}
      />

      {/* Close affordance — always available */}
      <button
        onClick={close}
        className="absolute top-6 right-6 w-9 h-9 rounded-full border border-white/[0.10] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors z-30"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Countdown phase */}
      {phase === "countdown" && (
        <div className="relative z-10 flex flex-col items-center">
          <FilmLeaderRing count={count} />
          <div className="mt-12 text-[10px] font-mono uppercase tracking-[0.4em] text-white/55">
            Render complete · cuing the print
          </div>
        </div>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && (
        <div className="relative z-10 max-w-[900px] w-full px-6 lg:px-12 animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-amber-300/40 bg-amber-300/10 text-amber-200 text-[10px] font-mono uppercase tracking-[0.32em]">
              <Sparkles className="w-3 h-3" />
              The print is ready
            </div>
            <h1
              className="font-display font-light text-[36px] lg:text-[56px] leading-[1.05] tracking-tight text-white"
            >
              {active.title || "Untitled scene"}
            </h1>
            <p className="text-white/55 mt-3 text-[13px] font-mono uppercase tracking-[0.22em]">
              First playthrough · auto-publishes on your word
            </p>
          </div>

          {/* The video */}
          <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95)] mb-8">
            <div className="aspect-video bg-black">
              {active.video_url && (
                <video
                  src={active.video_url}
                  poster={active.thumbnail_url ?? undefined}
                  autoPlay
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/editor/${active.id}`}
              onClick={close}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
            >
              <Play className="w-3.5 h-3.5" />
              Open in editor
            </Link>
            <button
              onClick={publish}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/[0.20] hover:border-white/40 text-white/85 hover:text-white transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
            >
              <Send className="w-3.5 h-3.5" />
              Publish to Lobby
            </button>
            <Link
              to="/lobby"
              onClick={close}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-white/55 hover:text-white transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
            >
              Back to the floor <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>,
    portalTarget,
  );
}

function FilmLeaderRing({ count }: { count: number }) {
  return (
    <div className="relative w-[260px] h-[260px] flex items-center justify-center">
      {/* Outer rotating film leader */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2",
          count === 0 ? "border-white/15" : "border-white/30",
        )}
        style={{ animation: "spin 3s linear infinite" }}
      />
      <div
        className="absolute inset-4 rounded-full border border-white/15"
        style={{ animation: "spin 8s linear infinite reverse" }}
      />
      <div
        className="absolute inset-8 rounded-full border border-white/10"
      />
      {/* Cross hairs */}
      <div aria-hidden className="absolute inset-0">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15 -translate-x-px" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/15 -translate-y-px" />
      </div>
      {/* Glow */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.10), transparent 60%)",
        }}
      />
      {/* Number */}
      <span
        key={count}
        className="relative text-[120px] font-display font-light text-white animate-fade-in-up tabular-nums leading-none"
      >
        {count === 0 ? "CUE" : count}
      </span>
    </div>
  );
}
