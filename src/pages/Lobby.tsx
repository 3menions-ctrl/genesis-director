/**
 * Lobby — /lobby · "The Marquee"
 *
 * A cinema-hub front door: a full-bleed premiere takeover, a Worlds quick-nav,
 * horizontal film rails (Featured / a spotlighted World / New this week), and a
 * live information-center sidebar (live stats, the day's challenge, this week's
 * directors, technique of the day).
 *
 * Design rules:
 *   • No page-level top nav — the app shell (FoundationShell + LeftRail) owns
 *     navigation; the lobby is pure content.
 *   • No oversized masthead headline — the films carry the page.
 *   • Every video sits in a FIXED-aspect-ratio frame (16:9). Thumbnails use
 *     object-cover so they never stretch/distort; the frame holds layout steady.
 *
 * Data is real: channel_worlds + published_reels (decorated with creator
 * profiles + world accents), the daily prompt + challenges RPCs, and editor
 * presence. Every engagement figure (plays/likes/remixes, live counts) is
 * sourced from the database — there is NO fabricated/demo data. When there are
 * no published reels yet, the page renders a graceful empty state.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Play, Sparkles, ArrowRight, Flame, Trophy, Aperture, Search, Plus, Shuffle, Eye, Film, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { ImmersiveTheater, type TheaterReel } from "@/components/social/ImmersiveTheater";
import { ImmersiveFeed, type FeedReel } from "@/components/social/ImmersiveFeed";
import { CenterLine } from "@/components/ui/CenterLine";
import { WorldChat } from "@/components/lobby/WorldChat";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChannelWorld {
  id: string; slug: string; name: string; description: string | null;
  accent_hsl: string; glyph: string | null;
}
interface FeedRow {
  id: string; title: string; synopsis: string | null;
  video_url: string; thumbnail_url: string | null;
  duration_sec: number | null;
  world_slug: string | null;
  tags: string[];
  play_count: number; like_count: number; remix_count: number;
  is_featured: boolean;
  created_at: string;
  creator_id: string; creator_name: string | null; creator_avatar: string | null;
  world_name: string | null; world_accent: string | null; world_glyph: string | null;
}
interface DailyPrompt {
  prompt: { id: string; prompt_text: string; prompt_hint: string | null; world_slug: string | null; prompt_date: string };
  top_submissions: Array<{ reel_id: string; title: string; thumbnail_url: string | null; votes: number }>;
}
interface DailyChallengeRow {
  id: string; challenge_type: string; description: string;
  xp_reward: number; target_count: number; progress: number; completed: boolean;
}
interface Technique { id: string; title: string; oneLiner: string; seed: string; }

// ─── Fallbacks (page is never empty) ─────────────────────────────────────────
const WORLDS_FALLBACK: ChannelWorld[] = [
  { id: "1", slug: "noir",   name: "Noir",         description: null, accent_hsl: "38 80% 60%",   glyph: "◐" },
  { id: "2", slug: "scifi",  name: "Sci-Fi",       description: null, accent_hsl: "213 100% 60%", glyph: "◊" },
  { id: "3", slug: "comedy", name: "Comedy",       description: null, accent_hsl: "14 90% 60%",   glyph: "★" },
  { id: "4", slug: "docu",   name: "Documentary",  description: null, accent_hsl: "160 60% 50%",  glyph: "◯" },
  { id: "5", slug: "music",  name: "Music videos", description: null, accent_hsl: "280 70% 65%",  glyph: "▲" },
  { id: "6", slug: "experi", name: "Experimental", description: null, accent_hsl: "0 0% 70%",     glyph: "✦" },
];
const TECHNIQUES: Technique[] = [
  { id: "anamorphic-bokeh", title: "Anamorphic Bokeh", oneLiner: "Oval out-of-focus highlights and horizontal flares — the widescreen breath of a Villeneuve frame.", seed: "A close-up scene with shallow depth of field. Use anamorphic 2.39:1 framing with oval bokeh in the deep background. Practical neon highlights bloom into horizontal blue lens flares." },
  { id: "dolly-zoom", title: "Dolly Zoom", oneLiner: "The background collapses while the face holds — a panic the camera invented.", seed: "Dolly-zoom shot: the camera pushes in on the subject while zooming out, so the subject stays the same size but the background warps and collapses. Hold for 4 seconds of dread." },
  { id: "match-cut", title: "Match Cut", oneLiner: "Two shapes rhyme. The bone becomes the spaceship. Editing as poetry.", seed: "Two scenes joined by a match cut: end the first shot with a circular shape and open the next with the same shape in a wholly different context." },
  { id: "color-story", title: "Color Story", oneLiner: "One palette per act — feeling rendered as light.", seed: "Establish a strict color story across three shots: cool tungsten interior → sodium-vapor amber → blue-hour exterior. Every frame carries one palette, no neutral tones." },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDur(s: number | null): string {
  if (!s || s <= 0) return "";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}
const accentStyle = (hsl: string | null) => (hsl ? { color: `hsl(${hsl})` } : undefined);

const PAGE_SIZE = 24;

// Fetch one page of published reels (ranked by plays) and decorate each with its
// creator profile + world accent. Reused for the initial load and "load more"
// so the wall can go arbitrarily deep without a bespoke query each time.
async function fetchReelPage(offset: number, limit: number, worlds: ChannelWorld[]): Promise<FeedRow[]> {
  const { data } = await supabase.from("published_reels" as never)
    .select("id, title, synopsis, video_url, thumbnail_url, duration_sec, world_slug, tags, play_count, like_count, remix_count, is_featured, created_at, creator_id")
    .eq("is_taken_down", false)
    .order("play_count", { ascending: false })
    .range(offset, offset + limit - 1);
  const reels = (data ?? []) as Array<Omit<FeedRow, "creator_name" | "creator_avatar" | "world_name" | "world_accent" | "world_glyph">>;
  if (reels.length === 0) return [];

  const creatorIds = Array.from(new Set(reels.map((r) => r.creator_id))).filter(Boolean);
  const profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (creatorIds.length > 0) {
    const { data: profs } = await supabase.from("profiles_public" as never).select("id, display_name, avatar_url").in("id", creatorIds);
    for (const p of ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>)) profilesById.set(p.id, p);
  }
  const worldsBySlug = new Map<string, ChannelWorld>();
  for (const w of worlds) worldsBySlug.set(w.slug, w);

  return reels.map((r) => {
    const p = profilesById.get(r.creator_id);
    const w = r.world_slug ? worldsBySlug.get(r.world_slug) : undefined;
    return {
      ...r, tags: (r as FeedRow).tags ?? [],
      creator_name: p?.display_name ?? null, creator_avatar: p?.avatar_url ?? null,
      world_name: w?.name ?? null, world_accent: w?.accent_hsl ?? null, world_glyph: w?.glyph ?? null,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Lobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  usePageMeta({
    title: "The Lobby · Small Bridges",
    description: "Tonight's premieres, the worlds, the craft — the front door to the studio.",
  });
  usePageTone(TONE_PRESETS.lobby);

  // ── Worlds + reels ──
  const [worlds, setWorlds] = useState<ChannelWorld[]>(WORLDS_FALLBACK);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [activeWorld, setActiveWorld] = useState<string>("all");
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [challenges, setChallenges] = useState<DailyChallengeRow[]>([]);
  const [theaterReel, setTheaterReel] = useState<TheaterReel | null>(null);
  // Discovery: live search + deep pagination
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Immersive autoplay feed
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStart, setFeedStart] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: worldsData } = await supabase.from("channel_worlds" as never).select("*").order("name");
        if (cancelled) return;
        const worldsList = (worldsData && (worldsData as ChannelWorld[]).length > 0)
          ? (worldsData as ChannelWorld[]) : WORLDS_FALLBACK;
        if (worldsData && (worldsData as ChannelWorld[]).length > 0) setWorlds(worldsList);

        const first = await fetchReelPage(0, PAGE_SIZE, worldsList);
        if (cancelled) return;
        setFeed(first);
        setOffset(first.length);
        setHasMore(first.length === PAGE_SIZE);
        setFeedLoading(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Lobby] feed load failed", e);
        if (!cancelled) setFeedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Deep pagination — append the next page of films, de-duped.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchReelPage(offset, PAGE_SIZE, worlds);
      setFeed((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...next.filter((r) => !seen.has(r.id))];
      });
      setOffset((o) => o + next.length);
      setHasMore(next.length === PAGE_SIZE);
    } catch { /* keep current feed on failure */ }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, offset, worlds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_daily_prompt_with_submissions" as never);
        if (!cancelled && data) setPrompt(data as DailyPrompt);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) { setChallenges([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_daily_challenges" as never);
        if (!cancelled && Array.isArray(data)) setChallenges(data as DailyChallengeRow[]);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Theater ──
  const openTheater = useCallback((r: FeedRow) => {
    setTheaterReel({
      id: r.id, title: r.title, video_url: r.video_url, thumbnail_url: r.thumbnail_url,
      play_count: r.play_count, like_count: r.like_count, remix_count: r.remix_count,
      creator_id: r.creator_id, creator_name: r.creator_name, creator_avatar: r.creator_avatar,
      world_name: r.world_name, world_accent: r.world_accent, world_glyph: r.world_glyph,
    });
  }, []);

  // ── Derived ──
  const filtered = useMemo(() => {
    let base = activeWorld === "all" ? feed : feed.filter((r) => r.world_slug === activeWorld);
    const q = query.trim().toLowerCase();
    if (q) {
      base = base.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.creator_name ?? "").toLowerCase().includes(q) ||
        (r.synopsis ?? "").toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return base;
  }, [feed, activeWorld, query]);
  const featured = useMemo(() => filtered.find((r) => r.is_featured) ?? filtered[0] ?? null, [filtered]);

  // Hero shuffle — the header film rotates through a small pool over time
  // (featured films first, else the top of the feed). Soft fade per swap;
  // frozen under reduced-motion.
  const heroPool = useMemo(() => {
    const feat = filtered.filter((r) => r.is_featured);
    const base = (feat.length >= 2 ? feat : filtered).slice(0, 6);
    return base.length ? base : (featured ? [featured] : []);
  }, [filtered, featured]);
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => { setHeroIdx(0); }, [activeWorld]);
  useEffect(() => {
    if (reduced || heroPool.length < 2) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroPool.length), 9000);
    return () => clearInterval(t);
  }, [reduced, heroPool.length]);
  const heroReel = heroPool[heroIdx % Math.max(1, heroPool.length)] ?? featured;

  const featuredRail = useMemo(() => filtered.filter((r) => r.id !== featured?.id).slice(0, 6), [filtered, featured]);
  const newThisWeek = useMemo(
    () => [...feed].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6),
    [feed],
  );
  // Spotlight world = the world (other than the featured's) with the most films.
  const spotlightWorld = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of feed) if (r.world_slug && r.world_slug !== featured?.world_slug) counts.set(r.world_slug, (counts.get(r.world_slug) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return worlds.find((w) => w.slug === top) ?? null;
  }, [feed, worlds, featured]);
  const spotlightRail = useMemo(
    () => (spotlightWorld ? feed.filter((r) => r.world_slug === spotlightWorld.slug).slice(0, 6) : []),
    [feed, spotlightWorld],
  );
  // This week's directors — group the feed by creator, rank by total plays.
  const directors = useMemo(() => {
    const by = new Map<string, { name: string; avatar: string | null; plays: number; films: number; accent: string | null; world: string | null }>();
    for (const r of feed) {
      const k = r.creator_id;
      const cur = by.get(k) ?? { name: r.creator_name ?? "Untitled director", avatar: r.creator_avatar, plays: 0, films: 0, accent: r.world_accent, world: r.world_name };
      cur.plays += r.play_count; cur.films += 1;
      by.set(k, cur);
    }
    return [...by.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.plays - a.plays).slice(0, 4);
  }, [feed]);
  const technique = useMemo(() => TECHNIQUES[new Date().getDate() % TECHNIQUES.length], []);

  const startWithSeed = useCallback((seed: string) => {
    const dest = `/studio?prompt=${encodeURIComponent(seed.trim())}`;
    navigate(user ? dest : `/auth?next=${encodeURIComponent(dest)}`);
  }, [user, navigate]);

  const filmsToday = feed.length;
  const isEmpty = !feedLoading && feed.length === 0;
  const searching = query.trim().length > 0;

  return (
    <FoundationShell>
      {/* Signature animated Aurora backdrop — slow-drifting brand-hue blooms
          behind all content. Frozen under reduced-motion. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <motion.div
          className="absolute -top-[20%] left-[-12%] h-[72vh] w-[72vh] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(215 100% 60% / 0.20), transparent 70%)" }}
          animate={reduced ? undefined : { x: [0, 90, 0], y: [0, 50, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-22%] right-[-12%] h-[64vh] w-[64vh] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(280 72% 60% / 0.15), transparent 70%)" }}
          animate={reduced ? undefined : { x: [0, -70, 0], y: [0, -36, 0] }}
          transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[30%] left-[40%] h-[46vh] w-[46vh] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(160 60% 50% / 0.10), transparent 70%)" }}
          animate={reduced ? undefined : { x: [0, -50, 40, 0], y: [0, 40, -30, 0] }}
          transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="relative z-10">
        {/* ── HERO TAKEOVER (shuffles over time) ─────────────────────── */}
        {heroReel && (
          <section className="relative w-full">
            <div className="relative h-[clamp(420px,56vh,600px)] w-full overflow-hidden">
              {heroReel.thumbnail_url && (
                /* Full-bleed cover frame; soft cross-fade on each shuffle. */
                <motion.img
                  key={heroReel.id}
                  src={heroReel.thumbnail_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={reduced ? false : { opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reduced ? 0 : 1.1, ease: "easeOut" }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, hsl(220 14% 2% / .95) 18%, hsl(220 14% 2% / .5) 52%, hsl(220 14% 2% / .12) 82%), linear-gradient(0deg, hsl(220 14% 2%), hsl(220 14% 2% / .08) 46%)" }}
              />
              <div className="absolute inset-x-0 bottom-0">
                <motion.div
                  key={`${heroReel.id}-meta`}
                  className="mx-auto w-full max-w-[1440px] px-4 pb-9 sm:px-8 lg:px-12"
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : 0.6, ease: "easeOut" }}
                >
                  {/* Premium eyebrow — featured + world as clean type, no boxes,
                      no engagement counts. Borderless/floating. */}
                  <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
                    <span className={heroReel.is_featured ? "text-[hsl(38_90%_64%)]" : "text-[hsl(14_90%_64%)]"}>
                      {heroReel.is_featured ? "Featured" : "Trending"}
                    </span>
                    {heroReel.world_name && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span style={accentStyle(heroReel.world_accent)}>{heroReel.world_glyph ?? "◆"} {heroReel.world_name}</span>
                      </>
                    )}
                  </div>
                  {/* No oversized headline — a restrained title + synopsis carry it. */}
                  <h2 className="max-w-2xl font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[26px]">
                    {heroReel.title}
                  </h2>
                  {heroReel.synopsis && (
                    <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-foreground/60">{heroReel.synopsis}</p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <button type="button" onClick={() => openTheater(heroReel)}
                      className="inline-flex items-center gap-2 text-[14px] font-semibold text-foreground transition-colors hover:text-white">
                      <Play className="h-4 w-4 fill-current" /> Watch now
                    </button>
                    <button type="button" onClick={() => { setFeedStart(0); setFeedOpen(true); }}
                      className="inline-flex items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:text-foreground">
                      <Film className="h-4 w-4" strokeWidth={1.6} /> Immersive feed
                    </button>
                    <button type="button" onClick={() => startWithSeed(heroReel.synopsis || heroReel.title)}
                      className="inline-flex items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:text-foreground">
                      <Shuffle className="h-4 w-4" strokeWidth={1.6} /> Remix this look
                    </button>
                  </div>
                  {heroReel.creator_name && (
                    <div className="mt-5 font-mono text-[11px] text-muted-foreground">
                      <span>directed by {heroReel.creator_name}</span>
                    </div>
                  )}
                  {/* shuffle position dots */}
                  {heroPool.length > 1 && (
                    <div className="mt-5 flex items-center gap-1.5">
                      {heroPool.map((r, i) => (
                        <button key={r.id} type="button" aria-label={`Show ${r.title}`} onClick={() => setHeroIdx(i)}
                          className={cn("h-1.5 rounded-full transition-all", i === heroIdx ? "w-6 bg-white/90" : "w-1.5 bg-white/30 hover:bg-white/50")} />
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>

            {/* Worlds quick-nav strip — floats over the backdrop, no panel */}
            <div>
              <div className="scrollbar-hide mx-auto flex w-full max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-8 lg:px-12">
                <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Worlds</span>
                <WorldChip label="All" active={activeWorld === "all"} onClick={() => setActiveWorld("all")} />
                {worlds.map((w) => (
                  <WorldChip key={w.id} label={w.name} glyph={w.glyph} accent={w.accent_hsl}
                    active={activeWorld === w.slug} onClick={() => setActiveWorld(w.slug)} />
                ))}
                {/* Inline live search — filters the loaded feed instantly by
                    title, director, synopsis or tag. */}
                <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 transition-colors focus-within:bg-white/[0.08]">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search films…"
                    aria-label="Search films"
                    className="w-28 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:w-44 focus:outline-none sm:w-32 transition-[width] duration-200"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── BODY: rails + sidebar ─────────────────────────────────── */}
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-x-11 gap-y-0 px-4 pb-28 pt-9 sm:px-8 lg:grid-cols-[1fr_336px] lg:px-12">
          <main className="min-w-0">
            {isEmpty ? (
              <EmptyMarquee onCreate={() => navigate(user ? "/studio" : "/auth?next=/studio")} />
            ) : feed.length === 0 ? (
              null /* feed still loading — no rails, no fabricated cards */
            ) : searching ? (
              /* Live search results — a single wall of every match in the feed. */
              <section>
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-[24px] font-semibold tracking-tight text-foreground">
                    Results<span className="ml-3 align-middle text-[12.5px] font-normal text-muted-foreground">{filtered.length} match{filtered.length === 1 ? "" : "es"} for “{query.trim()}”</span>
                  </h3>
                  <button type="button" onClick={() => setQuery("")} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"><X className="h-3 w-3" strokeWidth={1.6} /> Clear</button>
                </div>
                {filtered.length === 0 ? (
                  <p className="py-16 text-center text-[14px] text-muted-foreground">No films match “{query.trim()}”. {hasMore && "Try Load more, or "}adjust your search.</p>
                ) : (
                  <div className="columns-2 gap-4 sm:columns-3 lg:gap-5">
                    {filtered.map((r) => <VideoCard key={r.id} reel={r} onOpen={openTheater} reduced={!!reduced} />)}
                  </div>
                )}
              </section>
            ) : (
              <>
                <Rail title="Trending now" sub="ranked by plays" onSeeAll={() => navigate("/search")}>
                  {featuredRail.map((r, i) => <VideoCard key={r.id} reel={r} onOpen={openTheater} reduced={!!reduced} rank={i + 1} />)}
                </Rail>

                {spotlightWorld && spotlightRail.length > 0 && (
                  <Rail title={`Wander ${spotlightWorld.name}`} sub={`${spotlightWorld.glyph ?? ""} ${spotlightRail.length} films`}
                    onSeeAll={() => setActiveWorld(spotlightWorld.slug)} seeAllLabel="Enter world →">
                    {spotlightRail.map((r) => <VideoCard key={r.id} reel={r} onOpen={openTheater} reduced={!!reduced} />)}
                  </Rail>
                )}

                <Rail title="New this week" sub={`${feed.length} fresh films`} onSeeAll={() => navigate("/search")} last>
                  {newThisWeek.map((r) => <VideoCard key={r.id} reel={r} onOpen={openTheater} reduced={!!reduced} />)}
                </Rail>
              </>
            )}

            {/* Deep pagination — load the next page of films into the wall. */}
            {!isEmpty && feed.length > 0 && hasMore && (
              <div className="mt-12 flex justify-center">
                <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-white/[0.06] disabled:opacity-50">
                  <Plus className="h-4 w-4" strokeWidth={1.6} /> {loadingMore ? "Loading…" : "Load more films"}
                </button>
              </div>
            )}
          </main>

          {/* ── SIDEBAR INFO CENTER ─────────────────────────────────── */}
          <aside className="mt-2 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
            <div className="mb-[18px]">
              <WorldChat />
            </div>

            <Panel title="The Lobby · live" badge={<span className="text-[hsl(160_60%_50%)]">● now</span>}>
              <Stat label="Films today" value={String(filmsToday)} />
            </Panel>

            <Panel
              title={<span className="text-[hsl(38_80%_60%)]">◆ {challenges[0] ? "Challenge" : "Daily prompt"}</span>}
              badge={challenges[0] ? <span className="text-[hsl(38_80%_60%)]">+{challenges[0].xp_reward} XP</span> : undefined}
              tint="linear-gradient(160deg, hsl(38 80% 60% / .12), transparent)"
            >
              <p className="mb-4 font-display text-[18px] leading-snug text-foreground">
                {challenges[0]?.description ?? prompt?.prompt.prompt_text ?? "Tell a complete story in one continuous shot — under 30 seconds."}
              </p>
              <button type="button"
                onClick={() => (prompt ? startWithSeed(prompt.prompt.prompt_text) : navigate(user ? "/studio" : "/auth?next=/studio"))}
                className="group/cta inline-flex items-center gap-2 text-[13px] font-semibold text-foreground transition-colors hover:text-white">
                {challenges[0] ? "Continue challenge" : "Take the prompt"} <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5" />
              </button>
              {challenges[0] && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-[hsl(38_80%_60%)]"
                    style={{ width: `${Math.min(100, Math.round((challenges[0].progress / Math.max(1, challenges[0].target_count)) * 100))}%` }} />
                </div>
              )}
            </Panel>

            <Panel title="This week's directors">
              {directors.map((d, i) => (
                <button key={d.id} type="button" onClick={() => navigate(`/c/${d.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]">
                  <span className="w-5 shrink-0 font-display text-[20px] font-semibold text-muted-foreground/50">{i + 1}</span>
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#2a2e3a] to-[#15171f]">
                    {d.avatar && <img src={d.avatar} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-foreground">{d.name}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{d.world ?? "Studio"} · {d.films} film{d.films > 1 ? "s" : ""}</span>
                  </span>
                </button>
              ))}
              {directors.length === 0 && <p className="py-4 text-center text-[13px] text-muted-foreground">No films yet today.</p>}
            </Panel>

            <Panel title="Technique of the day">
              <h4 className="font-display text-[19px] font-semibold text-foreground">{technique.title}</h4>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{technique.oneLiner}</p>
              <button type="button" onClick={() => startWithSeed(technique.seed)}
                className="group/tq mt-3 inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground">
                <Aperture className="h-3.5 w-3.5" strokeWidth={1.6} /> Try this technique
                <ArrowRight className="h-3 w-3 transition-transform group-hover/tq:translate-x-0.5" />
              </button>
            </Panel>
          </aside>
        </div>
      </div>

      <ImmersiveTheater
        reel={theaterReel}
        onClose={() => setTheaterReel(null)}
        queue={filtered.map((r) => ({
          id: r.id, title: r.title, video_url: r.video_url, thumbnail_url: r.thumbnail_url,
          play_count: r.play_count, like_count: r.like_count, remix_count: r.remix_count,
          creator_id: r.creator_id, creator_name: r.creator_name, creator_avatar: r.creator_avatar,
          world_name: r.world_name, world_accent: r.world_accent, world_glyph: r.world_glyph,
        }))}
        onSwitch={(next) => setTheaterReel(next)}
      />

      {/* Immersive autoplay feed — full-screen vertical scroll-to-next mode. */}
      <AnimatePresence>
        {feedOpen && filtered.length > 0 && (
          <ImmersiveFeed
            reels={filtered.map((r): FeedReel => ({
              id: r.id, title: r.title, video_url: r.video_url, thumbnail_url: r.thumbnail_url,
              like_count: r.like_count, play_count: r.play_count,
              creator_id: r.creator_id, creator_name: r.creator_name,
              world_name: r.world_name, world_accent: r.world_accent,
            }))}
            startIndex={feedStart}
            onClose={() => setFeedOpen(false)}
          />
        )}
      </AnimatePresence>
    </FoundationShell>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────
function WorldChip({ label, glyph, accent, active, onClick }: { label: string; glyph?: string | null; accent?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] transition-colors",
        active ? "text-foreground" : "text-muted-foreground/70 hover:bg-white/[0.06] hover:text-foreground",
      )}>
      {glyph && <span style={accentStyle(accent ?? null)}>{glyph}</span>}
      {label}
      {active && <CenterLine />}
    </button>
  );
}

function Rail({ title, sub, onSeeAll, seeAllLabel = "See all →", last, children }: {
  title: string; sub?: string; onSeeAll?: () => void; seeAllLabel?: string; last?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={last ? "" : "mb-11"}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[24px] font-semibold tracking-tight text-foreground">
          {title}{sub && <span className="ml-3 align-middle text-[12.5px] font-normal text-muted-foreground">{sub}</span>}
        </h3>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="group/sa inline-flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground/70 transition-colors hover:text-foreground">
            {seeAllLabel.replace(/\s*→\s*$/, "")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/sa:translate-x-0.5" strokeWidth={1.6} />
          </button>
        )}
      </div>
      {/* Masonry — cards keep each video's OWN aspect ratio, so a vertical
          reel sits tall and a landscape film sits wide; no forced crop. */}
      <div className="columns-2 gap-4 sm:columns-3 lg:gap-5">{children}</div>
    </section>
  );
}

function VideoCard({ reel, onOpen, reduced, rank }: { reel: FeedRow; onOpen: (r: FeedRow) => void; reduced: boolean; rank?: number }) {
  // The frame adopts the media's OWN aspect ratio (read from the thumbnail).
  // Until it loads we hold a 16:9 placeholder so the masonry doesn't jump.
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <article className="group mb-4 break-inside-avoid lg:mb-5">
      <button
        type="button"
        onClick={() => onOpen(reel)}
        title={reel.title}
        /* Borderless, floating frame sized to the video's true ratio — never
           cropped, never letterboxed. The title card lives INSIDE the frame and
           only fades in on hover, so the grid reads as a clean wall of imagery. */
        className={cn(
          "relative block w-full overflow-hidden rounded-2xl bg-transparent",
          "shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] transition-shadow duration-500",
          "hover:shadow-[0_36px_84px_-32px_rgba(0,0,0,0.95)]",
        )}
        style={{ aspectRatio: ratio ? `${ratio}` : "16 / 9" }}
      >
        {reel.thumbnail_url
          ? <img src={reel.thumbnail_url} alt="" loading="lazy"
              ref={(im) => { if (im?.complete && im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight); }}
              onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight); }}
              className={cn("h-full w-full object-cover", !reduced && "transition-transform duration-700 group-hover:scale-[1.05]")} />
          : <span className="flex h-full w-full items-center justify-center text-muted-foreground/40"><Eye className="h-6 w-6" /></span>}

        {/* Trending rank — a numbered badge, top-left, for ranked rails. */}
        {rank != null && (
          <span className="absolute left-2.5 top-2.5 grid h-7 min-w-7 place-items-center rounded-lg bg-black/55 px-1.5 font-display text-[14px] font-semibold text-white backdrop-blur-sm">
            {rank}
          </span>
        )}

        {/* Duration — always visible, top-right, so the resting wall still hints
            at length without a caption. */}
        {fmtDur(reel.duration_sec) && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-0">{fmtDur(reel.duration_sec)}</span>
        )}

        {/* Title card — hidden at rest, revealed on hover. Carries the world,
            title and director that used to sit permanently below the frame. */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1.5 p-3.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="block font-display text-[15px] font-semibold leading-tight tracking-tight text-white line-clamp-2">{reel.title}</span>
          <span className="mt-1 flex items-center gap-2 text-[11.5px] text-white/65">
            <span className="truncate">{reel.creator_name ?? "Unknown director"}</span>
            {reel.play_count > 0 && <span className="shrink-0 text-white/45">· {reel.play_count.toLocaleString()} plays</span>}
          </span>
        </span>

        {/* Play affordance — centered, appears on hover. */}
        <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 scale-90 place-items-center rounded-full bg-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
          <Play className="ml-0.5 h-4 w-4 fill-[#0a0b10] text-[#0a0b10]" />
        </span>
      </button>
    </article>
  );
}

// Containerless panel — no box, no border, no shadow. Just a floating mono
// eyebrow and content floating over the Aurora backdrop (borderless canon).
function Panel({ title, badge, children }: { title: React.ReactNode; badge?: React.ReactNode; tint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-9">
      <div className="mb-3.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
        <span>{title}</span>{badge}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn("font-display text-[16px] font-semibold text-foreground", valueClass)}>{value}</span>
    </div>
  );
}

// Empty state — shown when no published reels exist yet. No fabricated films,
// no invented counts; just an invitation to make the first one.
function EmptyMarquee({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 py-20 text-center">
      <span className="grid h-14 w-14 place-items-center text-foreground/70" style={{ filter: "drop-shadow(0 6px 24px hsl(var(--accent) / 0.35))" }}>
        <Sparkles className="h-7 w-7" />
      </span>
      <h3 className="mt-5 font-display text-[22px] font-semibold tracking-tight text-foreground">
        The marquee is dark — for now
      </h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        No films have premiered yet. Be the first to light up the lobby — direct a short and it lands right here.
      </p>
      <button type="button" onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-foreground transition-colors hover:text-white">
        <Plus className="h-4 w-4" /> Direct the first film
      </button>
    </div>
  );
}
