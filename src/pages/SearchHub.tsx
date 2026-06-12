/**
 * SearchHub — /search?q=
 *
 * Universal discovery. Same Small Bridges identity (PageShell + AppShell wrapper +
 * StudioAurora + StudioHero). Server-debounced via the `search_everything`
 * RPC. URL `?q=` is the source of truth so links are shareable.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search as SearchIcon, X, Film, Users, Globe, Crown, ArrowRight,
  Eye, Wand2, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";

interface ReelHit {
  id: string;
  title: string;
  thumbnail_url: string | null;
  world_slug: string | null;
  play_count: number;
  creator_id: string;
}
interface CreatorHit {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  reel_count: number;
}
interface UniverseHit { id: string; name: string; description: string | null }
interface CrewHit {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  member_count: number;
}
interface SearchPayload {
  reels: ReelHit[];
  creators: CreatorHit[];
  universes: UniverseHit[];
  crews: CrewHit[];
}

type Tab = "all" | "reels" | "creators" | "universes" | "crews";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "all",       label: "All",       icon: Sparkles },
  { key: "reels",     label: "Reels",     icon: Film },
  { key: "creators",  label: "Directors", icon: Users },
  { key: "universes", label: "Universes", icon: Globe },
  { key: "crews",     label: "Crews",     icon: Crown },
];

const SUGGESTIONS = ["noir", "robot", "moon", "comedy", "daft", "rain", "neon"];

export default function SearchHub() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<SearchPayload>({ reels: [], creators: [], universes: [], crews: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  usePageMeta({
    title: q ? `“${q}” — Search · Small Bridges` : "Search · Small Bridges",
    description: "Search reels, creators, universes, and crews across Small Bridges.",
  });

  useEffect(() => { requestAnimationFrame(() => inputRef.current?.focus()); }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const query = q.trim();
      if (!query) { setResults({ reels: [], creators: [], universes: [], crews: [] }); return; }
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("search_everything" as never, {
          p_query: query, p_limit: 12,
        } as never);
        if (error) throw error;
        setResults((data as unknown as SearchPayload) ?? { reels: [], creators: [], universes: [], crews: [] });
      } catch (e) {
        console.warn("[Search] failed (DB may not be migrated yet)", e);
        setResults({ reels: [], creators: [], universes: [], crews: [] });
      } finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim()); else next.delete("q");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const totals = useMemo(() => ({
    reels: results.reels.length,
    creators: results.creators.length,
    universes: results.universes.length,
    crews: results.crews.length,
    total: results.reels.length + results.creators.length + results.universes.length + results.crews.length,
  }), [results]);

  const showBucket = useCallback((b: Tab) => tab === "all" || tab === b, [tab]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora intensity="subtle" />
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Discovery"
          title="Find"
          accent="anything."
          subtitle="Reels, directors, universes, and crews — one query, four buckets, instant results. Type a vibe, a name, or an idea."
          status={["Index", "Rank", "Open"]}
          subhead={q ? `${totals.total} hits` : undefined}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as Tab)} layoutId="search-tab" />
        </StudioHero>

        {/* Search field */}
        <section className="relative mb-10">
          <div className="relative">
            <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for a reel, director, universe, or crew…"
              className="w-full h-16 pl-14 pr-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] focus:bg-white/[0.04] focus:border-white/20 text-[18px] text-foreground placeholder:text-muted-foreground outline-none transition-colors"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-white/[0.08] hover:border-white/30 text-foreground/55 hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!q && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-muted-foreground/70 mr-2">Try:</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQ(s)}
                  className="px-3 h-8 rounded-full border border-white/[0.08] hover:border-white/30 text-[11px] font-mono uppercase tracking-[0.22em] text-foreground/65 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Body */}
        {!q ? (
          <EmptySearchHint />
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
              {showBucket("reels") && results.reels.length > 0 && (
                <section>
                  <SectionLabel label="Reels" meta={`${totals.reels} hits`} icon={Film} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {results.reels.map((r) => (
                      <Link key={r.id} to={`/watch/${r.id}`} className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors">
                        <div className="aspect-video bg-black/40 relative">
                          {r.thumbnail_url && <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
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
                        <div className="p-3 text-[13px] text-foreground truncate">{r.title}</div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {showBucket("creators") && results.creators.length > 0 && (
                <section>
                  <SectionLabel label="Directors" meta={`${totals.creators} hits`} icon={Users} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {results.creators.map((c) => (
                      <Link key={c.id} to={`/c/${c.id}`} className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 p-4 transition-colors">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-white/[0.06]" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center text-muted-foreground font-mono">
                            {(c.display_name?.[0] || "?").toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] text-foreground truncate">{c.display_name ?? "Anonymous"}</div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                            {c.follower_count.toLocaleString()} followers · {c.reel_count.toLocaleString()} reels
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {showBucket("universes") && results.universes.length > 0 && (
                <section>
                  <SectionLabel label="Universes" meta={`${totals.universes} hits`} icon={Globe} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {results.universes.map((u) => (
                      <Link key={u.id} to={`/universe/${u.id}`} className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 p-5 transition-colors">
                        <Sparkles className="w-4 h-4 text-muted-foreground mb-3" />
                        <div className="text-[15px] text-foreground font-light truncate">{u.name}</div>
                        {u.description && <p className="text-[12px] text-muted-foreground mt-2 line-clamp-2">{u.description}</p>}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {showBucket("crews") && results.crews.length > 0 && (
                <section>
                  <SectionLabel label="Crews" meta={`${totals.crews} hits`} icon={Crown} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {results.crews.map((c) => (
                      <Link key={c.id} to={`/crews/${c.id}`} className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 p-4 transition-colors">
                        <div className="text-[14px] text-foreground truncate">{c.name}</div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground mb-2">/{c.slug} · {c.member_count} members</div>
                        {c.description && <p className="text-[12px] text-muted-foreground line-clamp-2">{c.description}</p>}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </PageShell>
    </div>
  );
}

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
        Try a title, a director, or a vibe. Small Bridges searches reels, channels, universes, and crews in one query.
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
        to="/create"
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
