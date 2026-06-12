/**
 * Creators — /creators
 *
 * Hub-native directory: lists creators by their entertainment-hub footprint
 * (published_reels, follows, reel_likes). The previous version of this
 * page hit the legacy parallel social tables (movie_projects.is_public,
 * user_follows, video_likes) — Domain 2/9 audit Finding A. This rewrite
 * lifts the page onto the same data the Lobby / Theater / CreatorChannel
 * use, so a follow tapped here moves the same counter the Theater shows.
 *
 * Three rails:
 *   • Trending — creators ordered by play_count across reels in last 30d.
 *   • Most followed — straight follower count.
 *   • New voices — creators who first published in the last 14 days.
 *
 * Search debounces against display_name / full_name / email via the
 * `search_everything` RPC so this page behaves identically to /search.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users as UsersIcon, Eye, Heart, Wand2, Search as SearchIcon,
  ArrowRight, UserPlus, UserCheck, Flame, Compass, Sparkles, X,
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

interface CreatorRow {
  creator_id: string;
  display_name: string | null;
  avatar_url: string | null;
  reel_count: number;
  total_plays: number;
  total_likes: number;
  follower_count: number;
  latest_reel_at: string | null;
  latest_thumbnail: string | null;
}

interface SearchHitCreator {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  reel_count: number;
}

type TabKey = "trending" | "most_followed" | "new_voices";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "trending",      label: "Trending",      icon: Flame },
  { key: "most_followed", label: "Most followed", icon: UsersIcon },
  { key: "new_voices",    label: "New voices",    icon: Sparkles },
];

const PAGE_SIZE = 60;

export default function Creators() {
  usePageMeta({
    title: "Creators — Small Bridges",
    description: "Discover directors publishing into the worlds you watch.",
  });
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [tab, setTab] = useState<TabKey>("trending");
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHitCreator[]>([]);
  const [searching, setSearching] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  // Pull reels from the active window, then aggregate by creator client-side.
  // At beta scale (~hundreds of reels) this is cheap. At scale, move to a
  // SQL view + RPC.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - (tab === "new_voices" ? 14 : 30));

      const { data: reels, error } = await supabase
        .from("published_reels")
        .select("creator_id, play_count, like_count, thumbnail_url, created_at")
        .eq("is_taken_down", false)
        .gte("created_at", tab === "most_followed" ? new Date(0).toISOString() : since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const list = (reels ?? []) as Array<{
        creator_id: string;
        play_count: number;
        like_count: number;
        thumbnail_url: string | null;
        created_at: string;
      }>;

      const map = new Map<string, CreatorRow>();
      for (const r of list) {
        const entry = map.get(r.creator_id) ?? {
          creator_id: r.creator_id,
          display_name: null,
          avatar_url: null,
          reel_count: 0,
          total_plays: 0,
          total_likes: 0,
          follower_count: 0,
          latest_reel_at: null,
          latest_thumbnail: null,
        };
        entry.reel_count += 1;
        entry.total_plays += r.play_count ?? 0;
        entry.total_likes += r.like_count ?? 0;
        if (!entry.latest_reel_at || new Date(r.created_at) > new Date(entry.latest_reel_at)) {
          entry.latest_reel_at = r.created_at;
          entry.latest_thumbnail = r.thumbnail_url;
        }
        map.set(r.creator_id, entry);
      }

      const creatorIds = Array.from(map.keys());
      if (creatorIds.length === 0) { setRows([]); setLoading(false); return; }

      // Profile join in one batch.
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, avatar_url, email")
        .in("id", creatorIds);
      for (const p of (profiles ?? []) as Array<{
        id: string; display_name: string | null; full_name: string | null;
        avatar_url: string | null; email: string | null;
      }>) {
        const entry = map.get(p.id);
        if (!entry) continue;
        entry.display_name = p.display_name ?? p.full_name ?? (p.email ? p.email.split("@")[0] : null);
        entry.avatar_url = p.avatar_url;
      }

      // Follower counts in one batch.
      const { data: follows } = await supabase
        .from("follows")
        .select("followed_id")
        .in("followed_id", creatorIds);
      const followerMap = new Map<string, number>();
      for (const f of (follows ?? []) as Array<{ followed_id: string }>) {
        followerMap.set(f.followed_id, (followerMap.get(f.followed_id) ?? 0) + 1);
      }
      for (const [id, count] of followerMap) {
        const entry = map.get(id);
        if (entry) entry.follower_count = count;
      }

      // Viewer's existing follows (so we paint the Following state correctly).
      if (user) {
        const { data: viewerFollows } = await supabase
          .from("follows")
          .select("followed_id")
          .eq("follower_id", user.id)
          .in("followed_id", creatorIds);
        const set = new Set<string>();
        for (const f of (viewerFollows ?? []) as Array<{ followed_id: string }>) set.add(f.followed_id);
        setFollowing(set);
      } else {
        setFollowing(new Set());
      }

      const arr = Array.from(map.values());
      if (tab === "trending") {
        arr.sort((a, b) => b.total_plays - a.total_plays);
      } else if (tab === "most_followed") {
        arr.sort((a, b) => b.follower_count - a.follower_count);
      } else {
        arr.sort((a, b) => new Date(b.latest_reel_at ?? 0).getTime() - new Date(a.latest_reel_at ?? 0).getTime());
      }
      setRows(arr.slice(0, PAGE_SIZE));
    } catch (e) {
      console.warn("[Creators] load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => { void load(); }, [load]);

  // Search via search_everything RPC (creators bucket only here).
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length === 0) { setSearchHits([]); return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.rpc("search_everything" as never, {
          p_query: q, p_limit: 24,
        } as never);
        if (error) throw error;
        if (cancelled) return;
        const payload = data as unknown as { creators?: SearchHitCreator[] };
        setSearchHits(payload.creators ?? []);
      } catch (e) {
        console.warn("[Creators] search failed", e);
        setSearchHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [searchQuery]);

  const toggleFollow = async (creatorId: string) => {
    if (!user) { navigate("/auth"); return; }
    const was = following.has(creatorId);
    setFollowing((prev) => {
      const next = new Set(prev);
      if (was) next.delete(creatorId); else next.add(creatorId);
      return next;
    });
    try {
      const { data, error } = await supabase.rpc("toggle_follow" as never, {
        p_target: creatorId,
      } as never);
      if (error) throw error;
      const out = data as unknown as { following: boolean };
      setFollowing((prev) => {
        const next = new Set(prev);
        if (out.following) next.add(creatorId); else next.delete(creatorId);
        return next;
      });
      toast.success(out.following ? "Following" : "Unfollowed");
    } catch (e) {
      setFollowing((prev) => {
        const next = new Set(prev);
        if (was) next.add(creatorId); else next.delete(creatorId);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Couldn't follow");
    }
  };

  const visible = useMemo<CreatorRow[]>(() => {
    if (searchQuery.trim().length === 0) return rows;
    return searchHits.map((h) => ({
      creator_id: h.id,
      display_name: h.display_name,
      avatar_url: h.avatar_url,
      reel_count: h.reel_count,
      total_plays: 0,
      total_likes: 0,
      follower_count: h.follower_count,
      latest_reel_at: null,
      latest_thumbnail: null,
    }));
  }, [rows, searchHits, searchQuery]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora intensity="subtle" />
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Creators"
          title="Find"
          accent="your director."
          subtitle="Watch what they're publishing, remix their reels, follow the ones that move you."
          status={["Live", "Public", "Trending"]}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} layoutId="creators-tab" />
        </StudioHero>

        {/* Search */}
        <div className="mb-8 relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search directors by name…"
            className="w-full h-12 pl-11 pr-12 rounded-2xl bg-glass border border-white/[0.06] focus:border-primary/40 outline-none text-[13px] text-white placeholder:text-white/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-white/[0.08] hover:border-white/30 flex items-center justify-center text-white/55 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {(loading && rows.length === 0) || searching ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Spinner size="md" tone="muted" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">
              {searching ? "Searching…" : "Pulling the directory…"}
            </span>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <Compass className="w-7 h-7 mx-auto mb-4 text-white/45" />
            <h3 className="font-display font-medium text-[22px] text-white mb-2">
              {searchQuery ? "No creators match that search." : "No creators in this view yet."}
            </h3>
            <p className="text-[12px] text-white/45 leading-relaxed">
              {searchQuery ? "Try a different name." : "Once directors start publishing, you'll see them here."}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={searchQuery ? "search" : tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-16"
            >
              {visible.map((c) => (
                <CreatorTile
                  key={c.creator_id}
                  creator={c}
                  isFollowing={following.has(c.creator_id)}
                  onToggleFollow={() => toggleFollow(c.creator_id)}
                  isSelf={user?.id === c.creator_id}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </PageShell>
    </div>
  );
}

function CreatorTile({
  creator, isFollowing, onToggleFollow, isSelf,
}: {
  creator: CreatorRow;
  isFollowing: boolean;
  onToggleFollow: () => void;
  isSelf: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 transition-colors overflow-hidden">
      <Link to={`/c/${creator.creator_id}`} className="block">
        <div className="relative aspect-video bg-black/40">
          {creator.latest_thumbnail ? (
            <img src={creator.latest_thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 50% 50%, hsla(213 100% 60% / 0.18), transparent 65%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>
      </Link>
      <div className="p-4">
        <Link to={`/c/${creator.creator_id}`} className="flex items-center gap-3 group/name">
          {creator.avatar_url ? (
            <img src={creator.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-white/[0.08]" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-glass-hover border border-white/[0.08] flex items-center justify-center text-[12px] font-mono text-white/55">
              {(creator.display_name?.[0] || "?").toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-white font-light truncate group-hover/name:underline underline-offset-2">
              {creator.display_name ?? "Anonymous director"}
            </div>
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-[0.22em]">
              {creator.follower_count.toLocaleString()} followers
            </div>
          </div>
        </Link>

        <div className="mt-3 flex items-center gap-3 text-[10px] font-mono text-white/45">
          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{creator.total_plays.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{creator.total_likes.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1"><Wand2 className="w-3 h-3" />{creator.reel_count} reels</span>
        </div>

        {!isSelf && (
          <button
            onClick={onToggleFollow}
            className={cn(
              "mt-3 w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full border text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
              isFollowing
                ? "border-white/15 text-white/75 hover:border-rose-300/40 hover:text-rose-200"
                : "border-white/30 text-white hover:bg-white/10",
            )}
          >
            {isFollowing ? <><UserCheck className="w-3 h-3" />Following</> : <><UserPlus className="w-3 h-3" />Follow</>}
            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
}
