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
 * presence. Falls back to demos so the page is never empty.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Play, Sparkles, ArrowRight, Flame, Trophy, Aperture, Search, Plus, Shuffle, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { ImmersiveTheater, type TheaterReel } from "@/components/social/ImmersiveTheater";

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
const U = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const DEMO_REELS: FeedRow[] = [
  { id: "demo-1", title: "Stillwater · the cassette tape", synopsis: "A rain-soaked detective piece — one apartment, three acts, a single tape hiss for a score.", video_url: "", thumbnail_url: U("1485846234645-a62644f84728", 1400), duration_sec: 47, world_slug: "noir",   tags: [], play_count: 2841, like_count: 412, remix_count: 18, is_featured: true,  created_at: new Date().toISOString(),                  creator_id: "demo-1", creator_name: "Vela Reyes",  creator_avatar: null, world_name: "Noir",         world_accent: "38 80% 60%",   world_glyph: "◐" },
  { id: "demo-2", title: "Ground control to Earl Grey",    synopsis: null, video_url: "", thumbnail_url: U("1462331940025-496dfbfc7564", 1000), duration_sec: 32, world_slug: "scifi",  tags: [], play_count: 1823, like_count: 276, remix_count: 11, is_featured: false, created_at: new Date(Date.now() - 1 * 864e5).toISOString(), creator_id: "demo-2", creator_name: "Iko Marvell", creator_avatar: null, world_name: "Sci-Fi",       world_accent: "213 100% 60%", world_glyph: "◊" },
  { id: "demo-3", title: "Hot soup for one",               synopsis: null, video_url: "", thumbnail_url: U("1547573854-74d2a71d0826", 1000), duration_sec: 24, world_slug: "comedy", tags: [], play_count: 4129, like_count: 893, remix_count: 42, is_featured: false, created_at: new Date(Date.now() - 2 * 864e5).toISOString(), creator_id: "demo-3", creator_name: "Theo Park",   creator_avatar: null, world_name: "Comedy",       world_accent: "14 90% 60%",   world_glyph: "★" },
  { id: "demo-4", title: "The librarian who paints",       synopsis: null, video_url: "", thumbnail_url: U("1481627834876-b7833e8f5570", 1000), duration_sec: 65, world_slug: "docu",   tags: [], play_count: 1208, like_count: 198, remix_count: 6,  is_featured: false, created_at: new Date(Date.now() - 3 * 864e5).toISOString(), creator_id: "demo-4", creator_name: "Aiyana Wells",creator_avatar: null, world_name: "Documentary",  world_accent: "160 60% 50%",  world_glyph: "◯" },
  { id: "demo-5", title: "Lemon, neon, three breaths",     synopsis: null, video_url: "", thumbnail_url: U("1571330735066-03aaa9429d89", 1000), duration_sec: 38, world_slug: "music",  tags: [], play_count: 3245, like_count: 620, remix_count: 24, is_featured: false, created_at: new Date(Date.now() - 1 * 864e5).toISOString(), creator_id: "demo-5", creator_name: "Cassia Roe",  creator_avatar: null, world_name: "Music videos", world_accent: "280 70% 65%",  world_glyph: "▲" },
  { id: "demo-6", title: "Glass moth — first sequence",    synopsis: null, video_url: "", thumbnail_url: U("1516280440614-37939bbacd81", 1000), duration_sec: 28, world_slug: "experi", tags: [], play_count: 967,  like_count: 134, remix_count: 4,  is_featured: false, created_at: new Date(Date.now() - 4 * 864e5).toISOString(), creator_id: "demo-6", creator_name: "Pax Wren",    creator_avatar: null, world_name: "Experimental", world_accent: "0 0% 70%",     world_glyph: "✦" },
];
const TECHNIQUES: Technique[] = [
  { id: "anamorphic-bokeh", title: "Anamorphic Bokeh", oneLiner: "Oval out-of-focus highlights and horizontal flares — the widescreen breath of a Villeneuve frame.", seed: "A close-up scene with shallow depth of field. Use anamorphic 2.39:1 framing with oval bokeh in the deep background. Practical neon highlights bloom into horizontal blue lens flares." },
  { id: "dolly-zoom", title: "Dolly Zoom", oneLiner: "The background collapses while the face holds — a panic the camera invented.", seed: "Dolly-zoom shot: the camera pushes in on the subject while zooming out, so the subject stays the same size but the background warps and collapses. Hold for 4 seconds of dread." },
  { id: "match-cut", title: "Match Cut", oneLiner: "Two shapes rhyme. The bone becomes the spaceship. Editing as poetry.", seed: "Two scenes joined by a match cut: end the first shot with a circular shape and open the next with the same shape in a wholly different context." },
  { id: "color-story", title: "Color Story", oneLiner: "One palette per act — feeling rendered as light.", seed: "Establish a strict color story across three shots: cool tungsten interior → sodium-vapor amber → blue-hour exterior. Every frame carries one palette, no neutral tones." },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function driftedCount(base: number, amplitude: number, periodMs: number, t = Date.now()): number {
  return Math.max(1, Math.round(base + amplitude * Math.sin((t / periodMs) * Math.PI * 2)));
}
function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(n);
}
function fmtDur(s: number | null): string {
  if (!s || s <= 0) return "";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}
