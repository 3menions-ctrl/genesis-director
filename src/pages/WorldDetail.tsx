/**
 * WorldDetail — /world/:slug
 *
 * A themed deep-dive into one Channel World. The chrome inherits the world's
 * accent color (via HubShell) so browsing Noir actually feels different from
 * browsing Sci-Fi. Composes:
 *
 *   • Hero — world manifesto, glyph, accent-tinted background, featured reel
 *     auto-playing as the visual focus.
 *   • Trending now — sorted by recency
 *   • Most played — sorted by play_count
 *   • Most remixed — sorted by remix_count (the editorial signal of
 *     "this one keeps starting conversations")
 *
 * All three rails share the same `lobby_feed` RPC narrowed to the world.
 * Sorting happens client-side off the same payload.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Play, Flame, Eye, Heart, Wand2, ArrowRight, Sparkles, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/shell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";

interface World {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accent_hsl: string;
  glyph: string | null;
}

interface Reel {
  id: string;
  title: string;
  synopsis: string | null;
  video_url: string;
  thumbnail_url: string | null;
  play_count: number;
  like_count: number;
  remix_count: number;
  is_featured: boolean;
  created_at: string;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
  world_glyph: string | null;
  world_accent: string | null;
}

export default function WorldDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [world, setWorld] = useState<World | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({
    title: world?.name ? `${world.name} · Small Bridges` : "Channel world · Small Bridges",
    description: world?.description ?? "A themed channel on Small Bridges.",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [worldRes, feedRes] = await Promise.all([
        supabase.from("channel_worlds").select("*").eq("slug", slug).maybeSingle(),
        supabase.rpc("lobby_feed" as never, {
          p_world_slug: slug, p_cursor: null, p_limit: 60,
        } as never),
      ]);
      setWorld((worldRes.data as World) ?? null);
      const list = ((feedRes as { data?: unknown }).data as Reel[]) ?? [];
      setReels(list);
    } catch (e) {
      console.error("[WorldDetail] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const featured = useMemo(() => reels.find((r) => r.is_featured) ?? reels[0] ?? null, [reels]);
  const mostPlayed = useMemo(() => [...reels].sort((a, b) => b.play_count - a.play_count).slice(0, 12), [reels]);
  const mostRemixed = useMemo(() => [...reels].sort((a, b) => b.remix_count - a.remix_count).slice(0, 12), [reels]);

  const accent = world?.accent_hsl ?? "213 100% 60%";

  return (
    <div className="relative min-h-screen flex flex-col">
      <PageShell width="wide" pad>
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-white/55">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Tuning the world…</span>
        </div>
      ) : !world ? (
        <div className="text-center py-24 max-w-md mx-auto">
          <Sparkles className="w-6 h-6 mx-auto mb-4 text-white/45" />
          <h2 className="font-display font-medium text-[26px] text-white mb-2">World not found.</h2>
          <p className="text-white/45 text-[13px] mb-6">Try one of the others.</p>
          <Link to="/lobby" className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            Back to Lobby <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <>
          {/* HERO */}
          <section className="relative rounded-3xl overflow-hidden border border-white/[0.06] mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-0">
              {/* Left — manifesto */}
              <div className="p-8 lg:p-12 flex flex-col justify-between gap-8 min-h-[460px] relative">
                <div
                  aria-hidden
                  className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full pointer-events-none opacity-70"
                  style={{ background: `radial-gradient(circle, hsla(${accent} / 0.20), transparent 65%)`, filter: "blur(70px)" }}
                />
                <div className="relative">
                  <div
                    className="text-[80px] leading-none mb-6"
                    style={{ color: `hsl(${accent})`, textShadow: `0 0 32px hsla(${accent} / 0.5)` }}
                  >
                    {world.glyph ?? "✦"}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.32em] mb-3" style={{ color: `hsl(${accent})` }}>
                    Channel world
                  </div>
                  <h1
                    className="font-display font-light text-[44px] lg:text-[64px] leading-[1.0] tracking-tight text-white"
                  >
                    {world.name}
                  </h1>
                  {world.description && (
                    <p className="text-white/65 text-[16px] mt-5 leading-relaxed max-w-md">{world.description}</p>
                  )}
                </div>
                <div className="relative flex flex-wrap items-center gap-3">
                  <Link
                    to="/auth?mode=signup"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
                  >
                    <Wand2 className="w-3.5 h-3.5" />Direct a {world.name.toLowerCase()} scene
                  </Link>
                  <Link
                    to="/lobby"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
                  >
                    <ArrowLeft className="w-3 h-3" />All worlds
                  </Link>
                </div>
              </div>

              {/* Right — featured reel */}
              <div className="relative bg-black/60 min-h-[460px]">
                {featured?.video_url ? (
                  <Link to={`/watch/${featured.id}`} className="absolute inset-0 group">
                    <video
                      src={featured.video_url}
                      poster={featured.thumbnail_url ?? undefined}
                      autoPlay muted loop playsInline preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="text-[10px] font-mono uppercase tracking-[0.32em] mb-1.5" style={{ color: `hsl(${accent})` }}>
                        Featured tonight
                      </div>
                      <div className="text-[20px] text-white font-light truncate">{featured.title}</div>
                      <div className="mt-2 text-[10px] text-white/55 font-mono uppercase tracking-[0.22em]">
                        by {featured.creator_name ?? "Anonymous"}
                      </div>
                    </div>
                    <div className="absolute top-6 right-6 inline-flex items-center gap-2 px-3 h-9 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.08] text-[11px] font-mono uppercase tracking-[0.22em] text-white/85">
                      <Play className="w-3 h-3" />Open theater
                    </div>
                  </Link>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/35">
                    <div className="text-center max-w-sm">
                      <Sparkles className="w-7 h-7 mx-auto mb-3" style={{ color: `hsl(${accent})` }} />
                      <div className="text-[14px]">No reels in {world.name} yet.</div>
                      <div className="text-[11px] text-white/30 mt-1">Be first. Take this world.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* TRENDING NOW */}
          <SectionLabel label="Trending now" icon={Flame} meta={reels.length + " reels"} />
          {reels.length === 0 ? (
            <div className="text-center py-12 text-white/45 text-[13px] mb-12">No reels published in {world.name} yet.</div>
          ) : (
            <Rail reels={reels.slice(0, 12)} accent={accent} />
          )}

          {/* MOST PLAYED */}
          {mostPlayed.length > 0 && (
            <>
              <SectionLabel label="Most played" icon={Eye} meta={mostPlayed.length + " in rotation"} />
              <Rail reels={mostPlayed} accent={accent} />
            </>
          )}

          {/* MOST REMIXED */}
          {mostRemixed.filter((r) => r.remix_count > 0).length > 0 && (
            <>
              <SectionLabel label="Most remixed · conversation starters" icon={Wand2} meta="fork these" />
              <Rail reels={mostRemixed.filter((r) => r.remix_count > 0)} accent={accent} />
            </>
          )}
        </>
      )}
      </PageShell>
    </div>
  );
}

function SectionLabel({ label, icon: Icon, meta }: { label: string; icon: React.ElementType; meta?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function Rail({ reels, accent }: { reels: Reel[]; accent: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
      {reels.map((r) => (
        <Link
          key={r.id}
          to={`/watch/${r.id}`}
          className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors"
        >
          <div className="aspect-video bg-black/40 relative">
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : null}
            {r.is_featured && (
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] bg-white text-black">
                featured
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/75">
              <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{r.play_count.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{r.like_count.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><Wand2 className="w-3 h-3" />{r.remix_count.toLocaleString()}</span>
            </div>
          </div>
          <div className="p-3">
            <div className="text-[13px] text-white font-light truncate">{r.title}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45 font-mono uppercase tracking-[0.22em]">
              {r.creator_avatar ? (
                <img src={r.creator_avatar} alt="" className="w-3.5 h-3.5 rounded-full" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-glass-hover" />
              )}
              <span className="truncate">{r.creator_name ?? "Anonymous"}</span>
              <span aria-hidden className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${accent})` }} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
