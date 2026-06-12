/**
 * Reel — /r/:id
 *
 * Canonical surface for watching a single film. Replaces /video/:id
 * and the various /watch endpoints. Built on the foundation:
 * FoundationShell + EditorialCanvas + glass action rail.
 *
 * Anatomy:
 *   - Breadcrumb back to Library
 *   - EditorialCanvas-wrapped video player
 *   - Title / creator / view-meta strip
 *   - Glass action rail: Share · Edit · Commentary · Watch Party
 *   - Reactions bar (existing primitive)
 *   - Comments thread (existing primitive)
 *
 * Watch Party + Commentary wire in via task #198. They're visible
 * here as buttons that open the underlying surfaces.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Share2,
  Pencil,
  Mic,
  Tv,
  Loader2,
  Calendar,
  Eye,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
} from "@/components/foundation/EditorialCanvas";
import { BrandedVideoPlayer } from "@/components/intro/BrandedVideoPlayer";
import { VideoReactionsBar, VideoCommentsSection } from "@/components/social";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSafeNavigation } from "@/lib/navigation";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  EASE_PREMIUM,
  TYPE_EYEBROW,
  TYPE_META,
  RADIUS,
} from "@/lib/design-system";

interface ReelData {
  id: string;
  title: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_public: boolean;
  likes_count: number | null;
  creator?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export default function Reel() {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();

  const [reel, setReel] = useState<ReelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: reel?.title
      ? `${reel.title} — Small Bridges`
      : "Reel — Small Bridges",
    description: "Watch a cinematic Small Bridges production.",
  });

  // ── Load the reel ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: e1 } = await supabase
          .from("movie_projects")
          .select(
            "id, title, video_url, thumbnail_url, created_at, updated_at, user_id, is_public, likes_count",
          )
          .eq("id", id)
          .maybeSingle();
        if (e1) throw e1;
        if (!data) {
          if (!cancelled) setError("not_found");
          return;
        }
        // Owner can view their own private reels; otherwise must be public.
        if (!data.is_public && data.user_id !== user?.id) {
          if (!cancelled) setError("private");
          return;
        }
        // Fetch creator from the public view (RLS-safe).
        const { data: creator } = await supabase
          .from("profiles_public")
          .select("id, display_name, avatar_url")
          .eq("id", data.user_id)
          .maybeSingle();
        if (!cancelled) {
          setReel({ ...data, creator: creator ?? undefined });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  const isOwner = !!user && reel?.user_id === user.id;

  const handleShare = async () => {
    if (!reel) return;
    const url = `${window.location.origin}/r/${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: reel.title || "A film on Small Bridges",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user dismissed */
    }
  };

  const meta = useMemo(() => {
    if (!reel) return { age: "", views: "" };
    const age = reel.created_at
      ? formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })
      : "";
    const views = reel.likes_count != null ? `${reel.likes_count} reactions` : "";
    return { age, views };
  }, [reel]);

  // ── Render branches ───────────────────────────────────────────────
  if (loading) {
    return (
      <FoundationShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-accent" strokeWidth={1.5} />
            <p className={cn(TYPE_EYEBROW, "text-muted-foreground/55")}>
              Loading the reel…
            </p>
          </div>
        </div>
      </FoundationShell>
    );
  }

  if (error || !reel) {
    return (
      <FoundationShell>
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <AlertCircle className="mx-auto mb-6 h-10 w-10 text-muted-foreground/40" strokeWidth={1.2} />
          <p className="font-display italic text-3xl text-foreground/85">
            {error === "private"
              ? "This reel is private."
              : "We couldn't find that film."}
          </p>
          <p className="mt-3 text-[14px] text-muted-foreground/65">
            {error === "private"
              ? "Only the director can view it."
              : "It may have been removed or the link is wrong."}
          </p>
          <button
            onClick={() => navigate("/library")}
            className={cn(
              "mt-8 inline-flex items-center gap-2 px-5 py-3",
              RADIUS.chip,
              "border border-border/40 text-foreground/85",
              "transition-colors hover:border-accent/40",
            )}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[13px]">Back to Library</span>
          </button>
        </div>
      </FoundationShell>
    );
  }

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
        {/* Back link */}
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_PREMIUM }}
        >
          <Link
            to="/library"
            className={cn(
              "inline-flex items-center gap-2 text-muted-foreground/65",
              "transition-colors hover:text-foreground",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className={cn(TYPE_EYEBROW, "text-current")}>Library</span>
          </Link>
        </motion.div>

        {/* Player canvas */}
        <EditorialCanvas
          className="mt-6"
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "reel", reel.id.slice(0, 8)],
            timecode: meta.age ? `· ${meta.age.toUpperCase()}` : undefined,
          }}
          bodyClassName="!p-0"
        >
          <div className="aspect-video w-full overflow-hidden bg-black">
            {reel.video_url ? (
              <BrandedVideoPlayer
                src={reel.video_url}
                poster={reel.thumbnail_url ?? undefined}
                autoPlay={false}
                controls
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-center text-muted-foreground/55">
                <div>
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-accent" />
                  <p className={cn(TYPE_EYEBROW, "text-current")}>
                    Still rendering…
                  </p>
                </div>
              </div>
            )}
          </div>
        </EditorialCanvas>

        {/* Title + creator + actions */}
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.1 }}
          className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
        >
          <div className="min-w-0 flex-1">
            <EditorialEyebrow>Now playing</EditorialEyebrow>
            <h1 className="mt-3 font-display text-3xl md:text-4xl font-light tracking-tight text-foreground">
              {reel.title || "Untitled film"}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground/65">
              {reel.creator && (
                <Link
                  to={`/u/${reel.creator.id}`}
                  className="group flex items-center gap-2.5 transition-colors hover:text-foreground"
                >
                  {reel.creator.avatar_url ? (
                    <img
                      src={reel.creator.avatar_url}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-inset ring-border/40"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-[hsl(var(--foreground)/0.06)] ring-1 ring-inset ring-border/40" />
                  )}
                  <span className="text-[13px]">
                    {reel.creator.display_name || "Anonymous"}
                  </span>
                </Link>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" strokeWidth={1.5} />
                <span className={cn(TYPE_META, "text-current")}>{meta.age}</span>
              </div>
              {meta.views && (
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3" strokeWidth={1.5} />
                  <span className={cn(TYPE_META, "text-current")}>{meta.views}</span>
                </div>
              )}
            </div>
          </div>

          {/* Glass action rail */}
          <div className="flex flex-wrap items-center gap-2">
            <ActionPill onClick={handleShare} Icon={Share2} label="Share" />
            {isOwner && (
              <ActionPill
                onClick={() => navigate(`/editor/${reel.id}`)}
                Icon={Pencil}
                label="Edit"
              />
            )}
            <ActionPill
              onClick={() => toast.info("Commentary coming online")}
              Icon={Mic}
              label="Commentary"
            />
            <ActionPill
              onClick={() => toast.info("Watch Party coming online")}
              Icon={Tv}
              label="Watch Party"
              tone="accent"
            />
          </div>
        </motion.div>

        {/* Reactions + comments */}
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.15 }}
          className="mt-10"
        >
          <VideoReactionsBar videoId={reel.id} />
        </motion.div>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.2 }}
          className="mt-8"
        >
          <VideoCommentsSection videoId={reel.id} />
        </motion.div>
      </div>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action pill
// ─────────────────────────────────────────────────────────────────────────────
function ActionPill({
  onClick,
  Icon,
  label,
  tone = "default",
}: {
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  tone?: "default" | "accent";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2.5",
        "border backdrop-blur-md transition-all",
        tone === "accent"
          ? "border-accent/40 bg-[hsl(var(--accent)/0.08)] hover:border-accent/60 hover:bg-[hsl(var(--accent)/0.15)]"
          : "border-border/40 bg-[hsl(var(--foreground)/0.02)] hover:border-accent/40 hover:bg-[hsl(var(--foreground)/0.04)]",
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", tone === "accent" ? "text-accent" : "text-muted-foreground/75")}
        strokeWidth={1.5}
      />
      <span className="text-[13px] text-foreground">{label}</span>
    </button>
  );
}