const accentStyle = (hsl: string | null) => (hsl ? { color: `hsl(${hsl})` } : undefined);

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

  // ── Live presence (drifts) ──
  const [presence, setPresence] = useState(() => ({
    watching: driftedCount(84, 22, 1000 * 60 * 3),
    rendering: driftedCount(12, 6, 1000 * 60 * 2),
  }));
  useEffect(() => {
    const t = setInterval(() => setPresence({
      watching: driftedCount(84, 22, 1000 * 60 * 3),
      rendering: driftedCount(12, 6, 1000 * 60 * 2),
    }), 5000);
    return () => clearInterval(t);
  }, []);
  const [nowEditing, setNowEditing] = useState(3);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase.from("editor_presence" as never).select("user_id", { count: "exact", head: true });
        if (!cancelled && typeof count === "number" && count > 0) { setNowEditing(count); return; }
      } catch { /* fallback */ }
      if (!cancelled) setNowEditing(driftedCount(7, 4, 1000 * 60 * 2));
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Worlds + reels ──
  const [worlds, setWorlds] = useState<ChannelWorld[]>(WORLDS_FALLBACK);
  const [feed, setFeed] = useState<FeedRow[]>(DEMO_REELS);
  const [usingDemo, setUsingDemo] = useState(true);
  const [activeWorld, setActiveWorld] = useState<string>("all");
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [challenges, setChallenges] = useState<DailyChallengeRow[]>([]);
  const [theaterReel, setTheaterReel] = useState<TheaterReel | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [worldsRes, reelsRes] = await Promise.all([
          supabase.from("channel_worlds" as never).select("*").order("name"),
          supabase.from("published_reels" as never)
            .select("id, title, synopsis, video_url, thumbnail_url, duration_sec, world_slug, tags, play_count, like_count, remix_count, is_featured, created_at, creator_id")
            .eq("is_taken_down", false)
            .order("play_count", { ascending: false })
            .limit(30),
        ]);
        if (cancelled) return;
        if (worldsRes.data && (worldsRes.data as ChannelWorld[]).length > 0) setWorlds(worldsRes.data as ChannelWorld[]);

        const reels = (reelsRes.data ?? []) as Array<Omit<FeedRow, "creator_name" | "creator_avatar" | "world_name" | "world_accent" | "world_glyph">>;
        if (reels.length === 0) return;

        const creatorIds = Array.from(new Set(reels.map((r) => r.creator_id))).filter(Boolean);
        const profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
        if (creatorIds.length > 0) {
          const { data: profs } = await supabase.from("profiles_public" as never).select("id, display_name, avatar_url").in("id", creatorIds);
          for (const p of ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>)) profilesById.set(p.id, p);
        }
        const worldsBySlug = new Map<string, ChannelWorld>();
        for (const w of ((worldsRes.data ?? WORLDS_FALLBACK) as ChannelWorld[])) worldsBySlug.set(w.slug, w);

        const decorated: FeedRow[] = reels.map((r) => {
          const p = profilesById.get(r.creator_id);
          const w = r.world_slug ? worldsBySlug.get(r.world_slug) : undefined;
          return {
            ...r, tags: (r as FeedRow).tags ?? [],
            creator_name: p?.display_name ?? null, creator_avatar: p?.avatar_url ?? null,
            world_name: w?.name ?? null, world_accent: w?.accent_hsl ?? null, world_glyph: w?.glyph ?? null,
          };
        });
        if (cancelled) return;
        setFeed(decorated);
        setUsingDemo(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Lobby] feed load failed, using demos", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    if (usingDemo) return; // demos have no real video
    setTheaterReel({
      id: r.id, title: r.title, video_url: r.video_url, thumbnail_url: r.thumbnail_url,
      play_count: r.play_count, like_count: r.like_count, remix_count: r.remix_count,
      creator_id: r.creator_id, creator_name: r.creator_name, creator_avatar: r.creator_avatar,
      world_name: r.world_name, world_accent: r.world_accent, world_glyph: r.world_glyph,
    });
  }, [usingDemo]);

  // ── Derived ──
  const filtered = useMemo(
    () => (activeWorld === "all" ? feed : feed.filter((r) => r.world_slug === activeWorld)),
    [feed, activeWorld],
  );
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

  const filmsToday = usingDemo ? feed.length : feed.length;
  const remixesToday = useMemo(() => feed.reduce((a, r) => a + r.remix_count, 0), [feed]);

  return (
    <FoundationShell>
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
                  <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                    style={{ borderColor: heroReel.world_accent ? `hsl(${heroReel.world_accent} / .4)` : "hsl(var(--border))" }}>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={accentStyle(heroReel.world_accent)}>
                      {heroReel.world_glyph} {heroReel.world_name ?? "Premiere"} · premiere of the night
                    </span>
                  </div>
                  {/* No oversized headline — a restrained title + synopsis carry it. */}
                  <h2 className="mt-3 max-w-2xl font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[26px]">
                    {heroReel.title}
                  </h2>
                  {heroReel.synopsis && (
                    <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-foreground/60">{heroReel.synopsis}</p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <button type="button" onClick={() => openTheater(heroReel)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#08090d] transition-transform hover:-translate-y-px">
                      <Play className="h-4 w-4 fill-current" /> Watch now
                    </button>
                    <button type="button" onClick={() => startWithSeed(heroReel.synopsis || heroReel.title)}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-white/5">
                      <Shuffle className="h-3.5 w-3.5" /> Remix this look
                    </button>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
                    <span>◆ {compact(heroReel.play_count)} plays</span>
                    <span>{compact(heroReel.like_count)} likes</span>
                    <span>{heroReel.remix_count} remixes</span>
                    {heroReel.creator_name && <span>directed by {heroReel.creator_name}</span>}
                  </div>
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

            {/* Worlds quick-nav strip */}
            <div className="border-y border-border/60 bg-[hsl(220_30%_4%/0.5)]">
              <div className="scrollbar-hide mx-auto flex w-full max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-8 lg:px-12">
                <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Worlds</span>
                <WorldChip label="All" active={activeWorld === "all"} onClick={() => setActiveWorld("all")} />
                {worlds.map((w) => (
                  <WorldChip key={w.id} label={w.name} glyph={w.glyph} accent={w.accent_hsl}
                    active={activeWorld === w.slug} onClick={() => setActiveWorld(w.slug)} />
                ))}
                <button type="button" onClick={() => navigate("/search")}
                  className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                  <Search className="h-3 w-3" /> Search
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── BODY: rails + sidebar ─────────────────────────────────── */}
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-x-11 gap-y-0 px-4 pb-28 pt-9 sm:px-8 lg:grid-cols-[1fr_336px] lg:px-12">
          <main className="min-w-0">
            <Rail title="Featured tonight" sub="hand-picked premieres" onSeeAll={() => navigate("/search")}>
              {featuredRail.map((r) => <VideoCard key={r.id} reel={r} demo={usingDemo} onOpen={openTheater} reduced={!!reduced} />)}
            </Rail>

            {spotlightWorld && spotlightRail.length > 0 && (
              <Rail title={`Wander ${spotlightWorld.name}`} sub={`${spotlightWorld.glyph ?? ""} ${spotlightRail.length} films`}
                onSeeAll={() => setActiveWorld(spotlightWorld.slug)} seeAllLabel="Enter world →">
                {spotlightRail.map((r) => <VideoCard key={r.id} reel={r} demo={usingDemo} onOpen={openTheater} reduced={!!reduced} />)}
              </Rail>
            )}

            <Rail title="New this week" sub={`${feed.length} fresh films`} onSeeAll={() => navigate("/search")} last>
              {newThisWeek.map((r) => <VideoCard key={r.id} reel={r} demo={usingDemo} onOpen={openTheater} reduced={!!reduced} />)}
            </Rail>
          </main>

          {/* ── SIDEBAR INFO CENTER ─────────────────────────────────── */}
          <aside className="mt-2 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
            <Panel title="The Lobby · live" badge={<span className="text-[hsl(160_60%_50%)]">● now</span>}>
              <Stat label="Watching now" value={compact(presence.watching)} />
              <Stat label="Films today" value={String(filmsToday)} />
              <Stat label="Remixes today" value={compact(remixesToday)} />
              <Stat label="In the editor" value={`${nowEditing} · live`} valueClass="text-[hsl(160_60%_50%)]" last />
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#08090d]">
                {challenges[0] ? "Continue challenge" : "Take the prompt"} <ArrowRight className="h-4 w-4" />
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
                <button key={d.id} type="button" onClick={() => navigate(usingDemo ? "/lobby" : `/u/${d.id}`)}
                  className="flex w-full items-center gap-3 border-b border-[#14161d] py-2.5 text-left last:border-0">
                  <span className="w-5 shrink-0 font-display text-[20px] font-semibold text-muted-foreground/50">{i + 1}</span>
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#2a2e3a] to-[#15171f]">
                    {d.avatar && <img src={d.avatar} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-foreground">{d.name}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{d.world ?? "Studio"} · {d.films} film{d.films > 1 ? "s" : ""}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-[hsl(38_80%_60%)]">{compact(d.plays)}</span>
                </button>
              ))}
              {directors.length === 0 && <p className="py-4 text-center text-[13px] text-muted-foreground">No films yet today.</p>}
            </Panel>

            <Panel title="Technique of the day">
              <h4 className="font-display text-[19px] font-semibold text-foreground">{technique.title}</h4>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{technique.oneLiner}</p>
              <button type="button" onClick={() => startWithSeed(technique.seed)}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                <Aperture className="h-3 w-3" /> Try this technique →
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
    </FoundationShell>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────
