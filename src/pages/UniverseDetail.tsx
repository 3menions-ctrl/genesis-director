/**
 * UniverseDetail — /universe/:id
 *
 * The world-building hub for a single Universe (Small Bridges's term for a shared
 * fictional setting that can span many reels). Composes:
 *
 *   • Hero — universe name + description (the manifesto / story bible)
 *   • Contributor row — every director who's published into this universe
 *   • Reels grid — every public reel inside this universe
 *   • Fork CTA — for signed-in viewers; (logical fork: creates a draft
 *     project pre-set to this universe so users can extend it)
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Globe, Sparkles, Eye, Heart, Wand2, ArrowRight, Users, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";

interface Universe {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}
interface Contributor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}
interface Reel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  world_slug: string | null;
  play_count: number;
  like_count: number;
  remix_count: number;
  creator_id: string;
  created_at: string;
}
interface Payload {
  universe: Universe;
  reels: Reel[];
  contributors: Contributor[];
  reel_count: number;
}

export default function UniverseDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  usePageMeta({
    title: payload?.universe.name ? `${payload.universe.name} · Universe · Small Bridges` : "Universe · Small Bridges",
    description: payload?.universe.description ?? "A shared fictional universe on Small Bridges.",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("universe_detail" as never, { p_universe_id: id } as never);
      if (error) throw error;
      setPayload((data as unknown as Payload) ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load universe");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Fork: create a new draft movie_project pinned to this universe.
  const fork = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!payload) return;
    try {
      const { data, error } = await supabase.from("movie_projects").insert({
        user_id: user.id,
        title: `In the ${payload.universe.name} universe`,
        universe_id: payload.universe.id,
        status: "draft",
      }).select("id").maybeSingle();
      if (error) throw error;
      const newProjectId = (data as { id: string }).id;
      toast.success(`New scene seeded in the ${payload.universe.name} universe`);
      navigate(`/editor/${newProjectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fork failed");
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora hue={200} intensity="subtle" />
      <PageShell width="wide" pad>
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-white/55">
          <Spinner size="md" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading universe…</span>
        </div>
      ) : !payload ? (
        <div className="text-center py-24 max-w-md mx-auto">
          <Globe className="w-6 h-6 mx-auto mb-4 text-white/45" />
          <h2 className="font-display font-medium text-[26px] text-white mb-2">Universe not found.</h2>
          <Link to="/lobby" className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            Back to Lobby <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <>
          {/* HERO */}
          <section className="relative rounded-3xl overflow-hidden border border-white/[0.06] mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-0">
              {/* Left — manifesto */}
              <div className="p-8 lg:p-12 flex flex-col justify-between gap-8 min-h-[420px] relative">
                <div
                  aria-hidden
                  className="absolute -top-32 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none opacity-60"
                  style={{ background: "radial-gradient(circle, hsla(200 80% 65% / 0.20), transparent 65%)", filter: "blur(70px)" }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-5 text-[10px] font-mono uppercase tracking-[0.32em]" style={{ color: "hsl(200 80% 75%)" }}>
                    <Globe className="w-3 h-3" /> Shared universe
                  </div>
                  <h1
                    className="font-display font-light text-[40px] lg:text-[56px] leading-[1.02] tracking-tight text-white"
                  >
                    {payload.universe.name}
                  </h1>
                  {payload.universe.description && (
                    <p className="text-white/65 text-[16px] mt-6 leading-relaxed max-w-xl">{payload.universe.description}</p>
                  )}
                </div>
                <div className="relative flex flex-wrap items-center gap-3">
                  <button
                    onClick={fork}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />Extend this universe
                  </button>
                  <Link
                    to="/lobby"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/[0.08] hover:border-white/30 text-white/75 hover:text-white transition-colors font-mono uppercase tracking-[0.22em] text-[11px]"
                  >
                    Back to Lobby
                  </Link>
                </div>
              </div>

              {/* Right — recent reel preview as ambient */}
              <div className="relative bg-black/60 min-h-[420px]">
                {payload.reels[0]?.video_url ? (
                  <Link to={`/watch/${payload.reels[0].id}`} className="absolute inset-0 group">
                    <video
                      src={payload.reels[0].video_url}
                      poster={payload.reels[0].thumbnail_url ?? undefined}
                      autoPlay muted loop playsInline preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="text-[10px] font-mono uppercase tracking-[0.32em] mb-1.5 text-white/65">
                        Latest scene
                      </div>
                      <div className="text-[18px] text-white font-light truncate">{payload.reels[0].title}</div>
                    </div>
                  </Link>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/35 px-8 text-center">
                    <div>
                      <Sparkles className="w-7 h-7 mx-auto mb-3 text-white/55" />
                      <div className="text-[14px]">No reels in this universe yet.</div>
                      <div className="text-[11px] text-white/30 mt-1">Click &ldquo;Extend&rdquo; to plant the first.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* CONTRIBUTORS */}
          {payload.contributors.length > 0 && (
            <>
              <SectionLabel label="Contributors" icon={Users} meta={payload.contributors.length + " directors"} />
              <div className="flex flex-wrap gap-3 mb-12">
                {payload.contributors.map((c) => (
                  <Link
                    key={c.id}
                    to={`/c/${c.id}`}
                    className="group inline-flex items-center gap-2 px-3 h-9 rounded-full border border-white/[0.06] hover:border-white/15 bg-white/[0.015] hover:bg-white/[0.04] transition-colors"
                  >
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center text-[9px] font-mono text-white/55">
                        {(c.display_name?.[0] || "?").toUpperCase()}
                      </div>
                    )}
                    <span className="text-[12px] text-white/75 group-hover:text-white">{c.display_name ?? "Anonymous"}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* REELS */}
          <SectionLabel label="Reels in this universe" icon={Wand2} meta={payload.reel_count + " scenes"} />
          {payload.reels.length === 0 ? (
            <div className="text-center py-12 max-w-md mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <Wand2 className="w-6 h-6 mx-auto mb-3 text-white/45" />
              <h3 className="font-display font-medium text-[20px] text-white mb-2">No scenes yet</h3>
              <p className="text-[12px] text-white/45 mb-5">Plant a scene and start the lore.</p>
              <button
                onClick={fork}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black hover:bg-white/90 transition-colors text-[11px] font-mono uppercase tracking-[0.22em]"
              >
                <Sparkles className="w-3.5 h-3.5" />Start the first
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {payload.reels.map((r) => (
                <Link
                  key={r.id}
                  to={`/watch/${r.id}`}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors"
                >
                  <div className="aspect-video bg-black/40 relative">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/75">
                      <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{r.play_count.toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{r.like_count.toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><Wand2 className="w-3 h-3" />{r.remix_count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-[13px] text-white font-light truncate">{r.title}</div>
                    <div className="mt-1 text-[10px] text-white/40 font-mono uppercase tracking-[0.22em] inline-flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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
