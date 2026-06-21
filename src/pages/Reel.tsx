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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Send,
  Download,
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
import { TimelinePlayer, type PlayerClip } from "@/components/player/TimelinePlayer";
import { clipVisual } from "@/lib/editor/clip-css";
import { getClipProperty, type EditorClip } from "@/lib/editor/types";
import { PublishWizard } from "@/components/publish/PublishWizard";
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

// ── Free render-less timeline ────────────────────────────────────────
// Reconstruct the editor's clip list (saved arrangement first, then raw
// rows) and map each clip to a PlayerClip with its effects baked into
// CSS, so the watch page can sequence the whole edit in the browser.
function rowToEditorClip(
  r: { id: string; video_url: string | null; duration_seconds: number | null; start_image_url: string | null; properties: unknown; effects: unknown },
  i: number,
): EditorClip {
  const rawProps = r.properties && typeof r.properties === "object"
    ? (r.properties as Record<string, unknown>)
    : null;
  let keyframes: EditorClip["keyframes"];
  let properties: EditorClip["properties"];
  if (rawProps) {
    const { keyframes: kf, ...rest } = rawProps;
    if (Array.isArray(kf)) keyframes = kf as EditorClip["keyframes"];
    properties = Object.keys(rest).length > 0 ? (rest as EditorClip["properties"]) : undefined;
  }
  return {
    id: r.id,
    index: i,
    timelineStartSec: 0,
    durationSec: r.duration_seconds ?? 4,
    videoUrl: r.video_url,
    thumbnailUrl: r.start_image_url,
    prompt: "",
    takes: [],
    properties,
    effects: Array.isArray(r.effects) ? (r.effects as EditorClip["effects"]) : undefined,
    keyframes,
  };
}

function toPlayerClip(clip: EditorClip): PlayerClip | null {
  if (clip.kind === "title") return null;
  if (!clip.videoUrl) return null;
  const v = clipVisual(clip);
  return {
    id: clip.id,
    videoUrl: clip.videoUrl,
    durationSec: clip.durationSec || 4,
    filter: v.filter,
    transform: v.transform,
    opacity: v.opacity,
    speed: getClipProperty(clip, "speed"),
    muted: getClipProperty(clip, "muted"),
    volume: getClipProperty(clip, "volume"),
  };
}

