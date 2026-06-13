/**
 * ProjectChooser — what /editor renders when no project id is in the
 * URL. Loads the user's recent movie_projects from supabase and
 * shows them as a floating grid the user can pick from.
 *
 * Mounted inside a normal FoundationShell (with the LeftRail) — this
 * is a navigation surface, not the editor proper, so the global
 * chrome is welcome.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Film,
  ArrowUpRight,
  Sparkles,
  Loader2,
  Clock,
  AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProjectCard {
  id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  aspect_ratio: string | null;
  updated_at: string;
  mood: string | null;
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProjectChooser() {
  const { user, loading: authLoading } = useAuth();
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("movie_projects")
          .select(
            "id, title, thumbnail_url, status, aspect_ratio, updated_at, mood",
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(24);
        if (cancelled) return;
        if (err) throw err;
        setProjects((data as ProjectCard[]) ?? []);
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[ProjectChooser] load failed", e);
        setError(
          e instanceof Error ? e.message : "Couldn't load your projects",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return (
    <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-16 pb-24 sm:px-8 lg:px-12">
      {/* Hero */}
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_PREMIUM }}
      >
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span>◆ Cutting room</span>
        </div>
        <h1
          className="mt-4 font-display italic font-light leading-[0.98] tracking-tight"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
          }}
        >
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/55 bg-clip-text text-transparent">
            Pick a project.
          </span>
        </h1>
        <p
          className="mt-6 max-w-xl text-[15px] leading-relaxed font-light text-muted-foreground/70"
        >
          Open one of your projects below to edit, or jump into Studio to
          spin up something new.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link
            to="/editor/demo"
            className="group/demo inline-flex items-center gap-2 text-[14.5px] text-accent"
          >
            <Film className="h-4 w-4" strokeWidth={1.5} />
            <span className="relative">
              Open the demo reel
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent to-accent/40 transition-transform duration-500 ease-out group-hover/demo:scale-x-100"
              />
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover/demo:translate-x-0.5 group-hover/demo:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
          <Link
            to="/studio"
            className="group/new inline-flex items-center gap-2 text-[14.5px] text-foreground/80 hover:text-foreground transition-colors"
          >
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span className="relative">
              New project in Studio
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground/70 transition-transform duration-500 ease-out group-hover/new:scale-x-100"
              />
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover/new:translate-x-0.5 group-hover/new:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
          <Link
            to="/library"
            className="group/lib inline-flex items-center gap-2 text-[14.5px] text-foreground/80 hover:text-foreground transition-colors"
          >
            <span className="relative">
              Browse Library
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-foreground/70 transition-transform duration-500 ease-out group-hover/lib:scale-x-100"
              />
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover/lib:translate-x-0.5 group-hover/lib:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </div>

        {/* Hint pill — the most important affordance on the page when
            the user is staring at an empty project list. */}
        <p className={cn(TYPE_META, "mt-4 text-muted-foreground/45 max-w-md")}>
          New here? Open the demo reel — every view, every panel, every
          keyboard shortcut, instantly populated.
        </p>
      </motion.div>

      {/* Hairline separator */}
      <div className="mt-12 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

      {/* Body — recent projects */}
      <div className="mt-10">
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] mb-6")}>
          ◆ Recent
        </div>

        {loading || authLoading ? (
          <LoadingProjects />
        ) : !user ? (
          <NotSignedIn />
        ) : error ? (
          <LoadError message={error} />
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {projects.map((p, i) => (
              <motion.li
                key={p.id}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.42,
                  ease: EASE_PREMIUM,
                  delay: 0.05 + i * 0.03,
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/editor/${p.id}`)}
                  className="group/p block w-full text-left transition-transform duration-300 hover:-translate-y-0.5"
                >
                  {/* Thumbnail frame — content, not chrome */}
                  <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[hsl(220_30%_8%)] ring-1 ring-white/[0.06] group-hover/p:ring-white/[0.20] transition-all">
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-[1200ms] group-hover/p:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-6 w-6 text-muted-foreground/35" strokeWidth={1.4} />
                      </div>
                    )}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.85)] via-transparent to-transparent"
                    />
                    {p.aspect_ratio && (
                      <div className="absolute top-2 right-2 mix-blend-difference">
                        <span className={cn(TYPE_META, "font-mono tabular-nums tracking-[0.22em] text-foreground/70")}>
                          {p.aspect_ratio}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Floating typography below */}
                  <div className="mt-3 px-0.5">
                    <h3
                      className="font-display italic text-[18px] font-light tracking-tight text-foreground/95 truncate group-hover/p:text-foreground transition-colors"
                      style={{ fontFamily: "'Fraunces', serif" }}
                    >
                      {p.title || "Untitled"}
                    </h3>
                    <div className={cn(TYPE_META, "mt-1 text-muted-foreground/55 flex items-center gap-2")}>
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      <span>{relativeTime(p.updated_at)}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span>{p.status}</span>
                    </div>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────────────────────
function LoadingProjects() {
  return (
    <div className="flex items-center gap-3 py-8 text-muted-foreground/55">
      <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={1.5} />
      <span className={cn(TYPE_META, "tracking-[0.30em]")}>
        Loading your projects
      </span>
    </div>
  );
}

function NotSignedIn() {
  return (
    <div className="py-10">
      <p
        className="font-display italic text-[22px] font-light text-foreground/90"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Sign in to edit.
      </p>
      <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md")}>
        You need an account to open the cutting room — your projects, takes, and edits live with you.
      </p>
      <div className="mt-6">
        <Link
          to="/auth"
          className="group/auth inline-flex items-center gap-2 text-[14px] text-accent"
        >
          <span className="relative">
            Sign in
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/auth:scale-x-100"
            />
          </span>
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="py-10">
      <AlertOctagon className="h-6 w-6 text-rose-300/80" strokeWidth={1.4} />
      <p
        className="mt-4 font-display italic text-[22px] font-light text-foreground/90"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Couldn&rsquo;t load your projects.
      </p>
      <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md")}>
        {message}
      </p>
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="py-10">
      <Film className="h-7 w-7 text-muted-foreground/55" strokeWidth={1.4} />
      <p
        className="mt-5 font-display italic text-[24px] font-light text-foreground/90"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        No projects yet.
      </p>
      <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md")}>
        Spin one up in Studio — it&rsquo;ll appear here once it has at least one
        rendered clip.
      </p>
      <div className="mt-6">
        <Link
          to="/studio"
          className="group/studio inline-flex items-center gap-2 text-[14px] text-accent"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="relative">
            Direct your first film
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover/studio:scale-x-100"
            />
          </span>
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform group-hover/studio:translate-x-0.5 group-hover/studio:-translate-y-0.5"
            strokeWidth={1.5}
          />
        </Link>
      </div>
    </div>
  );
}
