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
 * Commentary + Watch Party: both wire into the matched `published_reels`
 * row for this project (lookup by project_id). Owners can record
 * commentary or schedule a party; guests get playback + the synced
 * sidebar when arriving via ?party=:id.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
} from "@/components/foundation/EditorialCanvas";
import {
  BrandedVideoPlayer,
  type BrandedVideoHandle,
} from "@/components/intro/BrandedVideoPlayer";
import { VideoReactionsBar, VideoCommentsSection } from "@/components/social";
import { DirectorCommentaryTrack } from "@/components/theater/DirectorCommentaryTrack";
import { DirectorCommentaryRecorder } from "@/components/theater/DirectorCommentaryRecorder";
import { WatchParty } from "@/components/theater/WatchParty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
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

interface PublishedReelLink {
  id: string;
  is_taken_down: boolean;
}

interface PartyMeta {
  id: string;
  host_id: string;
  status: string;
}

export default function Reel() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const liveRenderTimecode = useLiveRenderTimecode();

  const [reel, setReel] = useState<ReelData | null>(null);
  const [publishedReel, setPublishedReel] = useState<PublishedReelLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sheet state — Commentary recorder, Watch Party launcher.
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [partySheetOpen, setPartySheetOpen] = useState(false);
  const [partyBusy, setPartyBusy] = useState(false);

  // The underlying <video> handle that DirectorCommentaryTrack + WatchParty
  // need. BrandedVideoPlayer exposes .el(); we proxy that through a
  // pass-through ref so React's RefObject contract is honored.
  const videoHandleRef = useRef<BrandedVideoHandle>(null);
  const videoElRef = useMemo<React.RefObject<HTMLVideoElement>>(() => ({
    get current() {
      return videoHandleRef.current?.el() ?? null;
    },
    // Setter is required to satisfy React.RefObject's mutable shape; the
    // dependent components never assign back to it.
    set current(_v) { /* read-only proxy */ },
  }), []);

  // Watch-party context from URL.
  const partyId = params.get("party");
  const [party, setParty] = useState<PartyMeta | null>(null);

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
        // Fetch creator + the matched published_reel (for Commentary +
        // Watch Party) in parallel. Both are RLS-safe.
        const [creatorRes, pubRes] = await Promise.all([
          supabase
            .from("profiles_public")
            .select("id, display_name, avatar_url")
            .eq("id", data.user_id)
            .maybeSingle(),
          supabase
            .from("published_reels")
            .select("id, is_taken_down")
            .eq("project_id", data.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (!cancelled) {
          setReel({ ...data, creator: creatorRes.data ?? undefined });
          setPublishedReel(
            pubRes.data && !pubRes.data.is_taken_down
              ? (pubRes.data as PublishedReelLink)
              : null,
          );
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

  // ── Load the watch party (if URL carries ?party=:id) ─────────────
  useEffect(() => {
    if (!partyId) { setParty(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("watch_parties")
        .select("id, host_id, status")
        .eq("id", partyId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        toast.error("Watch party not found.");
        // Strip the param so we don't keep retrying.
        const next = new URLSearchParams(params);
        next.delete("party");
        setParams(next, { replace: true });
        return;
      }
      setParty(data as PartyMeta);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

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

  // ── Commentary action ────────────────────────────────────────────
  // Owners get the recorder. Guests get a hint if no commentary is
  // available; the inline DirectorCommentaryTrack button handles
  // playback toggle when one does exist.
  const handleCommentary = () => {
    if (!isOwner) {
      toast.info("Look for the Director button below the player to toggle commentary.");
      return;
    }
    if (!publishedReel) {
      toast.info("Publish your reel first — commentary attaches to the public copy.");
      return;
    }
    setRecorderOpen(true);
  };

  // ── Watch Party action ───────────────────────────────────────────
  // Owners schedule a party (now) and the URL gains ?party=:id so the
  // synced sidebar mounts. Guests prompted to ask the host for a link.
  const handleWatchParty = async () => {
    if (!user) {
      toast.error("Sign in to join a watch party.");
      return;
    }
    if (!publishedReel) {
      toast.info(
        isOwner
          ? "Publish your reel first — watch parties require a public copy."
          : "This reel isn't published yet.",
      );
      return;
    }
    // Already inside a party — just open the sheet for the share URL.
    if (partyId) {
      setPartySheetOpen(true);
      return;
    }
    if (!isOwner) {
      toast.info("Ask the director to share a watch-party link.");
      return;
    }
    setPartyBusy(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc(
        "schedule_watch_party" as never,
        {
          p_reel_id: publishedReel.id,
          p_scheduled_at: new Date().toISOString(),
          p_title: reel?.title ?? null,
          p_is_public: reel?.is_public ?? true,
          p_invitee_ids: [],
        } as never,
      );
      if (rpcErr) throw rpcErr;
      const newPartyId = data as unknown as string;
      const next = new URLSearchParams(params);
      next.set("party", newPartyId);
      setParams(next, { replace: false });
      toast.success("Watch party started — share the URL with your guests.");
      setPartySheetOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the party.");
    } finally {
      setPartyBusy(false);
    }
  };

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
      {/* Ambient backdrop — Apple TV+ pattern. The film's thumbnail is
          blurred and saturated into a full-bleed wash so the room takes
          on the film's lighting. Sits behind SpineBackdrop's blooms;
          a deep gradient pulls it back down to readable contrast. */}
      {reel.thumbnail_url && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-[5]"
            style={{
              backgroundImage: `url(${reel.thumbnail_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(80px) saturate(1.35)",
              opacity: 0.32,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-[4]"
            style={{
              background:
                "linear-gradient(to bottom, hsl(220 30% 4% / 0.85) 0%, hsl(220 30% 4% / 0.55) 40%, hsl(220 30% 4% / 0.92) 100%)",
            }}
          />
        </>
      )}

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
            timecode:
              liveRenderTimecode ??
              (meta.age ? `· ${meta.age.toUpperCase()}` : undefined),
          }}
          bodyClassName="!p-0"
        >
          <div className="aspect-video w-full overflow-hidden bg-black">
            {reel.video_url ? (
              <BrandedVideoPlayer
                ref={videoHandleRef}
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
              onClick={handleCommentary}
              Icon={Mic}
              label="Commentary"
            />
            <ActionPill
              onClick={() => void handleWatchParty()}
              Icon={partyBusy ? Loader2 : Tv}
              label={partyId ? "Party live" : "Watch Party"}
              tone="accent"
            />
          </div>
        </motion.div>

        {/* ── Commentary: inline toggle (only renders if a commentary
            exists for this published_reel). ─────────────────────── */}
        {publishedReel && (
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_PREMIUM, delay: 0.18 }}
            className="mt-5 flex items-center gap-3"
          >
            <DirectorCommentaryTrack
              reelId={publishedReel.id}
              videoRef={videoElRef}
            />
          </motion.div>
        )}

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

      {/* ── Watch Party sidebar — mounts whenever ?party=:id is set
          and the party row was successfully fetched. Owns the chat +
          sync. The host's video controls drive everyone else. ──── */}
      {party && (
        <WatchParty
          partyId={party.id}
          hostId={party.host_id}
          videoRef={videoElRef}
        />
      )}

      {/* ── Commentary recorder sheet — owner-only. ─────────────── */}
      <Sheet open={recorderOpen} onOpenChange={setRecorderOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-light italic">
              Director's commentary
            </SheetTitle>
            <SheetDescription>
              Record a voice track that viewers can toggle on. Up to five
              minutes; saved alongside the public copy of your reel.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {publishedReel && (
              <DirectorCommentaryRecorder
                reelId={publishedReel.id}
                onDone={() => setRecorderOpen(false)}
              />
            )}
            <p className={cn(TYPE_META, "mt-4 text-muted-foreground/55")}>
              Viewers see a "Director" toggle below the player. Toggling on
              mutes the reel and plays your commentary on top, seek-synced.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Watch Party share-URL sheet — appears after host schedules. */}
      <Sheet open={partySheetOpen} onOpenChange={setPartySheetOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-light italic">
              Your watch party is live
            </SheetTitle>
            <SheetDescription>
              Share this link. Anyone who opens it joins your synced session.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-3">
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl",
                "border border-border/40 bg-[hsl(var(--foreground)/0.03)] px-4 py-3",
              )}
            >
              <code className="truncate text-[13px] text-foreground/85">
                {`${window.location.origin}/r/${reel.id}?party=${partyId ?? ""}`}
              </code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/r/${reel.id}?party=${partyId ?? ""}`,
                  );
                  toast.success("Link copied");
                }}
                className={cn(
                  "shrink-0 rounded-full border border-accent/40 bg-[hsl(var(--accent)/0.08)]",
                  "px-3 py-1.5 text-[12px] text-foreground",
                  "transition-colors hover:bg-[hsl(var(--accent)/0.16)]",
                )}
              >
                <Sparkles className="mr-1 inline h-3 w-3 text-accent" />
                Copy
              </button>
            </div>
            <p className={cn(TYPE_META, "text-muted-foreground/55")}>
              The chat lives in the sidebar. Your playback is broadcast every
              second to everyone in the room.
            </p>
          </div>
        </SheetContent>
      </Sheet>
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