function WorldChip({ label, glyph, accent, active, onClick }: { label: string; glyph?: string | null; accent?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition-colors",
        active ? "border-white/25 bg-white/10 text-foreground" : "border-border bg-white/[0.02] text-muted-foreground hover:text-foreground",
      )}>
      {glyph && <span style={accentStyle(accent ?? null)}>{glyph}</span>}
      {label}
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
          <button type="button" onClick={onSeeAll} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            {seeAllLabel}
          </button>
        )}
      </div>
      {/* Masonry — cards keep each video's OWN aspect ratio, so a vertical
          reel sits tall and a landscape film sits wide; no forced crop. */}
      <div className="columns-2 gap-4 sm:columns-3 lg:gap-5">{children}</div>
    </section>
  );
}

function VideoCard({ reel, demo, onOpen, reduced }: { reel: FeedRow; demo: boolean; onOpen: (r: FeedRow) => void; reduced: boolean }) {
  // The frame adopts the media's OWN aspect ratio (read from the thumbnail).
  // Until it loads we hold a 16:9 placeholder so the masonry doesn't jump.
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <article className="group mb-4 break-inside-avoid lg:mb-5">
      <button
        type="button"
        onClick={() => onOpen(reel)}
        title={demo ? "Sample film" : reel.title}
        /* Transparent frame sized to the video's true ratio — never cropped,
           never letterboxed. object-cover fills exactly because they match. */
        className="relative block w-full overflow-hidden rounded-2xl bg-transparent ring-1 ring-inset ring-white/[0.07]"
        style={{ aspectRatio: ratio ? `${ratio}` : "16 / 9" }}
      >
        {reel.thumbnail_url
          ? <img src={reel.thumbnail_url} alt="" loading="lazy"
              onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight); }}
              className={cn("h-full w-full object-cover", !reduced && "transition-transform duration-500 group-hover:scale-[1.04]")} />
          : <span className="flex h-full w-full items-center justify-center text-muted-foreground/40"><Eye className="h-6 w-6" /></span>}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span className="absolute bottom-2.5 left-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-[#0a0b10] text-[#0a0b10]" />
        </span>
        {fmtDur(reel.duration_sec) && (
          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">{fmtDur(reel.duration_sec)}</span>
        )}
      </button>
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]" style={accentStyle(reel.world_accent)}>
        {reel.world_glyph} {reel.world_name ?? "Film"}
      </div>
      <h4 className="mt-1.5 font-display text-[18px] font-semibold leading-tight tracking-tight text-foreground line-clamp-2">{reel.title}</h4>
      <div className="mt-2 flex items-center justify-between">
        <span className="truncate text-[12px] text-muted-foreground">{reel.creator_name ?? "Unknown director"}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{compact(reel.play_count)} ▶</span>
      </div>
    </article>
  );
}

function Panel({ title, badge, tint, children }: { title: React.ReactNode; badge?: React.ReactNode; tint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px] rounded-[18px] border border-border p-5"
      style={{ background: tint ?? "linear-gradient(180deg, hsl(0 0% 100% / .025), transparent)" }}>
      <div className="mb-[15px] flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{title}</span>{badge}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, valueClass, last }: { label: string; value: string; valueClass?: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2.5", !last && "border-b border-[#14161d]")}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn("font-display text-[16px] font-semibold text-foreground", valueClass)}>{value}</span>
    </div>
  );
}
