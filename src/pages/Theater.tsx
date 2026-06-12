/**
 * Theater — /watch/:id
 *
 * Cinematic single-video page. Apple-TV-grade hero with ambient backdrop
 * derived from the thumbnail, action rail (Like · Remix · Tip · Share ·
 * Follow), credits panel with Director's Notes overlay toggle, and a
 * "Up next" rail of neighbour reels for endless watching.
 *
 * Data: single `theater_payload` RPC roundtrip. Plays are tracked via the
 * `track_reel_play` RPC on watch start and at intervals so the lobby
 * algorithm has accurate counters.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Heart, Wand2, Coins, Share2, Eye, UserPlus, UserCheck, ArrowRight,
  Sparkles, Film, Download, Loader2,
} from "lucide-react";
import { useSeamlessStitch } from "@/hooks/useSeamlessStitch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { BranchChoice, type Branch } from "@/components/theater/BranchChoice";
import { ReactionRail } from "@/components/theater/ReactionRail";
import { ReelComments } from "@/components/theater/ReelComments";
import { BrandedVideoPlayer, type BrandedVideoHandle } from "@/components/intro/BrandedVideoPlayer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReelRow {
  id: string;
  project_id: string;
  creator_id: string;
  title: string;
  synopsis: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  world_slug: string | null;
  universe_id: string | null;
  tags: string[];
  prompt_snapshot: string | null;
  director_notes: string | null;
  play_count: number;
  like_count: number;
  remix_count: number;
  tip_credits: number;
  created_at: string;
}
interface CreatorRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
}
interface NeighbourRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  world_slug: string | null;
  play_count: number;
}
interface TheaterPayload {
  reel: ReelRow;
  creator: CreatorRow;
  neighbours: NeighbourRow[];
  viewer_liked: boolean;
  is_following_creator: boolean;
}

export default function Theater() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [payload, setPayload] = useState<TheaterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(25);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchVote, setBranchVote] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [showTipPanel, setShowTipPanel] = useState(false);
  const { stitchAndDownload, stitching: downloading } = useSeamlessStitch();
  const videoRef = useRef<BrandedVideoHandle>(null);
  const v = () => videoRef.current?.el() ?? null;
  const playTrackedRef = useRef(false);

  usePageMeta({
    title: payload?.reel.title ? `${payload.reel.title} — Small Bridges Theater` : "Theater — Small Bridges",
    description: payload?.reel.synopsis ?? "Watch and remix cinematic AI reels.",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("theater_payload" as never, { p_reel_id: id } as never);
      if (error) throw error;
      setPayload(data as unknown as TheaterPayload);
      // Branches load in parallel; non-fatal if the migration isn't pushed.
      try {
        const { data: branchData } = await supabase.rpc("get_reel_branches" as never, { p_reel_id: id } as never);
        const bundle = branchData as unknown as { branches?: Branch[]; my_vote?: string | null } | null;
        setBranches(bundle?.branches ?? []);
        setBranchVote(bundle?.my_vote ?? null);
      } catch {
        setBranches([]); setBranchVote(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load reel");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Track a "view" once playback starts.
  const onPlay = useCallback(() => {
    if (playTrackedRef.current || !id) return;
    playTrackedRef.current = true;
    void supabase.rpc("track_reel_play" as never, {
      p_reel_id: id, p_watched_sec: null, p_completed: false,
    } as never);
  }, [id]);

  // On end, track completion. If the reel has branches, open the choice
  // overlay instead of auto-advancing — viewer steers the story.
  const onEnded = useCallback(() => {
    if (!id) return;
    void supabase.rpc("track_reel_play" as never, {
      p_reel_id: id,
      p_watched_sec: v()?.duration ? Math.round(v()!.duration) : null,
      p_completed: true,
    } as never);
    if (branches.length > 0) {
      setBranchOpen(true);
      return;
    }
    const next = payload?.neighbours?.[0];
    if (next) {
      setTimeout(() => navigate(`/watch/${next.id}`), 1500);
    }
  }, [id, payload?.neighbours, navigate, branches.length]);

  const toggleLike = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!payload) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like_reel" as never, { p_reel_id: payload.reel.id } as never);
      if (error) throw error;
      const out = data as unknown as { liked: boolean; like_count: number };
      setPayload({
        ...payload,
        viewer_liked: out.liked,
        reel: { ...payload.reel, like_count: out.like_count },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't like");
    }
  };

  const toggleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!payload) return;
    try {
      const { data, error } = await supabase.rpc("toggle_follow" as never, { p_target: payload.creator.id } as never);
      if (error) throw error;
      const out = data as unknown as { following: boolean };
      setPayload({ ...payload, is_following_creator: out.following });
      toast.success(out.following ? "Following" : "Unfollowed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow failed");
    }
  };

  const remix = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!payload) return;
    try {
      const { data, error } = await supabase.rpc("remix_reel" as never, { p_reel_id: payload.reel.id } as never);
      if (error) throw error;
      const out = data as unknown as { new_project_id: string };
      toast.success("Remix project created — opening editor");
      navigate(`/editor/${out.new_project_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remix failed");
    }
  };

  const tip = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!payload) return;
    setTipping(true);
    try {
      const { error } = await supabase.rpc("tip_reel" as never, {
        p_reel_id: payload.reel.id, p_credits: tipAmount,
      } as never);
      if (error) throw error;
      toast.success(`Tipped ${tipAmount} credits — creator received ${Math.floor(tipAmount * 0.9)}`);
      setShowTipPanel(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tip failed");
    } finally {
      setTipping(false);
    }
  };

  const share = async () => {
    try {
      const url = `${window.location.origin}/watch/${id}`;
      if (navigator.share) {
        await navigator.share({ title: payload?.reel.title ?? "Small Bridges reel", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora intensity="subtle" />
      <PageShell width="gallery" pad>
      {loading || !payload ? (
        <div className="min-h-screen flex items-center justify-center text-white/55 gap-3">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading theater…</span>
        </div>
      ) : (
        <>
          {/* AMBIENT BACKDROP — blurred thumbnail provides the room lighting */}
          <div
            aria-hidden
            className="fixed inset-0 -z-10 pointer-events-none"
            style={{
              backgroundImage: payload.reel.thumbnail_url ? `url(${payload.reel.thumbnail_url})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(80px) saturate(1.3)",
              opacity: 0.35,
            }}
          />
          <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-[#040506]/95 via-[#040506]/70 to-[#040506]" />

          <div className="pt-2">
            {/* HERO — the video itself */}
            <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] mb-6">
              {/* Branch overlay — sits above the video */}
              <BranchChoice
                branches={branches}
                myVote={branchVote}
                open={branchOpen}
                onClose={() => setBranchOpen(false)}
              />
              {/* When branches exist, surface a small "branches" pip */}
              {branches.length > 0 && !branchOpen && (
                <button
                  onClick={() => setBranchOpen(true)}
                  className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.10] hover:border-primary/40 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 hover:text-white transition-colors"
                >
                  ◆ {branches.length} branch{branches.length === 1 ? "" : "es"}
                </button>
              )}
              <div className="relative aspect-video bg-black">
                <BrandedVideoPlayer
                  ref={videoRef}
                  src={payload.reel.video_url}
                  poster={payload.reel.thumbnail_url ?? undefined}
                  playerKey={`reel:${payload.reel.id}`}
                  title={payload.reel.title}
                  // Watch surface — the brand intro played at session start
                  // already. Replaying it on every reel makes the player
                  // feel broken: the 7.5s overlay blocks the video and
                  // browser-blocked autoplay can leave the user stuck.
                  skipIntro
                  autoPlay
                  playsInline
                  onPlay={onPlay}
                  onEnded={onEnded}
                  className="absolute inset-0 w-full h-full"
                  objectFit="contain"
                />
              </div>
            </div>

            {/* REACTION RAIL — video reactions stitched to this reel */}
            <ReactionRail reelId={payload.reel.id} />

            {/* TITLE + ACTION RAIL */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10 mb-12">
              {/* Left — title, synopsis, creator */}
              <div>
                <h1
                  className="font-display font-light text-[34px] lg:text-[52px] leading-[1.05] text-white tracking-tight"
                >
                  {payload.reel.title}
                </h1>
                {payload.reel.synopsis && (
                  <p className="text-white/65 text-[15px] mt-5 leading-relaxed max-w-2xl">{payload.reel.synopsis}</p>
                )}
                <div className="mt-6 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.22em] text-white/45">
                  <span className="inline-flex items-center gap-1.5"><Eye className="w-3 h-3" />{payload.reel.play_count.toLocaleString()} plays</span>
                  <span className="inline-flex items-center gap-1.5"><Heart className="w-3 h-3" />{payload.reel.like_count.toLocaleString()} likes</span>
                  <span className="inline-flex items-center gap-1.5"><Wand2 className="w-3 h-3" />{payload.reel.remix_count.toLocaleString()} remixes</span>
                  {payload.reel.tip_credits > 0 && (
                    <span className="inline-flex items-center gap-1.5"><Coins className="w-3 h-3" />{payload.reel.tip_credits.toLocaleString()} cr tipped</span>
                  )}
                </div>

                {/* Creator card */}
                <div className="mt-8 flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-glass">
                  <Link to={`/c/${payload.creator.id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                    {payload.creator.avatar_url ? (
                      <img
                        src={payload.creator.avatar_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border border-white/[0.08] group-hover:border-white/30 transition-colors"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-glass-hover border border-white/[0.08] flex items-center justify-center text-white/55 font-mono group-hover:border-white/30 transition-colors">
                        {(payload.creator.display_name?.[0] || "?").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[14px] text-white truncate group-hover:underline underline-offset-2">{payload.creator.display_name || "Anonymous director"}</div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
                        {payload.creator.follower_count.toLocaleString()} followers
                      </div>
                    </div>
                  </Link>
                  {user && payload.creator.id !== user.id && (
                    <button
                      onClick={toggleFollow}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-4 rounded-full border text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
                        payload.is_following_creator
                          ? "border-white/15 text-white/75 hover:border-rose-300/40 hover:text-rose-200"
                          : "border-white/30 text-white hover:bg-white/10",
                      )}
                    >
                      {payload.is_following_creator ? (
                        <><UserCheck className="w-3 h-3" />Following</>
                      ) : (
                        <><UserPlus className="w-3 h-3" />Follow</>
                      )}
                    </button>
                  )}
                </div>

                {/* DIRECTOR'S NOTES — toggle */}
                {(payload.reel.director_notes || payload.reel.prompt_snapshot) && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowNotes((s) => !s)}
                      className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/55 hover:text-white transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      {showNotes ? "Hide director's notes" : "Show director's notes"}
                    </button>
                    {showNotes && (
                      <div className="mt-3 p-5 rounded-2xl border border-white/[0.06] bg-glass">
                        {payload.reel.prompt_snapshot && (
                          <>
                            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/40 mb-2">Prompt</div>
                            <p className="text-[13px] text-white/75 leading-relaxed mb-4">{payload.reel.prompt_snapshot}</p>
                          </>
                        )}
                        {payload.reel.director_notes && (
                          <>
                            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/40 mb-2">Notes from the director</div>
                            <p className="text-[13px] text-white/75 leading-relaxed">{payload.reel.director_notes}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right — action rail */}
              <aside className="space-y-3">
                <ActionRow icon={Heart} label={payload.viewer_liked ? "Liked" : "Like"} onClick={toggleLike} active={payload.viewer_liked} accent="rose" />
                <ActionRow icon={Wand2} label="Remix" onClick={remix} accent="brand" hint="Clone to editor" />
                <ActionRow icon={Coins} label="Tip" onClick={() => setShowTipPanel((s) => !s)} accent="amber" hint="Send credits" />
                <ActionRow icon={Share2} label="Share" onClick={share} />
                <ActionRow
                  icon={downloading ? Loader2 : Download}
                  label={downloading ? "Stitching…" : "Download"}
                  hint="Crossfade + intro"
                  onClick={() => {
                    if (downloading) return;
                    void stitchAndDownload({
                      projectId: payload.reel.project_id,
                      title: payload.reel.title,
                      includeIntro: true,
                    });
                  }}
                  accent="brand"
                />
                {/* Save (bookmark) + Report are intentionally not shown until
                    they have real persistence behind them. See Domain 1
                    audit — both were stubs surfaced as primary actions. */}

                {showTipPanel && (
                  <div className="mt-3 p-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.04]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-amber-200 mb-2">Tip the creator</div>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {[10, 25, 100, 500].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTipAmount(n)}
                          className={cn(
                            "px-3 h-8 rounded-full border text-[11px] font-mono tabular-nums transition-colors",
                            tipAmount === n
                              ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                              : "border-white/[0.08] text-white/65 hover:border-white/20 hover:text-white",
                          )}
                        >
                          {n} cr
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={tip}
                      disabled={tipping}
                      className="w-full h-9 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-50"
                    >
                      {tipping ? "Sending…" : `Send ${tipAmount} credits`}
                    </button>
                    <div className="text-[10px] text-white/35 mt-2 font-mono">
                      {Math.floor(tipAmount * 0.9)} reaches the creator · 10% platform
                    </div>
                  </div>
                )}
              </aside>
            </div>

            {/* COMMENTS */}
            <ReelComments reelId={payload.reel.id} />

            {/* UP NEXT */}
            <div className="mb-6 flex items-center gap-3">
              <Film className="w-3.5 h-3.5 text-white/45" />
              <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-white/55">Up next</span>
              <div className="h-px flex-1 bg-glass-hover" />
              <Link to="/lobby" className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-white inline-flex items-center gap-1.5">
                Back to lobby <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {payload.neighbours.map((n) => (
                <Link
                  key={n.id}
                  to={`/watch/${n.id}`}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.015] hover:border-white/20 overflow-hidden transition-colors"
                >
                  <div className="aspect-video bg-black/40 relative">
                    {n.thumbnail_url && (
                      <img src={n.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/60 text-white/85">
                      {n.play_count.toLocaleString()} ▸
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[11px] text-white truncate">{n.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
      </PageShell>
    </div>
  );
}

function ActionRow({
  icon: Icon, label, onClick, active, accent, hint,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: "rose" | "brand" | "amber";
  hint?: string;
}) {
  const accentClass = active
    ? accent === "rose"
      ? "border-rose-300/40 bg-rose-400/[0.08] text-rose-200"
      : accent === "amber"
        ? "border-amber-300/40 bg-amber-400/[0.08] text-amber-200"
        : "border-primary/40 bg-primary/[0.08] text-primary/80"
    : "border-white/[0.06] bg-white/[0.015] hover:border-white/20 hover:bg-glass-hover text-white/75 hover:text-white";
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors text-left",
        accentClass,
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px]">{label}</div>
        {hint && <div className="text-[10px] text-white/40 font-mono">{hint}</div>}
      </div>
      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
