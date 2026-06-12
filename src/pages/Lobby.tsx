/**
 * Lobby — /lobby
 *
 * The entertainment hub. Sits inside the standard Small Bridges AppShell + PageShell
 * so the workspace sidebar is always present and the visual identity
 * matches the Create page (StudioAurora backdrop, cinematic gradient hero,
 * glass-pill StudioTabs).
 *
 * Sections:
 *   • Hero — gradient title + today's prompt
 *   • Channel Worlds — premium glass tab strip
 *   • Featured rail — auto-playing video card spanning the page
 *   • Trending grid — masonry of public reels
 *   • Drafts shelf — viewer's unfinished work (signed-in only)
 *
 * When the DB is empty the page renders a curated demo set so the surface
 * never looks unfinished. Real reels replace demos the moment they're
 * published.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Heart, Wand2, Tv, ArrowRight, Eye, Clock, Flame, Calendar,
  Music2, ShoppingBag, Users as UsersIcon, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChannelWorld {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accent_hsl: string;
  glyph: string | null;
}

interface FeedRow {
  id: string;
  title: string;
  synopsis: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  world_slug: string | null;
  tags: string[];
  play_count: number;
  like_count: number;
  remix_count: number;
  is_featured: boolean;
  created_at: string;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
  world_name: string | null;
  world_accent: string | null;
  world_glyph: string | null;
}

interface DraftRow {
  id: string;
  title: string;
  status: string;
  thumbnail_url: string | null;
  updated_at: string;
}

interface DailyPrompt {
  prompt: { id: string; prompt_text: string; prompt_hint: string | null; world_slug: string | null; prompt_date: string };
  top_submissions: Array<{ reel_id: string; title: string; thumbnail_url: string | null; votes: number }>;
}

interface DailyChallengeRow {
  id: string;
  challenge_type: string;
  description: string;
  xp_reward: number;
  target_count: number;
  progress: number;
  completed: boolean;
}

const WORLDS_FALLBACK: ChannelWorld[] = [
  { id: "1", slug: "noir",   name: "Noir",          description: "Shadows, smoke, morally interesting people.", accent_hsl: "38 80% 60%",  glyph: "◐" },
  { id: "2", slug: "scifi",  name: "Sci-Fi",        description: "Tomorrow, today, the wires in between.",      accent_hsl: "213 100% 60%", glyph: "◊" },
  { id: "3", slug: "comedy", name: "Comedy",        description: "Quick wit, slow takes, hot soup.",            accent_hsl: "14 90% 60%",   glyph: "★" },
  { id: "4", slug: "docu",   name: "Documentary",   description: "Truth, shot like fiction.",                   accent_hsl: "160 60% 50%",  glyph: "◯" },
  { id: "5", slug: "music",  name: "Music videos",  description: "Three minutes that change a song.",           accent_hsl: "280 70% 65%",  glyph: "▲" },
  { id: "6", slug: "experi", name: "Experimental",  description: "Unfinished thoughts that finished themselves.", accent_hsl: "0 0% 70%",   glyph: "✦" },
];

// Curated demo reels used until the DB has real ones. Each card uses an
// `is_demo` flag so the UI can label them faintly and route them somewhere
// useful (lobby pre-explainer) instead of a broken /watch route.
const DEMO_REELS: FeedRow[] = [
  {
    id: "demo-1", title: "Stillwater · the cassette tape", synopsis: null, video_url: "",
    thumbnail_url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    duration_sec: 47, world_slug: "noir", tags: ["noir", "neon", "mystery"],
    play_count: 2841, like_count: 412, remix_count: 18, is_featured: true,
    created_at: new Date().toISOString(), creator_id: "demo-creator-1",
    creator_name: "Vela Reyes", creator_avatar: null, world_name: "Noir",
    world_accent: "38 80% 60%", world_glyph: "◐",
  },
  {
    id: "demo-2", title: "Ground control to Earl Grey", synopsis: null, video_url: "",
    thumbnail_url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80",
    duration_sec: 32, world_slug: "scifi", tags: ["scifi", "deepspace"],
    play_count: 1823, like_count: 276, remix_count: 11, is_featured: false,
    created_at: new Date().toISOString(), creator_id: "demo-creator-2",
    creator_name: "Iko Marvell", creator_avatar: null, world_name: "Sci-Fi",
    world_accent: "213 100% 60%", world_glyph: "◊",
  },
  {
    id: "demo-3", title: "Hot soup for one", synopsis: null, video_url: "",
    thumbnail_url: "https://images.unsplash.com/photo-1547573854-74d2a71d0826?auto=format&fit=crop&w=1200&q=80",
    duration_sec: 24, world_slug: "comedy", tags: ["comedy", "kitchen"],
    play_count: 4129, like_count: 893, remix_count: 42, is_featured: false,
    created_at: new Date().toISOString(), creator_id: "demo-creator-3",
    creator_name: "Theo Park", creator_avatar: null, world_name: "Comedy",
    world_accent: "14 90% 60%", world_glyph: "★",
  },
  {
    id: "demo-4", title: "The librarian who paints", synopsis: null, video_url: "",
    thumbnail_url: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80",
    duration_sec: 65, world_slug: "docu", tags: ["docu", "portrait"],
    play_count: 1208, like_count: 198, remix_count: 6, is_featured: false,
    created_at: new Date().toISOString(), creator_id: "demo-creator-4",
    creator_name: "Aiyana Wells", creator_avatar: null, world_name: "Documentary",
    world_accent: "160 60% 50%", world_glyph: "◯",
  },
  {
    id: "demo-5", title: "Lemon, neon, three breaths", synopsis: null, video_url: "",
    thumbnail_url: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=80",
    duration_sec: 38, world_slug: "music", tags: ["musicvideo"],
    play_count: 3245, like_count: 620, remix_count: 24, is_featured: false,
    created_at: new Date().toISOString(), creator_id: "demo-creator-5",
    creator_name: "Cassia Roe", creator_avatar: null, world_name: "Music videos",
    world_accent: "280 70% 65%", world_glyph: "▲",
  },
  {
    id: "demo-6", title: "Glass moth — first sequence", synopsis: null, video_url: "",
    thumbnail_url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    duration_sec: 21, world_slug: "experi", tags: ["experimental"],
    play_count: 612, like_count: 84, remix_count: 3, is_featured: false,
    created_at: new Date().toISOString(), creator_id: "demo-creator-6",
    creator_name: "Soren Holt", creator_avatar: null, world_name: "Experimental",
    world_accent: "0 0% 70%", world_glyph: "✦",
  },
];

export default function Lobby() {
  usePageMeta({ title: "Lobby — Small Bridges", description: "Watch, remix, and direct cinematic AI reels." });

  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [worlds, setWorlds] = useState<ChannelWorld[]>(WORLDS_FALLBACK);
  const [activeWorld, setActiveWorld] = useState<string>("all");
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [realFeedEverSeen, setRealFeedEverSeen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [challenges, setChallenges] = useState<DailyChallengeRow[]>([]);

  // Initial parallel load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [worldsRes, feedRes, promptRes] = await Promise.all([
          supabase.from("channel_worlds").select("*").eq("is_live", true).order("sort_order"),
          supabase.rpc("lobby_feed" as never, { p_world_slug: null, p_cursor: null, p_limit: 24 } as never),
          supabase.rpc("current_daily_prompt" as never),
        ]);
        if (cancelled) return;
        if (worldsRes.data && (worldsRes.data as ChannelWorld[]).length > 0) {
          setWorlds(worldsRes.data as ChannelWorld[]);
        }
        const feedArr = ((feedRes as { data?: unknown }).data as FeedRow[]) ?? [];
        if (feedArr.length > 0) {
          setFeed(feedArr);
          setUsingDemo(false);
          setRealFeedEverSeen(true);
        } else if (!realFeedEverSeen) {
          setFeed(DEMO_REELS);
          setUsingDemo(true);
        } else {
          setFeed([]);
          setUsingDemo(false);
        }
        const promptData = (promptRes as { data?: unknown }).data;
        if (promptData) setPrompt(promptData as DailyPrompt);
      } catch (e) {
        if (!cancelled) {
          console.warn("[Lobby] using demo reels — DB unreachable or migrations not pushed", e);
          if (realFeedEverSeen) {
            setFeed([]);
            setUsingDemo(false);
          } else {
            setFeed(DEMO_REELS);
            setUsingDemo(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load today's challenges + viewer progress (signed-in only).
  useEffect(() => {
    if (!user) { setChallenges([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: chRows } = await supabase
          .from("daily_challenges")
          .select("id, challenge_type, description, xp_reward, target_count")
          .eq("date", today)
          .limit(6);
        const chs = (chRows ?? []) as Array<{
          id: string; challenge_type: string; description: string;
          xp_reward: number; target_count: number;
        }>;
        if (chs.length === 0) { if (!cancelled) setChallenges([]); return; }
        const { data: progRows } = await supabase
          .from("user_challenge_progress")
          .select("challenge_id, progress, completed")
          .eq("user_id", user.id)
          .in("challenge_id", chs.map((c) => c.id));
        const progMap = new Map<string, { progress: number; completed: boolean }>();
        for (const p of (progRows ?? []) as Array<{ challenge_id: string; progress: number; completed: boolean }>) {
          progMap.set(p.challenge_id, { progress: p.progress, completed: p.completed });
        }
        if (!cancelled) {
          setChallenges(chs.map((c) => ({
            ...c,
            progress: progMap.get(c.id)?.progress ?? 0,
            completed: progMap.get(c.id)?.completed ?? false,
          })));
        }
      } catch (e) {
        console.warn("[Lobby] challenges fetch failed (table may not be ready)", e);
        if (!cancelled) setChallenges([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load drafts only if signed in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("movie_projects")
        .select("id, title, status, thumbnail_url, updated_at")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (!cancelled) setDrafts((data ?? []) as DraftRow[]);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Filter feed by world (client-side when running demos, server-side when
  // real data is available — for now we filter client-side to keep things
  // snappy and consistent).
  const filtered = useMemo(() => {
    if (activeWorld === "all") return feed;
    return feed.filter((r) => r.world_slug === activeWorld);
  }, [feed, activeWorld]);

  const featured = useMemo(() => filtered.find((r) => r.is_featured) ?? filtered[0] ?? null, [filtered]);

  const tabItems = useMemo(() => ([
    { key: "all" as const, label: "All", icon: Tv },
    ...worlds.map((w) => ({ key: w.slug as string, label: w.name })),
  ]), [worlds]);

  const startFromPrompt = () => {
    if (!user) { navigate("/auth"); return; }
    const promptText = prompt?.prompt.prompt_text ?? "";
    try { sessionStorage.setItem('smallbridges.prompt_seed', promptText); } catch {}
    navigate("/create");
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora />

      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Lobby"
          title="Watch"
          accent="tonight."
          subtitle="Cinematic AI reels, programmed for the hour you're in. Tap any card to open the theater — remix any reel in one click."
          status={["Live", "Curated", "Remixable"]}
          subhead={
            usingDemo ? "Sample reels — yours appear once published" : `${filtered.length} reels`
          }
        >
          <StudioTabs
            items={tabItems}
            value={activeWorld}
            onChange={(k) => setActiveWorld(k)}
            layoutId="lobby-world-tab"
          />
        </StudioHero>

        {/* DAILY PROMPT — quick card that links to creation with prompt seeded */}
        <DailyPromptCard
          promptText={prompt?.prompt.prompt_text ?? "A character realizes the room they’ve been sitting in is not real."}
          promptHint={prompt?.prompt.prompt_hint ?? "10–30 seconds. Reveal at the end."}
          onSubmit={startFromPrompt}
        />

        {/* TODAY'S CHALLENGES — only shown when signed in and challenges exist */}
        {user && challenges.length > 0 && <DailyChallengesCard rows={challenges} />}

        {/* FEATURED REEL */}
        {featured && <FeaturedRail reel={featured} demo={usingDemo} />}

        {/* TRENDING GRID */}
        <SectionLabel label="Trending now" icon={Flame} meta={`${filtered.length} reels`} />
        {loading ? (
          // Skeleton matches the final 1/2/3-column grid layout so there's
          // no FOUC when real cards swap in.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-glass bg-glass overflow-hidden">
                <div className="aspect-video bg-white/[0.03] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-3/4 bg-white/[0.05] rounded animate-pulse" />
                  <div className="h-2 w-1/2 bg-white/[0.04] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeWorld}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16"
            >
              {filtered.map((r) => (
                <ReelCard key={r.id} reel={r} demo={usingDemo} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* DRAFTS */}
        {drafts.length > 0 && (
          <>
            <SectionLabel label="Your unfinished" icon={Clock} meta={`${drafts.length} in progress`} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-16">
              {drafts.map((d) => (
                <Link
                  key={d.id}
                  to={`/editor/${d.id}`}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.015] hover:border-white/20 hover:bg-glass-hover overflow-hidden transition-colors"
                >
                  <div className="aspect-video bg-black/40">
                    {d.thumbnail_url ? (
                      <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        <Wand2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-[11px] text-white truncate">{d.title || "Untitled"}</div>
                    <div className="text-[9px] text-white/40 font-mono uppercase tracking-[0.22em] mt-0.5">{d.status}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* CROSS-LINK STRIP */}
        <CrossLinkStrip />
      </PageShell>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────

function SectionLabel({ label, meta, icon: Icon }: { label: string; meta?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function DailyPromptCard({ promptText, promptHint, onSubmit }: { promptText: string; promptHint: string; onSubmit: () => void }) {
  return (
    <section
      className="relative rounded-3xl overflow-hidden p-8 lg:p-12 mb-10 border"
      style={{
        background:
          "linear-gradient(180deg, hsla(215,100%,60%,0.05) 0%, hsla(215,100%,60%,0.01) 100%)",
        borderColor: "hsla(215,100%,60%,0.18)",
        boxShadow: "0 8px 40px -16px hsla(215,100%,60%,0.20), inset 0 1px 0 hsla(0,0%,100%,0.04)",
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_auto] gap-6 items-end">
        <div>
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.32em] text-primary/90">
            <Calendar className="w-3 h-3" /> Today's prompt
          </div>
          <h2 className="font-display font-medium text-[clamp(1.5rem,3.5vw,2.6rem)] leading-[1.1] tracking-[-0.02em] text-foreground">
            {promptText}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl">{promptHint}</p>
        </div>
        <button
          onClick={onSubmit}
          className="group inline-flex items-center gap-2 h-12 px-6 rounded-full text-[12px] font-medium tracking-[-0.005em] text-foreground transition-all"
          style={{
            background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
            boxShadow: "0 0 24px hsla(215,100%,60%,0.35), inset 0 1px 0 hsla(0,0%,100%,0.10)",
          }}
        >
          <Wand2 className="w-3.5 h-3.5 text-[hsl(215,100%,75%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]" />
          Submit your take
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  );
}

function FeaturedRail({ reel, demo }: { reel: FeedRow; demo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardClass = "group relative block rounded-3xl overflow-hidden border border-white/[0.08] bg-black/40 transition-colors hover:border-white/20";
  const inner = (
        <div className="relative aspect-[21/9] bg-black">
          {reel.video_url && !demo ? (
            <video
              ref={videoRef}
              src={reel.video_url}
              poster={reel.thumbnail_url ?? undefined}
              autoPlay muted loop playsInline preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : reel.thumbnail_url ? (
            <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          <div className="absolute top-5 left-5 flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] border bg-black/55 backdrop-blur-md"
              style={{ color: `hsl(${reel.world_accent ?? "213 100% 60%"})`, borderColor: `hsla(${reel.world_accent ?? "213 100% 60%"} / 0.4)` }}
            >
              <span className="mr-1">{reel.world_glyph}</span>{reel.world_name}
            </span>
            {demo && (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] bg-amber-300/15 border border-amber-300/30 text-amber-200">
                preview
              </span>
            )}
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <h3 className="font-display font-medium text-[clamp(1.6rem,4vw,3rem)] leading-[1.0] tracking-[-0.02em] text-white">{reel.title}</h3>
            <div className="mt-3 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.22em] text-white/70">
              <span className="inline-flex items-center gap-1.5"><Eye className="w-3 h-3" />{reel.play_count.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1.5"><Heart className="w-3 h-3" />{reel.like_count.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1.5"><Wand2 className="w-3 h-3" />{reel.remix_count.toLocaleString()}</span>
              <span aria-hidden className="w-1 h-1 rounded-full bg-white/25" />
              <span>{reel.creator_name}</span>
            </div>
          </div>

          <div className="absolute top-5 right-5 inline-flex items-center gap-2 px-3.5 h-9 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.10] text-[11px] font-mono uppercase tracking-[0.22em] text-white/85">
            <Play className="w-3 h-3" />Open theater
          </div>
        </div>
  );
  return (
    <section className="mb-12">
      <SectionLabel label="Featured tonight" icon={Sparkles} meta={demo ? "sample" : "live"} />
      {demo
        ? <div className={cardClass}>{inner}</div>
        : <Link to={`/watch/${reel.id}`} className={cardClass}>{inner}</Link>}
    </section>
  );
}

function ReelCard({ reel, demo }: { reel: FeedRow; demo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onEnter = () => { if (videoRef.current && !demo) { try { videoRef.current.currentTime = 0; void videoRef.current.play(); } catch {} } };
  const onLeave = () => { videoRef.current?.pause(); };
  const remix = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (demo) { toast.message("This is a sample — publish your own to enable remixing."); return; }
    try {
      const { data, error } = await supabase.rpc("remix_reel" as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
      const out = data as unknown as { new_project_id: string };
      toast.success("Remix project created");
      window.location.href = `/editor/${out.new_project_id}`;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Remix failed"); }
  };

  const cardClass = "group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.015] hover:border-white/15 transition-colors";
  const inner = (
    <>
      <div className="relative aspect-video bg-black/40">
        {reel.video_url && !demo ? (
          <video ref={videoRef} src={reel.video_url} poster={reel.thumbnail_url ?? undefined} muted loop playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
        ) : reel.thumbnail_url ? (
          <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        {reel.world_name && (
          <div
            className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] border backdrop-blur-md bg-black/45"
            style={{ color: `hsl(${reel.world_accent ?? "213 100% 60%"})`, borderColor: `hsla(${reel.world_accent ?? "213 100% 60%"} / 0.35)` }}
          >
            <span className="mr-1">{reel.world_glyph}</span>{reel.world_name}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/75">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{reel.play_count.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{reel.like_count.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><Wand2 className="w-3 h-3" />{reel.remix_count.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="text-[14px] text-foreground font-light truncate">{reel.title}</div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/80 font-mono uppercase tracking-[0.22em]">
          {reel.creator_avatar ? (
            <img src={reel.creator_avatar} alt="" className="w-4 h-4 rounded-full" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-glass-hover flex items-center justify-center text-[8px]">
              {(reel.creator_name?.[0] || "?").toUpperCase()}
            </div>
          )}
          {reel.creator_name || "Anonymous"}
        </div>
        <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={remix}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-[10px] font-mono uppercase tracking-[0.22em] transition-colors",
              "border-white/[0.10] hover:border-primary/40 text-foreground/75 hover:text-foreground",
            )}
          >
            <Wand2 className="w-3 h-3" />Remix
          </button>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
            Watch <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </>
  );
  return demo ? (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} className={cardClass}>{inner}</div>
  ) : (
    <Link to={`/watch/${reel.id}`} onMouseEnter={onEnter} onMouseLeave={onLeave} className={cardClass}>{inner}</Link>
  );
}

function DailyChallengesCard({ rows }: { rows: DailyChallengeRow[] }) {
  return (
    <section
      className="relative rounded-3xl overflow-hidden p-6 lg:p-8 mb-10 border"
      style={{
        background:
          "linear-gradient(180deg, hsla(280,70%,55%,0.04) 0%, hsla(280,70%,55%,0.01) 100%)",
        borderColor: "hsla(280,70%,55%,0.18)",
      }}
    >
      <div className="flex items-center gap-2 mb-4 text-[10px] font-mono uppercase tracking-[0.32em]" style={{ color: "hsl(280 80% 70%)" }}>
        <Sparkles className="w-3 h-3" /> Today's challenges
        <span className="ml-auto text-white/40">
          {rows.filter((r) => r.completed).length}/{rows.length} done
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((c) => {
          const pct = c.target_count > 0 ? Math.min(100, (c.progress / c.target_count) * 100) : 0;
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-2xl p-4 border transition-colors",
                c.completed
                  ? "border-emerald-300/30 bg-emerald-400/[0.05]"
                  : "border-white/[0.06] bg-white/[0.015]",
              )}
            >
              <div className="flex items-center gap-2 mb-1 text-[10px] font-mono uppercase tracking-[0.22em]"
                   style={{ color: c.completed ? "hsl(150 70% 70%)" : "hsl(280 80% 70%)" }}>
                {c.challenge_type}
                <span className="ml-auto text-white/40">+{c.xp_reward} xp</span>
              </div>
              <div className="text-[13px] text-white font-light leading-snug mb-3">{c.description}</div>
              <div className="h-1 rounded-full bg-glass-active overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: c.completed
                      ? "linear-gradient(90deg, hsla(150,80%,60%,0.9), hsla(150,80%,70%,0.9))"
                      : "linear-gradient(90deg, hsla(280,70%,60%,0.9), hsla(213,100%,60%,0.9))",
                  }}
                />
              </div>
              <div className="mt-1 text-[10px] font-mono text-white/40 tabular-nums">
                {c.progress}/{c.target_count}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CrossLinkStrip() {
  const links = [
    { to: "/crossover", label: "Crossover", sub: "50 next-gen break-out VFX",      icon: Sparkles },
    { to: "/music",     label: "Music",     sub: "Score · Karaoke · Sheet music",  icon: Music2 },
    { to: "/market",    label: "Market",    sub: "Voices · Characters · Scores",   icon: ShoppingBag },
    { to: "/crews",     label: "Crews",     sub: "Persistent creative groups",     icon: UsersIcon },
  ];
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 hover:bg-glass-hover px-5 py-4 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl border border-white/[0.10] bg-glass flex items-center justify-center text-foreground/65 group-hover:text-primary group-hover:border-primary/40 transition-colors">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-foreground">{l.label}</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">{l.sub}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        );
      })}
    </section>
  );
}

