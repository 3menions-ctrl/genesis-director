/**
 * Library — /library
 *
 * The canonical surface for "your films." Replaces the legacy
 * /projects sprawl with a focused editorial grid. Built on the
 * foundation: FoundationShell + EditorialCanvas + glass design
 * vocabulary.
 *
 * Mode toggle: Grid (default) · Atlas · Theater. Atlas + Theater wire
 * in via task #198. For MVP they're visible and selectable but render
 * a "coming online" state.
 *
 * Data: reuses the existing usePaginatedProjects hook.
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Plus,
  Folder,
  Telescope,
  Theater as TheaterIcon,
  Film,
  Play,
  Loader2,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { usePaginatedProjects } from "@/hooks/usePaginatedProjects";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ProjectAtlas } from "@/components/atlas/ProjectAtlas";
import {
  EASE_PREMIUM,
  TYPE_EYEBROW,
  TYPE_META,
  RADIUS,
  SHADOW_LIFT,
} from "@/lib/design-system";

type Mode = "grid" | "atlas" | "theater";

const MODE_TABS: Array<{ id: Mode; label: string; Icon: typeof Folder }> = [
  { id: "grid",    label: "Grid",    Icon: Folder },
  { id: "atlas",   label: "Atlas",   Icon: Telescope },
  { id: "theater", label: "Theater", Icon: TheaterIcon },
];

export default function Library() {
  usePageMeta({
    title: "Library — Small Bridges",
    description: "Every film you've directed, in one room.",
  });

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const reducedMotion = useReducedMotion();

  const mode: Mode = (params.get("mode") as Mode) || "grid";
  const setMode = (m: Mode) => {
    const next = new URLSearchParams(params);
    if (m === "grid") next.delete("mode");
    else next.set("mode", m);
    setParams(next, { replace: true });
  };

  const [search, setSearch] = useState("");
  const [sortBy] = useState("updated_at");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter] = useState<string>("all");

  const { projects, loading, hasMore, loadMore } = usePaginatedProjects(
    sortBy,
    sortOrder,
    statusFilter,
    search,
  );

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

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "library"],
            timecode: `${counts.total} ${counts.total === 1 ? "FILM" : "FILMS"} · ${counts.inProgress} ACTIVE`,
          }}
        >
          {/* ── Header row ──────────────────────────────────────── */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <EditorialEyebrow>Library</EditorialEyebrow>
              <EditorialHeadline className="mt-5">
                Your films.
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Every reel you&rsquo;ve directed lives here. Search, sort, and
                open them with one click. Pull up the Atlas to see them in
                3D, or the Theater to schedule a premiere.
              </p>
            </div>

            <button
              onClick={() => navigate("/studio?new=1")}
              className={cn(
                "group inline-flex items-center gap-2 px-5 py-3",
                RADIUS.chip,
                "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5",
                "text-foreground transition-all hover:border-accent/60 hover:from-accent/25",
              )}
            >
              <Plus className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span className="text-[13px]">New film</span>
              <span className={cn(TYPE_META, "text-muted-foreground/45 group-hover:text-accent/80")}>
                ⌘ N
              </span>
            </button>
          </div>

          {/* ── Mode tabs ──────────────────────────────────────── */}
          <div className="mt-10 flex items-center justify-between gap-6 border-b border-border/30 pb-5">
            <div className="flex items-center gap-8">
              {MODE_TABS.map(({ id, label, Icon }) => {
                const active = mode === id;
                return (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    className={cn(
                      "relative inline-flex items-center gap-2 pb-4 text-[12px] uppercase tracking-[0.18em] transition-colors",
                      active ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground/90",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 transition-colors",
                        active ? "text-accent" : "text-muted-foreground/50",
                      )}
                      strokeWidth={1.5}
                    />
                    <span>{label}</span>
                    {active && (
                      <motion.span
                        layoutId="library-mode-underline"
                        className="absolute -bottom-[21px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="hidden items-center gap-2.5 rounded-full border border-border/40 bg-[hsl(var(--foreground)/0.02)] px-3.5 h-9 sm:flex w-[280px]">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a film…"
                className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          {/* ── Content ────────────────────────────────────────── */}
          <div className="mt-10">
            <AnimatePresence mode="wait">
              {mode === "grid" && (
                <motion.div
                  key="grid"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_PREMIUM }}
                >
                  {loading && projects.length === 0 ? (
                    <LoadingState />
                  ) : projects.length === 0 ? (
                    <EmptyLibrary onNew={() => navigate("/studio?new=1")} />
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {projects.map((p, i) => (
                          <ProjectCard
                            key={p.id}
                            project={p}
                            index={i}
                            onOpen={() => navigate(`/r/${p.id}`)}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <div className="mt-10 flex justify-center">
                          <button
                            onClick={loadMore}
                            disabled={loading}
                            className={cn(
                              "rounded-full border border-border/40 px-5 py-2.5 text-[12px] uppercase tracking-[0.2em]",
                              "text-muted-foreground/70 transition-colors",
                              "hover:border-accent/40 hover:text-foreground",
                              "disabled:opacity-50",
                            )}
                          >
                            {loading ? "Loading…" : "Load more"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {mode === "atlas" && (
                <motion.div
                  key="atlas"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_PREMIUM }}
                  className="relative min-h-[60vh]"
                >
                  <ProjectAtlas
                    open={true}
                    onClose={() => setMode("grid")}
                    projects={projects.map((p) => ({
                      id: p.id,
                      title: p.name ?? null,
                      updated_at: p.updated_at,
                      thumbnail_url: (p as { thumbnail_url?: string | null }).thumbnail_url ?? null,
                    }))}
                  />
                </motion.div>
              )}

              {mode === "theater" && (
                <motion.div
                  key="theater"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_PREMIUM }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <TheaterIcon className="h-12 w-12 text-accent/60 mb-6" strokeWidth={1.2} />
                  <p className="font-display italic text-2xl text-foreground/85">
                    Theater — coming online.
                  </p>
                  <p className="mt-2 max-w-md text-[13px] text-muted-foreground/65">
                    Schedule a premiere, invite friends, watch together with
                    sync&apos;d playback. Wires in next pass.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </EditorialCanvas>
      </div>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectCard
// ─────────────────────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  index,
  onOpen,
}: {
  project: { id: string; name?: string | null; status?: string | null; updated_at?: string; final_video_url?: string | null; thumbnail_url?: string | null };
  index: number;
  onOpen: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const title = project.name?.trim() || "Untitled film";
  const status = project.status ?? "idle";
  const inProgress = status === "generating" || status === "rendering" || status === "stitching";
  const completed = status === "completed";

  return (
    <motion.button
      onClick={onOpen}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.6), ease: EASE_PREMIUM }}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      className={cn(
        "group/card relative overflow-hidden text-left",
        RADIUS.composer,
        "border border-border/40",
        "bg-gradient-to-b from-card/50 via-card/20 to-card/5",
        "backdrop-blur-xl",
        "transition-all hover:border-accent/40",
        SHADOW_LIFT,
      )}
    >
      {/* Thumbnail / placeholder */}
      <div className="relative aspect-video w-full overflow-hidden bg-[hsl(220_30%_8%)]">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-10 w-10 text-muted-foreground/25" strokeWidth={1} />
          </div>
        )}
        {/* Vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.85)] via-transparent to-transparent"
        />
        {/* Status pill */}
        <div className="absolute left-3 top-3">
          <StatusPill inProgress={inProgress} completed={completed} />
        </div>
        {/* Play affordance — only on completed */}
        {completed && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/card:opacity-100">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                "bg-[hsl(var(--accent)/0.2)] ring-1 ring-inset ring-accent/40",
                "backdrop-blur-md",
              )}
            >
              <Play className="h-4 w-4 fill-current text-accent" />
            </div>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 flex-1 font-display text-[16px] font-light leading-snug tracking-tight text-foreground">
            {title}
          </h3>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <Clock className="h-3 w-3 text-muted-foreground/40" strokeWidth={1.5} />
          <span className={cn(TYPE_META, "text-muted-foreground/55")}>
            {project.updated_at ? relativeTime(project.updated_at) : "Just now"}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function StatusPill({ inProgress, completed }: { inProgress: boolean; completed: boolean }) {
  if (inProgress) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
          "bg-[hsl(38_95%_55%/0.18)] ring-1 ring-inset ring-[hsl(38_95%_55%/0.4)] backdrop-blur-md",
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
          "bg-[hsl(150_75%_45%/0.16)] ring-1 ring-inset ring-[hsl(150_75%_45%/0.35)] backdrop-blur-md",
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
        "bg-[hsl(220_30%_25%/0.4)] ring-1 ring-inset ring-border/40 backdrop-blur-md",
        TYPE_META,
        "text-muted-foreground/75",
      )}
    >
      draft
    </span>
  );
}

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
          "ring-1 ring-inset ring-accent/20",
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
          "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5",
          "transition-all hover:border-accent/60 hover:from-accent/25",
        )}
      >
        <Plus className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span className="text-[13px]">Open the Studio</span>
      </button>
    </div>
  );
}

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