async function buildTimelineClips(
  projectId: string,
  editorState: unknown,
): Promise<PlayerClip[]> {
  try {
    const es = editorState && typeof editorState === "object"
      ? (editorState as { clips?: unknown })
      : null;
    const restored = es && Array.isArray(es.clips) && es.clips.length > 0
      ? (es.clips as EditorClip[])
      : null;

    let editorClips: EditorClip[];
    if (restored) {
      editorClips = restored;
    } else {
      const { data: rows } = await supabase
        .from("video_clips")
        .select("id, video_url, duration_seconds, start_image_url, properties, effects, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      editorClips = (rows ?? [])
        .filter((r) => typeof r.video_url === "string" && r.video_url.length > 0)
        .map((r, i) => rowToEditorClip(r as Parameters<typeof rowToEditorClip>[0], i));
    }
    return editorClips.map(toPlayerClip).filter((c): c is PlayerClip => c !== null);
  } catch {
    return [];
  }
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
  // The edited timeline played for FREE (no render): all clips in
  // sequence with their effects applied live. Empty → single-file path.
  const [timelineClips, setTimelineClips] = useState<PlayerClip[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sheet state — Commentary recorder, Watch Party launcher, Publish.
  const [publishOpen, setPublishOpen] = useState(false);
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
        const PROJECT_COLS =
          "id, title, video_url, thumbnail_url, created_at, updated_at, user_id, is_public, likes_count, pending_video_tasks, editor_state";
        const initialRes = await supabase
          .from("movie_projects")
          .select(PROJECT_COLS)
          .eq("id", id)
          .maybeSingle();
        if (initialRes.error) throw initialRes.error;
        let data = initialRes.data;

        // The URL id may be a published_reels.id rather than a
        // movie_projects.id — most discovery surfaces (Profile grid,
        // Search, the post-publish redirect) link with the published id.
        // Resolve it to the source project and treat it as public, since
        // a live published reel is public by definition.
        let viaPublishedReel = false;
        if (!data) {
          const { data: pub } = await supabase
            .from("published_reels")
            .select("project_id, is_taken_down")
            .eq("id", id)
            .maybeSingle();
          if (pub?.project_id && !pub.is_taken_down) {
            viaPublishedReel = true;
            const reReg = await supabase
              .from("movie_projects")
              .select(PROJECT_COLS)
              .eq("id", pub.project_id)
              .maybeSingle();
            data = reReg.data;
          }
        }

        if (!data) {
          if (!cancelled) setError("not_found");
          return;
        }
        // Fallback resolution — same pattern usePaginatedProjects uses
        // (mapDbProjectToProject). If movie_projects.video_url is null
        // but pending_video_tasks carries an HLS playlist or manifest
        // URL (from an in-flight render), use it so the player can
        // show the partial-stream preview instead of "Still rendering…".
        if (!data.video_url) {
          const pt = (data as { pending_video_tasks?: { hlsPlaylistUrl?: string; manifestUrl?: string } }).pending_video_tasks;
          if (pt?.hlsPlaylistUrl) data.video_url = pt.hlsPlaylistUrl;
          else if (pt?.manifestUrl) data.video_url = pt.manifestUrl;
        }
        // Owner can view their own private reels; otherwise must be
        // public — unless we arrived via a live published_reels row,
        // which is itself the public signal (publishing doesn't flip
        // movie_projects.is_public).
        if (!viaPublishedReel && !data.is_public && data.user_id !== user?.id) {
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
        // Build the FREE, render-less timeline: every clip in sequence
        // with its effects applied live. Source of truth is
        // editor_state.clips (the saved edit) when present; otherwise the
        // raw video_clips rows. Best-effort — failure just falls back to
        // the single-file player.
        const players = await buildTimelineClips(data.id, (data as { editor_state?: unknown }).editor_state);

        if (!cancelled) {
          setReel({ ...data, creator: creatorRes.data ?? undefined });
          setPublishedReel(
            pubRes.data && !pubRes.data.is_taken_down
              ? (pubRes.data as PublishedReelLink)
              : null,
          );
          setTimelineClips(players);
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

  // ── Download ─────────────────────────────────────────────────────
  // Fetch the video as a blob and save it. A plain <a download> on a
  // cross-origin URL is ignored by browsers (it just opens the file),
  // so we fetch → blob → object URL to force a real download.
  const handleDownload = async () => {
    if (!reel?.video_url || downloading) return;
    setDownloading(true);
    const toastId = toast.loading("Preparing download…");
    try {
      const res = await fetch(reel.video_url);
      if (!res.ok) throw new Error(`Couldn't fetch the video (${res.status})`);
      const blob = await res.blob();
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      const safeTitle =
        (reel.title || "small-bridges-reel")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "reel";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // Re-fetch the matched published_reel after publishing so Commentary +
  // Watch Party (which require a published copy) light up without a reload.
  const refetchPublished = useCallback(async () => {
    if (!reel?.id) return;
    const { data } = await supabase
      .from("published_reels")
      .select("id, is_taken_down")
      .eq("project_id", reel.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPublishedReel(data && !data.is_taken_down ? (data as PublishedReelLink) : null);
  }, [reel?.id]);

  // The Watch Party "Publish now" toast action dispatches this event;
  // open the wizard in response so that path actually works.
  useEffect(() => {
    const onOpen = () => setPublishOpen(true);
    window.addEventListener("openPublishWizard", onOpen as EventListener);
    return () => window.removeEventListener("openPublishWizard", onOpen as EventListener);
  }, []);

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
      // A watch party needs a public copy. For the owner, jump straight
      // into the Publish flow (don't auto-publish silently — let them
      // pick a world + tags first); guests just learn it isn't public.
      if (isOwner) {
        toast.info("Publish this reel to the Lobby first, then start a watch party.");
        setPublishOpen(true);
      } else {
        toast.info("This reel isn't published yet.");
      }
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
            {/* Multi-clip edit OR a single clip carrying effects → play
                the timeline for free in-browser (no render). A plain
                single clip keeps the BrandedVideoPlayer so commentary +
                watch-party stay wired to its video handle. */}
            {(timelineClips.length >= 2 ||
              (timelineClips.length === 1 &&
                !!(timelineClips[0].filter || timelineClips[0].transform || (timelineClips[0].opacity ?? 1) !== 1))) ? (
              <TimelinePlayer
                clips={timelineClips}
                poster={reel.thumbnail_url}
                autoPlay
                className="h-full w-full"
              />
            ) : reel.video_url ? (
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
                  to={`/c/${reel.creator.id}`}
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
            {reel.video_url && (
              <ActionPill
                onClick={() => void handleDownload()}
                Icon={downloading ? Loader2 : Download}
                label={downloading ? "Downloading…" : "Download"}
              />
            )}
            {isOwner && !publishedReel && (
              <ActionPill
                onClick={() => setPublishOpen(true)}
                Icon={Send}
                label="Publish to Lobby"
                tone="accent"
              />
            )}
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
          <VideoReactionsBar projectId={reel.id} />
        </motion.div>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.2 }}
          className="mt-8"
        >
          <VideoCommentsSection projectId={reel.id} />
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

      {/* ── Publish to Lobby — turns this project into a public reel. ── */}
      {isOwner && reel && (
        <PublishWizard
          open={publishOpen}
          projectId={reel.id}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            setPublishOpen(false);
            void refetchPublished();
          }}
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
