/**
 * SearchHub — /search?q=&tab=
 *
 * Universal discovery — reels + people. URL params are the source of
 * truth so links are shareable (`?q=noir&tab=people`).
 *
 * Suggestive by default: with no query the page is a discovery feed —
 * "People to follow" (with inline follow buttons) and "Videos to watch"
 * (trending reels) — so the surface is useful before anyone types. Once
 * a query lands it switches to ranked results in the same card language.
 *
 * Absorbs the former /find-friends surface: the "People" tab is the
 * canonical place to discover other directors.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { track } from "@/lib/analytics/track";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search as SearchIcon, X, Film, Users, ArrowRight,
  Eye, Wand2, Sparkles, MapPin, UserPlus, UserCheck, Loader2, Play, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSocial } from "@/hooks/useSocial";
import { PageShell } from "@/components/shell";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

// ── Shared shapes ───────────────────────────────────────────────────────────
interface ReelHit {
  id: string;
  title: string;
  thumbnail_url: string | null;
  world_slug: string | null;
  play_count: number;
  creator_id: string;
  creator_name?: string | null;
  creator_avatar?: string | null;
}
interface CreatorHit {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline?: string | null;
  location?: string | null;
  bio?: string | null;
  follower_count: number;
  reel_count: number;
}
// search_everything RPC still returns universes + crews; we drop them
// here without touching the DB function so this page stays decoupled
// from the back-end migration timeline.
interface SearchPayload {
  reels: ReelHit[];
  creators: CreatorHit[];
}

type Tab = "all" | "reels" | "people";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "all",     label: "All",     icon: SearchIcon },
  { key: "reels",   label: "Reels",   icon: Film },
  { key: "people",  label: "People",  icon: Users },
];

// Vibe chips — clicking one runs the search. Doubles as discovery
// inspiration when the field is empty.
const SUGGESTIONS = ["noir", "sci-fi", "comedy", "neon", "rain", "robot", "moon", "dreamcore"];

function tabFromParam(raw: string | null): Tab {
  if (raw === "reels" || raw === "people") return raw;
  return "all";
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SearchHub() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<SearchPayload>({ reels: [], creators: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>(tabFromParam(params.get("tab")));
  const inputRef = useRef<HTMLInputElement>(null);

  // Discovery feed (idle, no-query state).
  const [discoverPeople, setDiscoverPeople] = useState<CreatorHit[]>([]);
  const [discoverReels, setDiscoverReels] = useState<ReelHit[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);

  // The set of creator ids the viewer already follows — seeds every
  // follow button so they render in the right state immediately.
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  usePageMeta({
    title: q ? `“${q}” — Search · Small Bridges` : "Search · Small Bridges",
    description: "Discover reels and directors across Small Bridges.",
  });

  useEffect(() => { requestAnimationFrame(() => inputRef.current?.focus()); }, []);

  // Load who the viewer follows (once).
  useEffect(() => {
    if (!user) { setFollowingIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);
      if (cancelled) return;
      setFollowingIds(new Set((data ?? []).map((r: { following_id: string }) => r.following_id)));
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load the discovery feed — popular directors + trending reels. Runs
  // once on mount; the idle state reads from it without re-querying.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDiscoverLoading(true);
      try {
        const [peopleRes, reelsRes] = await Promise.all([
          supabase
            .from("find_friends_directory" as never)
            .select("id, display_name, avatar_url, tagline, location, bio")
            .order("profile_view_count", { ascending: false })
            .limit(12),
          supabase
            .from("published_reels" as never)
            .select("id, title, thumbnail_url, world_slug, play_count, creator_id")
            .eq("is_taken_down", false)
            .order("play_count", { ascending: false })
            .limit(8),
        ]);
        if (cancelled) return;

        const people = ((peopleRes.data ?? []) as unknown as Array<{
          id: string; display_name: string | null; avatar_url: string | null;
          tagline: string | null; location: string | null; bio: string | null;
        }>)
          .filter((p) => p.id !== user?.id)
          .slice(0, 8)
          .map((p) => ({ ...p, follower_count: 0, reel_count: 0 }));
        setDiscoverPeople(people);

        const reels = (reelsRes.data ?? []) as unknown as ReelHit[];
        // Enrich with creator name/avatar in one batched lookup.
        const ids = Array.from(new Set(reels.map((r) => r.creator_id)));
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles_public" as never)
            .select("id, display_name, avatar_url")
            .in("id", ids);
          if (cancelled) return;
          const pmap = new Map(
            ((profs ?? []) as unknown as Array<{ id: string; display_name: string | null; avatar_url: string | null }>)
              .map((p) => [p.id, p]),
          );
          setDiscoverReels(reels.map((r) => ({
            ...r,
            creator_name: pmap.get(r.creator_id)?.display_name ?? null,
            creator_avatar: pmap.get(r.creator_id)?.avatar_url ?? null,
          })));
        } else {
          setDiscoverReels(reels);
        }
      } catch (e) {
        console.warn("[Search] discovery feed failed (DB may not be migrated yet)", e);
        if (!cancelled) { setDiscoverPeople([]); setDiscoverReels([]); }
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Debounced query → search_everything.
  useEffect(() => {
    const t = setTimeout(async () => {
      const query = q.trim();
      if (!query) { setResults({ reels: [], creators: [] }); return; }
      setLoading(true);
      // First-party search analytics — capture the query regardless of result-RPC success.
      track("search", { query });
      try {
        const { data, error } = await supabase.rpc("search_everything" as never, {
          p_query: query, p_limit: 12,
        } as never);
        if (error) throw error;
        const payload = (data as unknown as { reels?: ReelHit[]; creators?: CreatorHit[] }) ?? {};
        setResults({
          reels: payload.reels ?? [],
          creators: payload.creators ?? [],
        });
      } catch (e) {
        console.warn("[Search] failed (DB may not be migrated yet)", e);
        setResults({ reels: [], creators: [] });
      } finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  // Keep the URL in sync (shareable links).
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim()); else next.delete("q");
    if (tab !== "all") next.set("tab", tab); else next.delete("tab");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  const totals = useMemo(() => ({
    reels: results.reels.length,
    creators: results.creators.length,
    total: results.reels.length + results.creators.length,
  }), [results]);

  const showBucket = useCallback((b: "reels" | "people") => {
    if (tab === "all") return true;
    if (tab === "reels") return b === "reels";
    if (tab === "people") return b === "people";
    return false;
  }, [tab]);

  const hasQuery = q.trim().length > 0;

  return (
    <div className="relative min-h-screen flex flex-col">
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Discovery"
          title="Discover"
          accent="everything."
          subtitle="Find directors to follow and reels to watch. Type a name, a vibe, or an idea — or just browse what's trending tonight."
          status={["Index", "Rank", "Open"]}
          subhead={hasQuery ? `${totals.total} hits` : undefined}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as Tab)} layoutId="search-tab" />
        </StudioHero>

        {/* Search field — cinematic, with an aurora glow that blooms on focus */}
        <section className="relative mb-10">
          <div className="group relative">
            {/* Aurora glow behind the field — quiet at rest, blooms on focus */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-[2px] rounded-[20px] opacity-40 blur-xl transition-opacity duration-500 group-focus-within:opacity-100"
              style={{
                background:
                  "linear-gradient(110deg, hsla(200,95%,55%,0.35), hsla(265,85%,60%,0.30) 50%, hsla(200,95%,55%,0.35))",
              }}
            />
            <div className="relative">
              <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-accent" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for a reel or director…"
                className="relative w-full h-16 pl-14 pr-12 rounded-2xl border border-white/[0.08] bg-[hsl(220_30%_7%/0.85)] focus:border-white/20 text-[18px] text-foreground placeholder:text-muted-foreground outline-none transition-colors backdrop-blur-xl"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-white/[0.08] hover:border-white/30 text-foreground/55 hover:text-foreground flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-muted-foreground/70 mr-2">Try:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className={cn(
                  "px-3 h-8 rounded-full border text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
                  q.trim().toLowerCase() === s
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-white/[0.08] hover:border-white/30 text-foreground/65 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Body */}
        {!hasQuery ? (
          <DiscoveryFeed
            people={discoverPeople}
            reels={discoverReels}
            loading={discoverLoading}
            tab={tab}
            followingIds={followingIds}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Spinner size="md" tone="muted" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Sifting…</span>
          </div>
        ) : totals.total === 0 ? (
          <NoResults q={q} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-12"
            >
              {showBucket("people") && results.creators.length > 0 && (
                <section>
                  <SectionLabel label="Directors" meta={`${totals.creators} hits`} icon={Users} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {results.creators.map((c) => (
                      <PersonCard
                        key={c.id}
                        id={c.id}
                        name={c.display_name}
                        avatar={c.avatar_url}
                        tagline={c.tagline}
                        meta={[
                          c.location,
                          `${c.follower_count.toLocaleString()} followers`,
                          `${c.reel_count.toLocaleString()} reels`,
                        ].filter(Boolean).join(" · ")}
                        following={followingIds.has(c.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showBucket("reels") && results.reels.length > 0 && (
                <section>
                  <SectionLabel label="Reels" meta={`${totals.reels} hits`} icon={Film} />
                  <ReelGrid reels={results.reels} />
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </PageShell>
    </div>
  );
}

// ── Discovery feed (idle state) ──────────────────────────────────────────────
function DiscoveryFeed({
  people, reels, loading, tab, followingIds,
}: {
  people: CreatorHit[];
  reels: ReelHit[];
  loading: boolean;
  tab: Tab;
  followingIds: Set<string>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
        <Spinner size="md" tone="muted" />
        <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Curating…</span>
      </div>
    );
  }

  const showPeople = (tab === "all" || tab === "people") && people.length > 0;
  const showReels = (tab === "all" || tab === "reels") && reels.length > 0;

  if (!showPeople && !showReels) return <EmptySearchHint />;

  return (
    <div className="space-y-14">
      {showPeople && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <SectionLabel label="People to follow" meta="Active directors" icon={Sparkles} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {people.map((p) => (
              <PersonCard
                key={p.id}
                id={p.id}
                name={p.display_name}
                avatar={p.avatar_url}
                tagline={p.tagline}
                meta={p.location ?? undefined}
                following={followingIds.has(p.id)}
              />
            ))}
          </div>
        </motion.section>
      )}

      {showReels && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <SectionLabel label="Videos to watch" meta="Trending now" icon={TrendingUp} />
          <ReelGrid reels={reels} />
        </motion.section>
      )}
    </div>
  );
}

// ── Reel grid + card ─────────────────────────────────────────────────────────
function ReelGrid({ reels }: { reels: ReelHit[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {reels.map((r) => (
        <Link
          key={r.id}
          to={`/r/${r.id}`}
          className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors"
        >
          <div className="aspect-video bg-black/40 relative">
            {r.thumbnail_url && (
              <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            {/* Play affordance on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/20">
                <Play className="w-4 h-4 text-white translate-x-px" fill="currentColor" />
              </span>
            </div>
            <div className="absolute bottom-3 left-3 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85">
              <Eye className="w-3 h-3 inline mr-1" />
              {r.play_count.toLocaleString()}
            </div>
            {r.world_slug && (
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] border border-white/[0.10] bg-black/45 backdrop-blur-md text-white/85">
                {r.world_slug}
              </div>
            )}
          </div>
          <div className="p-3">
            <div className="text-[13px] text-foreground truncate">{r.title}</div>
            {r.creator_name && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/75 truncate">
                {r.creator_avatar ? (
                  <img src={r.creator_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-glass-hover inline-flex items-center justify-center text-[8px] font-mono text-muted-foreground">
                    {(r.creator_name?.[0] ?? "?").toUpperCase()}
                  </span>
                )}
                <span className="truncate">{r.creator_name}</span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Person card + follow button ──────────────────────────────────────────────
function PersonCard({
  id, name, avatar, tagline, meta, following,
}: {
  id: string;
  name: string | null;
  avatar: string | null;
  tagline?: string | null;
  meta?: string;
  following: boolean;
}) {
  return (
    <div className="group relative flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 p-4 transition-colors">
      <Link to={`/c/${id}`} className="flex items-start gap-3 min-w-0 flex-1">
        {avatar ? (
          <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-white/[0.06] shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-glass-hover flex items-center justify-center text-muted-foreground font-mono shrink-0">
            {(name?.[0] || "?").toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] text-foreground truncate">{name ?? "Anonymous"}</div>
          {tagline && (
            <div className="text-[12px] text-foreground/65 truncate italic" style={{ fontFamily: "'Fraunces', serif" }}>
              {tagline}
            </div>
          )}
          {meta && (
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-1 truncate flex items-center gap-1">
              {!meta.includes("·") && <MapPin className="w-2.5 h-2.5 opacity-60 shrink-0" />}
              <span className="truncate">{meta}</span>
            </div>
          )}
        </div>
      </Link>
      <FollowButton creatorId={id} initialFollowing={following} />
    </div>
  );
}

function FollowButton({ creatorId, initialFollowing }: { creatorId: string; initialFollowing: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { followUser, unfollowUser } = useSocial();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  // Keep in sync if the parent's known set changes after mount.
  useEffect(() => { setFollowing(initialFollowing); }, [initialFollowing]);

  // Can't follow yourself.
  if (user && user.id === creatorId) {
    return (
      <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/50 self-center">
        You
      </span>
    );
  }

  const toggle = async () => {
    if (!user) { navigate("/auth"); return; }
    if (busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next); // optimistic
    try {
      if (next) await followUser.mutateAsync(creatorId);
      else await unfollowUser.mutateAsync(creatorId);
    } catch {
      setFollowing(!next); // revert
      toast.error("Couldn't update follow — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={following ? `Unfollow ${creatorId}` : `Follow ${creatorId}`}
      className={cn(
        "shrink-0 self-center inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] transition-colors disabled:opacity-60",
        following
          ? "border border-white/[0.08] text-foreground/70 hover:border-rose-300/40 hover:text-rose-200"
          : "border border-primary/40 bg-primary/10 text-foreground hover:bg-primary/20",
      )}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : following ? (
        <UserCheck className="w-3 h-3" />
      ) : (
        <UserPlus className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">{following ? "Following" : "Follow"}</span>
    </button>
  );
}

// ── Small bits ───────────────────────────────────────────────────────────────
function SectionLabel({ label, meta, icon: Icon }: { label: string; meta?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function EmptySearchHint() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <SearchIcon className="w-6 h-6 mx-auto mb-5 text-muted-foreground" />
      <h2 className="font-display font-medium text-[clamp(1.5rem,3.2vw,2.2rem)] tracking-[-0.02em] text-foreground mb-2">
        What do you want to watch tonight?
      </h2>
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Try a title, a director, or a vibe. Small Bridges searches reels and directors in one query.
      </p>
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="text-center py-20 max-w-md mx-auto">
      <Wand2 className="w-6 h-6 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-display font-medium text-[22px] text-foreground mb-2">
        Nothing for &ldquo;{q}&rdquo; — yet.
      </h3>
      <p className="text-muted-foreground text-[13px] mb-6">
        Be the first to make something here.
      </p>
      <Link
        to="/studio"
        className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
        style={{
          background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
          boxShadow: "0 0 18px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
        }}
      >
        <Wand2 className="w-3.5 h-3.5" />Make it
      </Link>
    </div>
  );
}
