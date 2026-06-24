/**
 * Library — /library
 *
 * Modern, cinematic browse of every film you've directed.
 *
 *   1. HERO PLAYER — the latest completed video plays full-bleed at
 *      the top, autoplay muted, title + meta overlaid. Click → full
 *      inline player on the same page.
 *   2. CATEGORY PILLS — filter by movie_genre (Cinematic / Storytelling
 *      / Documentary / Ad / Explainer / Educational / Motivational /
 *      Funny / Vlog / Religious). "All" by default.
 *   3. SEARCH bar.
 *   4. CARD GRID — full-bleed video card, hover → autoplay muted in
 *      place. Title + meta float over a bottom-gradient. DELETE button
 *      reveals on hover (top-right corner).
 *
 * Removed (intentionally): Atlas mode + Theater mode. The user
 * doesn't use them; their code lived in dead branches.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search, Plus, Film, Play, Loader2, Clock, Trash2, X as CloseIcon,
  Sparkles, Volume2, VolumeX, Pencil, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CenterLine } from "@/components/ui/CenterLine";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { ProjectBackdrop } from "@/pages/Editor/components/ProjectBackdrop";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { usePaginatedProjects } from "@/hooks/usePaginatedProjects";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ActiveRendersCard } from "@/components/library/ActiveRendersCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  EASE_PREMIUM,
  TYPE_EYEBROW,
  TYPE_META,
  RADIUS,
} from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────
type Genre =
  | "all"
  | "ad" | "educational" | "documentary" | "cinematic" | "funny"
  | "religious" | "motivational" | "storytelling" | "explainer" | "vlog";

const CATEGORIES: { id: Genre; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "cinematic",    label: "Cinematic" },
  { id: "storytelling", label: "Storytelling" },
  { id: "documentary",  label: "Documentary" },
  { id: "ad",           label: "Ad" },
  { id: "explainer",    label: "Explainer" },
  { id: "educational",  label: "Educational" },
  { id: "motivational", label: "Motivational" },
  { id: "funny",        label: "Funny" },
  { id: "vlog",         label: "Vlog" },
  { id: "religious",    label: "Religious" },
];

// Local project shape — narrower than usePaginatedProjects' return so
// the rest of this file can rely on a stable set of fields.
interface LibraryProject {
  id: string;
  name?: string | null;
  status?: string | null;
  updated_at?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  genre?: string | null;
}

export default function Library() {
  usePageMeta({
    title: "Library — Small Bridges",
    description: "Every film you've directed, in one room.",
  });

  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Genre>("all");

  const { projects: rawProjects, isLoading: loading, hasMore, loadMore } = usePaginatedProjects(
    "updated",
    "desc",
    "all",
    search,
  );
  const liveRenderTimecode = useLiveRenderTimecode();

  // The hook returns a slightly looser shape than we want. Narrow + cast
  // once, then everything downstream uses `LibraryProject`. We also
  // track deletes optimistically so the UI removes the card before the
  // DB round-trip completes.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const projects: LibraryProject[] = useMemo(
    () =>
      (rawProjects as unknown as LibraryProject[])
        .filter((p) => !deletedIds.has(p.id)),
    [rawProjects, deletedIds],
  );

  // Filter by category in-memory — categories live in movie_projects.genre.
  // We don't filter at the SQL layer because usePaginatedProjects' API
  // doesn't expose `genre`; cheaper to filter the small client list.
  const filtered = useMemo(() => {
    if (category === "all") return projects;
    return projects.filter((p) => p.genre === category);
  }, [projects, category]);

  const counts = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const inProgress = projects.filter(
      (p) =>
        p.status === "generating" ||
        p.status === "rendering" ||
        p.status === "stitching",
    ).length;
    return { total, completed, inProgress };
  }, [projects]);

  // Hero pick — latest completed project with a video_url. Falls back
  // to the latest project of any status if no completes yet.
  const hero = useMemo(() => {
    const playable = projects.find((p) => p.status === "completed" && !!p.video_url);
    return playable ?? projects.find((p) => !!p.video_url) ?? null;
  }, [projects]);

  // Per-category counts for the pill bar (shows total per category).
  const byCategory = useMemo(() => {
    const map: Partial<Record<Genre, number>> = { all: projects.length };
    for (const p of projects) {
      const g = (p.genre ?? "") as Genre;
      if (g) map[g] = (map[g] ?? 0) + 1;
    }
    return map;
  }, [projects]);

  // DELETE handler — confirmed via dialog state then writes to DB.
  // Optimistic remove from UI; if the delete fails we put it back and
  // toast the error.
  const [pendingDelete, setPendingDelete] = useState<LibraryProject | null>(null);
  const handleConfirmDelete = async () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setDeletedIds((s) => new Set(s).add(target.id));
    try {
      const { error } = await supabase
        .from("movie_projects")
        .delete()
        .eq("id", target.id);
      if (error) throw error;
      toast.success(`Deleted "${target.name ?? "Untitled"}"`);
    } catch (e) {
      setDeletedIds((s) => {
        const next = new Set(s);
        next.delete(target.id);
        return next;
      });
      toast.error("Couldn't delete", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  return (
    <FoundationShell>
      {/* Same atmospheric backdrop as the Studio (create) page. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <ProjectBackdrop thumbnailUrl={null} projectId="studio-create" mood={null} />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1480px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "library"],
            timecode:
              liveRenderTimecode ??
              `${counts.total} ${counts.total === 1 ? "FILM" : "FILMS"} · ${counts.inProgress} ACTIVE`,
          }}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <EditorialEyebrow>Library</EditorialEyebrow>
              <EditorialHeadline className="mt-5">
                Your films.
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Every reel you&rsquo;ve directed lives here. Latest on top,
                category-filtered, click to play in place.
              </p>
            </div>

            <button
              onClick={() => navigate("/studio?new=1")}
              className={cn(
                "group inline-flex items-center gap-2 px-5 py-3",
                RADIUS.chip,
                "bg-gradient-to-br from-accent/15 to-accent/5",
                "text-foreground transition-all hover:from-accent/25 hover:to-accent/10",
              )}
            >
              <Plus className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span className="text-[13px]">New film</span>
              <span className={cn(TYPE_META, "text-muted-foreground/45 group-hover:text-accent/80")}>
                ⌘ N
              </span>
            </button>
          </div>

          {/* ── Active renders (auto-hides when nothing rendering) */}
          <div className="mt-10">
            <ActiveRendersCard />
          </div>

          {/* ── 1. HERO PLAYER — latest, immersive ─────────────── */}
          {hero && (
            <HeroPlayer
              project={hero}
              onOpen={() => navigate(`/r/${hero.id}`)}
            />
          )}

          {/* ── 2. CATEGORY PILLS ──────────────────────────────── */}
          <div className="mt-10 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              const n = byCategory[c.id] ?? 0;
              if (c.id !== "all" && n === 0) return null;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "relative h-9 px-4 rounded-full text-[12.5px] inline-flex items-center gap-2 transition-all",
                    active
                      ? "bg-white/[0.06] text-white"
                      : "bg-white/[0.02] text-foreground/75 hover:bg-white/[0.05] hover:text-foreground",
                  )}
                >
                  <span>{c.label}</span>
                  <span className={cn(
                    TYPE_META,
                    "tabular-nums",
                    active ? "text-white/70" : "text-muted-foreground/50",
                  )}>
                    {n}
                  </span>
                  {active && <CenterLine />}
                </button>
              );
            })}
          </div>

          {/* ── 3. SEARCH ──────────────────────────────────────── */}
          <div className="mt-5 max-w-md">
            <div className="flex items-center gap-2.5 rounded-full bg-white/[0.04] px-4 h-11">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a film by title…"
                className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground/55 hover:text-foreground transition-colors"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── 4. GRID ────────────────────────────────────────── */}
          <div className="mt-8">
            <AnimatePresence mode="wait">
              {loading && filtered.length === 0 ? (
                <LoadingState />
              ) : filtered.length === 0 ? (
                category !== "all" ? (
                  <CategoryEmpty onReset={() => setCategory("all")} />
                ) : (
                  <EmptyLibrary onNew={() => navigate("/studio?new=1")} />
                )
              ) : (
                <motion.div
                  key="grid"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_PREMIUM }}
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {filtered.map((p, i) => (
                    <FullBleedCard
                      key={p.id}
                      project={p}
                      index={i}
                      onOpen={() => navigate(`/r/${p.id}`)}
                      onDelete={() => setPendingDelete(p)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {hasMore && filtered.length > 0 && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className={cn(
                    "rounded-full bg-white/[0.03] px-5 py-2.5 text-[12px] uppercase tracking-[0.2em]",
                    "text-muted-foreground/70 transition-colors",
                    "hover:bg-white/[0.06] hover:text-foreground",
                    "disabled:opacity-50",
                  )}
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        </EditorialCanvas>
      </div>

      {/* Delete confirmation */}
      <ConfirmDelete
        project={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StitchedVideo — plays a project's FULL film. For multi-clip projects the
// project's `video_url` is only the first clip, so we fetch the clips ordered
// by shot_index and play them back-to-back (then loop). Single-clip projects
// just loop their video_url. This is what makes the library play the whole
// stitched film instead of stopping after the first shot.
// ─────────────────────────────────────────────────────────────────────
function StitchedVideo({
  projectId, fallbackUrl, poster, muted, className, videoRef, onPlay, onPause,
}: {
  projectId: string;
  fallbackUrl?: string | null;
  poster?: string | null;
  muted?: boolean;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onPlay?: () => void;
  onPause?: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? localRef;
  const [urls, setUrls] = useState<string[]>(fallbackUrl ? [fallbackUrl] : []);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("video_clips")
        .select("video_url, shot_index, status")
        .eq("project_id", projectId)
        .order("shot_index", { ascending: true });
      if (cancelled) return;
      const clips = (data ?? [])
        .filter((r: { video_url?: string | null; status?: string | null }) =>
          !!r.video_url && (r.status == null || r.status === "completed"))
        .map((r: { video_url?: string | null }) => r.video_url as string);
      // Only override when there's a genuine multi-clip sequence to stitch.
      if (clips.length > 1) { setUrls(clips); setIdx(0); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const multi = urls.length > 1;
  // Advancing the src needs an explicit play() — autoPlay only fires once.
  useEffect(() => {
    if (multi) ref.current?.play().catch(() => {});
  }, [idx, multi, ref]);

  if (urls.length === 0) return null;
  return (
    <video
      ref={ref}
      src={urls[idx]}
      poster={poster ?? undefined}
      autoPlay
      muted={muted ?? true}
      playsInline
      preload="metadata"
      loop={!multi}
      onEnded={multi ? () => setIdx((i) => (i + 1) % urls.length) : undefined}
      onPlay={onPlay}
      onPause={onPause}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// HERO PLAYER — full-bleed, autoplay muted, click-to-unmute, immersive.
// ─────────────────────────────────────────────────────────────────────
function HeroPlayer({
  project,
  onOpen,
}: {
  project: LibraryProject;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const title = project.name?.trim() || "Untitled";

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_PREMIUM }}
      className="mt-12 relative overflow-hidden rounded-3xl shadow-[0_30px_80px_-20px_hsla(0_0%_0%/0.7)]"
    >
      <div className="relative aspect-[21/9] w-full bg-black">
        {project.video_url ? (
          // Plays the FULL stitched film — every clip in shot order, then loops.
          <StitchedVideo
            projectId={project.id}
            fallbackUrl={project.video_url}
            poster={project.thumbnail_url}
            muted={muted}
            videoRef={ref}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Film className="h-12 w-12 text-muted-foreground/35" strokeWidth={1} />
          </div>
        )}

        {/* Cinematic vignette */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[hsl(220_40%_3%/0.95)] via-[hsl(220_40%_3%/0.4)] via-50% to-[hsl(220_40%_3%/0.4)]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[hsl(220_40%_3%/0.6)] to-transparent" />

        {/* Top-right controls */}
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-black/55 backdrop-blur-md text-white hover:bg-black/75 transition-colors"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Volume2 className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
        </div>

        {/* Bottom title block */}
        <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] font-mono text-accent/85">
            <Sparkles className="h-3 w-3" strokeWidth={1.6} />
            <span>Latest film</span>
          </div>
          <h2
            className="text-[clamp(2rem,5vw,3.5rem)] font-display italic font-light leading-[1.02] text-white max-w-3xl"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                "inline-flex items-center gap-2 px-5 h-11 rounded-full",
                "bg-white text-black hover:bg-white/85 transition-colors",
                "text-[13.5px] font-medium",
              )}
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={1.8} />
              <span>Open</span>
            </button>
            <span className={cn(TYPE_META, "text-white/55")}>
              {project.updated_at ? relativeTime(project.updated_at) : ""}
            </span>
            {!playing && project.video_url && (
              <span className={cn(TYPE_META, "text-white/35 ml-2")}>
                <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> loading preview
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// FULL-BLEED CARD — video covers the entire card; meta floats over
// gradient at the bottom; hover plays muted preview; delete on hover.
// ─────────────────────────────────────────────────────────────────────
function FullBleedCard({
  project,
  index,
  onOpen,
  onDelete,
}: {
  project: LibraryProject;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const title = project.name?.trim() || "Untitled film";
  const status = project.status ?? "idle";
  const inProgress = status === "generating" || status === "rendering" || status === "stitching";
  const completed = status === "completed";
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [hovering, setHovering] = useState(false);
  // Mirror hovering in a ref so async callbacks (onCanPlay) see the
  // live value, not a stale closure from a stale render.
  const hoveringRef = useRef(false);
  hoveringRef.current = hovering;
  const canPreview = !!project.video_url && !reducedMotion;

  const startPreview = () => {
    if (!canPreview) return;
    setHovering(true);
    hoveringRef.current = true;
    const el = previewRef.current;
    if (el) {
      el.currentTime = 0;
      void el.play().catch(() => {});
    }
  };
  const stopPreview = () => {
    setHovering(false);
    hoveringRef.current = false;
    const el = previewRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  };

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.5), ease: EASE_PREMIUM }}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      className={cn(
        "group/card relative overflow-hidden aspect-[4/5] rounded-2xl",
        "bg-black",
        "transition-all",
        "shadow-[0_18px_50px_-18px_hsla(0_0%_0%/0.75)] hover:shadow-[0_24px_60px_-18px_hsla(0_0%_0%/0.85)]",
      )}
    >
      {/* THUMBNAIL (always visible until preview overlays it) */}
      {project.thumbnail_url ? (
        <img
          src={project.thumbnail_url}
          alt=""
          loading="lazy"
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
            "group-hover/card:scale-[1.04]",
          )}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[hsl(220_30%_8%)]">
          <Film className="h-12 w-12 text-muted-foreground/25" strokeWidth={1} />
        </div>
      )}

      {/* HOVER PREVIEW VIDEO — fades in over the thumbnail. The
          should-play decision uses a ref so onCanPlay (which can fire
          AFTER mouseleave) consults the live hover state, not a stale
          closure of `hovering`. */}
      {canPreview && (
        <video
          ref={previewRef}
          src={project.video_url ?? undefined}
          poster={project.thumbnail_url ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={() => {
            if (hoveringRef.current) void previewRef.current?.play().catch(() => {});
          }}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
            hovering ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {/* Bottom gradient + meta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[hsl(220_30%_3%/0.95)] via-[hsl(220_30%_3%/0.5)] to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <StatusPill inProgress={inProgress} completed={completed} />
        </div>
        <h3
          className="font-display italic text-[clamp(1.1rem,2.3vw,1.6rem)] leading-[1.1] text-white line-clamp-2"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {title}
        </h3>
        <div className="flex items-center gap-2 text-white/55">
          <Clock className="h-3 w-3" strokeWidth={1.5} />
          <span className={cn(TYPE_META, "tracking-[0.2em]")}>
            {project.updated_at ? relativeTime(project.updated_at) : "Just now"}
          </span>
        </div>
        {/* Quick actions — visible on hover. Edit goes back to the
            editor (owner only — Library page is per-user so always
            owner). Share copies the public reel URL. */}
        <div className={cn(
          "flex items-center gap-1.5 transition-opacity pt-1.5",
          "opacity-0 group-hover/card:opacity-100 focus-within:opacity-100",
        )}>
          <CardActionButton
            label="Edit"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={(e) => { e.stopPropagation(); window.location.assign(`/editor/${project.id}`); }}
          />
          <CardActionButton
            label="Share"
            icon={<Share2 className="h-3.5 w-3.5" />}
            onClick={async (e) => {
              e.stopPropagation();
              const url = `${window.location.origin}/r/${project.id}`;
              try {
                await navigator.clipboard.writeText(url);
                (await import("sonner")).toast.success("Link copied", { description: url });
              } catch {
                (await import("sonner")).toast.error("Couldn't copy link", { description: url });
              }
            }}
          />
        </div>
      </div>

      {/* DELETE button — top-right, fades in on hover. z-20 so it
          sits ABOVE the full-card click target below. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete project"
        title="Delete this film"
        className={cn(
          "absolute top-3 right-3 z-20 inline-flex items-center justify-center h-9 w-9 rounded-full",
          "bg-black/70 backdrop-blur-md",
          "text-white/85 hover:text-white hover:bg-red-500/85",
          "transition-all duration-200 active:scale-95",
          "opacity-0 group-hover/card:opacity-100 focus:opacity-100",
        )}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.6} />
      </button>

      {/* PLAY hint on hover (center) */}
      {completed && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity">
          <div className="h-14 w-14 rounded-full bg-white/[0.10] backdrop-blur-md inline-flex items-center justify-center">
            <Play className="h-5 w-5 text-white fill-current translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Full-card click target — sits BELOW the delete button via z-index */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${title}`}
        className="absolute inset-0 z-0"
      />
    </motion.div>
  );
}

function CardActionButton({
  label, icon, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11.5px]",
        "bg-black/55 backdrop-blur-md text-white/85",
        "hover:bg-black/75 hover:text-white transition-colors",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
function StatusPill({ inProgress, completed }: { inProgress: boolean; completed: boolean }) {
  if (inProgress) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
          "bg-[hsl(38_95%_55%/0.18)] backdrop-blur-md",
          TYPE_META,
          "text-[hsl(38_95%_75%)]",
        )}
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        rendering
      </span>
    );
  }
  if (completed) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
          "bg-[hsl(150_75%_45%/0.16)] backdrop-blur-md",
          TYPE_META,
          "text-[hsl(150_75%_75%)]",
        )}
      >
        <Sparkles className="h-2.5 w-2.5" />
        ready
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "bg-[hsl(220_30%_25%/0.4)] backdrop-blur-md",
        TYPE_META,
        "text-muted-foreground/75",
      )}
    >
      draft
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" strokeWidth={1.5} />
      <p className={cn("mt-4", TYPE_EYEBROW, "text-muted-foreground/55")}>
        Pulling up your reels…
      </p>
    </div>
  );
}

function EmptyLibrary({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className={cn(
          "mb-7 flex h-16 w-16 items-center justify-center",
          RADIUS.composer,
          "bg-gradient-to-br from-accent/15 to-accent/5",
        )}
      >
        <Film className="h-7 w-7 text-accent" strokeWidth={1.2} />
      </div>
      <p className="font-display italic text-3xl text-foreground/85">
        An empty stage.
      </p>
      <p className="mt-3 max-w-md text-[14px] text-muted-foreground/65">
        Your first film starts with a single sentence. Open the Studio and
        type what you see.
      </p>
      <button
        onClick={onNew}
        className={cn(
          "mt-8 inline-flex items-center gap-2 px-5 py-3",
          RADIUS.chip,
          "bg-gradient-to-br from-accent/15 to-accent/5",
          "transition-all hover:from-accent/25",
        )}
      >
        <Plus className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span className="text-[13px]">Open the Studio</span>
      </button>
    </div>
  );
}

function CategoryEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="font-display italic text-2xl text-foreground/85">
        Nothing in this category yet.
      </p>
      <p className="mt-2 max-w-md text-[13px] text-muted-foreground/65">
        Tag a film with a category from the Save dialog and it&apos;ll appear here.
      </p>
      <button
        onClick={onReset}
        className={cn(
          "mt-6 inline-flex items-center gap-2 px-4 h-9 rounded-full",
          "bg-white/[0.04] text-foreground/75",
          "hover:bg-white/[0.08] hover:text-foreground transition-colors",
        )}
      >
        <span className="text-[12.5px]">Show all films</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CONFIRM DELETE — small centered dialog, body-scroll locked.
// ─────────────────────────────────────────────────────────────────────
function ConfirmDelete({
  project,
  onCancel,
  onConfirm,
}: {
  project: LibraryProject | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Stable ref so the keydown effect can depend on just `open` (the
  // existence of project), avoiding listener add/remove churn when
  // onCancel identity changes on parent re-renders.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const isOpen = !!project;
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelRef.current(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="absolute inset-0 bg-[hsl(220_40%_2%/0.78)] backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative w-full max-w-[460px] rounded-2xl",
              "bg-gradient-to-b from-[hsl(220_30%_7%)] to-[hsl(220_35%_4%)]",
              "shadow-[0_40px_120px_-20px_hsla(0_0%_0%/0.85)]",
              "p-7",
            )}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE_PREMIUM }}
          >
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-500/15 mb-4">
              <Trash2 className="h-5 w-5 text-red-300" strokeWidth={1.8} />
            </div>
            <h3
              className="text-[20px] font-display italic font-light leading-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Delete this film?
            </h3>
            <p className="mt-2 text-[13.5px] text-muted-foreground/70 leading-relaxed">
              <span className="text-foreground/95">&ldquo;{project.name ?? "Untitled"}&rdquo;</span>{" "}
              will be permanently removed from your library + database. The
              source clips and renders are not retrievable.
            </p>
            <div className="mt-6 flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 h-10 rounded-full text-[13px] text-muted-foreground/75 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  "px-5 h-10 rounded-full inline-flex items-center gap-2 text-[13px]",
                  "bg-gradient-to-br from-red-500/20 to-red-500/[0.06]",
                  "text-foreground hover:from-red-500/30 transition-all",
                )}
              >
                <Trash2 className="h-4 w-4 text-red-300" strokeWidth={1.8} />
                <span>Delete permanently</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
