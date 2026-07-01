/**
 * Discover — /discover  (PUBLIC, indexable)
 *
 * A logged-out-accessible showcase of public reels — the community-as-growth
 * surface (the Midjourney/gallery loop). Every card links to /r/:id, which is
 * itself public with a rich share card + signup CTA. Read-only: it only ever
 * shows `published_reels` rows (anon RLS: is_taken_down = false), so no private
 * data is exposed. Crawlable <a href> links + per-page meta feed SEO; the reel
 * pages it links to get crawled from here.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { GlassPanel, GlassButton } from "@/components/foundation/Floating";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { EASE_PREMIUM, TYPE_EYEBROW, TYPE_META } from "@/lib/design-system";

interface DiscoverReel {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  play_count: number | null;
  creator_id: string;
  creator_name?: string | null;
}

export default function Discover() {
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const [reels, setReels] = useState<DiscoverReel[]>([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({
    title: "Discover — cinematic AI films made from a single prompt · Small Bridges",
    description:
      "Browse films the Small Bridges community made from a single prompt — consistent characters, real locations, and sound. Make your own free.",
    canonicalPath: "/discover",
    ogImage: "https://smallbridges.co/og-image.webp",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("published_reels" as never)
          .select("id, title, thumbnail_url, play_count, creator_id")
          .eq("is_taken_down", false)
          .order("play_count", { ascending: false })
          .limit(36);
        let rows = (data ?? []) as DiscoverReel[];
        // Decorate with creator display names (RLS-safe public view).
        const ids = Array.from(new Set(rows.map((r) => r.creator_id))).filter(Boolean);
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles_public" as never)
            .select("id, display_name")
            .in("id", ids);
          const byId = new Map(
            ((profs ?? []) as Array<{ id: string; display_name: string | null }>).map((p) => [p.id, p.display_name]),
          );
          rows = rows.map((r) => ({ ...r, creator_name: byId.get(r.creator_id) ?? null }));
        }
        if (!cancelled) {
          setReels(rows.filter((r) => r.thumbnail_url));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const makeHref = user ? "/studio" : "/auth?mode=signup";

  const hero = useMemo(
    () => (
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_PREMIUM }}
        className="mx-auto max-w-2xl text-center"
      >
        <span className={cn(TYPE_EYEBROW, "text-accent")}>
          <Sparkles className="mr-1.5 inline h-3 w-3" strokeWidth={1.5} /> Discover
        </span>
        <h1 className="mt-4 font-display text-4xl font-light tracking-tight text-foreground md:text-5xl">
          Films made from a single prompt.
        </h1>
        <p className={cn(TYPE_META, "mx-auto mt-4 max-w-md text-muted-foreground/70")}>
          Real films the community made on Small Bridges — consistent characters,
          real locations, and sound. Your first 5-second clip is free.
        </p>
        <Link to={makeHref} className="mt-7 inline-block">
          <GlassButton tone="accent" ariaLabel="Make your own free">
            <span>Make your own — free</span>
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </GlassButton>
        </Link>
      </motion.div>
    ),
    [reducedMotion, makeHref],
  );

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-24 pt-12 sm:px-6 lg:px-10">
        {hero}

        <div className="mt-14">
          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent" strokeWidth={1.5} />
            </div>
          ) : reels.length === 0 ? (
            <p className={cn(TYPE_META, "text-center text-muted-foreground/60")}>
              No public films yet — be the first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {reels.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_PREMIUM, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Link to={`/r/${r.id}`} aria-label={r.title || "Watch this film"} className="group block">
                    <GlassPanel className="overflow-hidden !p-0">
                      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black/40">
                        {r.thumbnail_url && (
                          <img
                            src={r.thumbnail_url}
                            alt={r.title || "AI film"}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="rounded-full bg-white/15 p-3 backdrop-blur-sm">
                            <Play className="h-5 w-5 text-white" strokeWidth={1.5} fill="currentColor" />
                          </div>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-3">
                          <p className="line-clamp-1 text-[13px] font-medium text-white">
                            {r.title || "Untitled film"}
                          </p>
                          {r.creator_name && (
                            <p className="line-clamp-1 text-[11px] text-white/60">
                              {r.creator_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </GlassPanel>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FoundationShell>
  );
}
