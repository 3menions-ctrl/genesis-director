/**
 * MusicHub — /music
 *
 * Audio-first parallel surface. Cinematic identity matches the Create page
 * (StudioAurora + StudioHero + StudioTabs + PageShell), wrapped in
 * AppShell at the route so the workspace sidebar persists.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2, Mic2, Piano, ArrowRight, Play, Calendar, Drum, Headphones,
  Volume2, Sparkles, Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

interface MusicReel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  play_count: number;
  like_count: number;
  creator_name: string | null;
  creator_avatar: string | null;
}

interface DailyPrompt {
  prompt: { id: string; prompt_text: string; prompt_hint: string | null; prompt_date: string };
  top_submissions: Array<{ reel_id: string; title: string; thumbnail_url: string | null; votes: number }>;
}

const DEMO_REELS: MusicReel[] = [
  {
    id: "demo-mv-1", title: "Cassia · Lemon, neon, three breaths",
    thumbnail_url: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=1200&q=80",
    video_url: "", play_count: 3245, like_count: 620, creator_name: "Cassia Roe", creator_avatar: null,
  },
  {
    id: "demo-mv-2", title: "Iko Marvell — bell tones, dial up",
    thumbnail_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    video_url: "", play_count: 2018, like_count: 312, creator_name: "Iko Marvell", creator_avatar: null,
  },
  {
    id: "demo-mv-3", title: "Strings for the slow reveal",
    thumbnail_url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80",
    video_url: "", play_count: 1190, like_count: 198, creator_name: "Vela Reyes", creator_avatar: null,
  },
];

type TabKey = "all" | "videos" | "scores" | "sheet" | "karaoke";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "All",          icon: Flame },
  { key: "videos",   label: "Music videos", icon: Play },
  { key: "scores",   label: "Score Studio", icon: Piano },
  { key: "sheet",    label: "Sheet music",  icon: Music2 },
  { key: "karaoke",  label: "Karaoke",      icon: Mic2 },
];

export default function MusicHub() {
  usePageMeta({ title: "Music — Small Bridges", description: "Score Studio, Sheet Music, Daily Beat, Karaoke." });
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [reels, setReels] = useState<MusicReel[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feedRes, promptRes] = await Promise.all([
        supabase.rpc("lobby_feed" as never, { p_world_slug: "music", p_cursor: null, p_limit: 12 } as never),
        supabase.rpc("current_daily_prompt" as never),
      ]);
      const feedData = (feedRes as { data?: unknown }).data as MusicReel[] | null;
      if (!feedData || feedData.length === 0) {
        setReels(DEMO_REELS); setUsingDemo(true);
      } else {
        setReels(feedData); setUsingDemo(false);
      }
      const promptData = (promptRes as { data?: unknown }).data;
      if (promptData) setPrompt(promptData as DailyPrompt);
    } catch (e) {
      console.warn("[Music] DB unreachable, using demo", e);
      setReels(DEMO_REELS); setUsingDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openStudio = (kind: "score" | "karaoke" | "sheet" | "beat") => {
    if (!user) { navigate("/auth"); return; }
    try { sessionStorage.setItem('smallbridges.studio_intent', kind); } catch {}
    navigate("/create");
  };

  return (
    <div className="relative">
        <StudioHero
          eyebrow="Tonight"
          title="Score"
          accent="the room."
          subtitle="Generate a soundtrack from a prompt. Read sheet music with an AI accompanist. Build on today's beat. Sing the chorus. Every score lives in the market the moment you ship it."
          status={["Compose", "Mix", "Master"]}
          subhead={usingDemo ? "Sample music videos" : `${reels.length} reels`}
        >
          <StudioTabs items={TABS} value={tab} onChange={(k) => setTab(k as TabKey)} layoutId="music-tab" />
        </StudioHero>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {(tab === "all" || tab === "scores") && (
              <StudioGrid openStudio={openStudio} />
            )}
            {(tab === "all" || tab === "scores") && (
              <DailyBeatCard
                promptText={prompt?.prompt.prompt_text ?? "A 2-bar loop that suggests morning fog."}
                promptHint={prompt?.prompt.prompt_hint ?? "Build your track around it before midnight. Top picks land on the wall tomorrow."}
                onBuild={() => openStudio("beat")}
              />
            )}

            {(tab === "all" || tab === "videos") && (
              <>
                <SectionLabel label="Music videos · trending" icon={Flame} meta={loading ? "loading" : `${reels.length} reels`} />
                {loading ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Spinner size="md" tone="muted" />
                    <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Cueing the floor…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                    {reels.map((r) => <MusicVideoCard key={r.id} reel={r} demo={usingDemo} />)}
                  </div>
                )}
              </>
            )}

            {tab === "sheet" && <SheetMusicStrip onOpen={() => openStudio("sheet")} />}
            {tab === "karaoke" && <KaraokeStrip onOpen={() => openStudio("karaoke")} />}
          </motion.div>
        </AnimatePresence>

        {/* CROSS-LINK */}
        <section className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-8 lg:p-10 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.32em] mb-3 text-muted-foreground">License music · own scores</div>
              <h2 className="font-display font-medium text-[clamp(1.6rem,3.5vw,2.4rem)] leading-tight tracking-[-0.02em] text-foreground">
                Every score is also a market listing.
              </h2>
              <p className="text-muted-foreground mt-3 max-w-xl text-[13px] leading-relaxed">
                When you publish a track, it lands in the market as a sheet-music + soundtrack listing. Other directors license it; you earn credits per use.
              </p>
            </div>
            <Link
              to="/market"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground shrink-0"
              style={{
                background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                boxShadow: "0 0 18px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
              }}
            >
              Open music market <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>
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

function StudioGrid({ openStudio }: { openStudio: (k: "score" | "karaoke" | "sheet" | "beat") => void }) {
  const tiles = [
    { kind: "score" as const,   icon: Piano,  title: "Score Studio",       sub: "Prompt → soundtrack",   accent: 280 },
    { kind: "sheet" as const,   icon: Music2, title: "Sheet Music Reader", sub: "MIDI · notation",       accent: 195 },
    { kind: "beat"  as const,   icon: Drum,   title: "Daily Beat",         sub: "Build on today's stem", accent: 14 },
    { kind: "karaoke" as const, icon: Mic2,   title: "Karaoke",            sub: "Sing over any score",   accent: 160 },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.kind}
            onClick={() => openStudio(t.kind)}
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/20 hover:bg-glass-hover px-5 py-4 text-left transition-colors"
          >
            <div
              className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
              style={{
                borderColor: `hsla(${t.accent} 70% 65% / 0.40)`,
                background: `hsla(${t.accent} 70% 65% / 0.10)`,
                color: `hsl(${t.accent} 70% 75%)`,
              }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-foreground">{t.title}</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">{t.sub}</div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        );
      })}
    </div>
  );
}

function DailyBeatCard({ promptText, promptHint, onBuild }: { promptText: string; promptHint: string; onBuild: () => void }) {
  return (
    <section
      className="relative rounded-3xl overflow-hidden p-8 lg:p-10 mb-12 border"
      style={{
        background: "linear-gradient(180deg, hsla(45,100%,60%,0.06) 0%, hsla(45,100%,60%,0.01) 100%)",
        borderColor: "hsla(45,100%,60%,0.22)",
        boxShadow: "0 8px 40px -16px hsla(45,100%,60%,0.25), inset 0 1px 0 hsla(0,0%,100%,0.04)",
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.32em] text-amber-200">
            <Calendar className="w-3 h-3" /> Daily Beat · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          <h2 className="font-display font-medium text-[clamp(1.5rem,3.5vw,2.4rem)] leading-tight tracking-[-0.02em] text-foreground">
            {promptText}
          </h2>
          <p className="text-muted-foreground text-[13px] mt-2 max-w-xl">{promptHint}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onBuild} className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em]">
            <Drum className="w-3 h-3" /> Build a take
          </button>
          <Link to="/lobby" className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border border-white/[0.10] hover:border-white/30 text-foreground/75 hover:text-foreground text-[11px] font-mono uppercase tracking-[0.22em]">
            <Headphones className="w-3 h-3" /> Hear today's takes
          </Link>
        </div>
      </div>
    </section>
  );
}

function MusicVideoCard({ reel, demo }: { reel: MusicReel; demo: boolean }) {
  const cardClass = cn(
    "group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/15 overflow-hidden transition-colors",
    demo && "cursor-default",
  );
  const inner = (
    <>
      <div className="aspect-video bg-black/40 relative">
        {reel.thumbnail_url && <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/75">
          <span className="inline-flex items-center gap-1.5"><Play className="w-3 h-3" />{reel.play_count.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1.5"><Music2 className="w-3 h-3" />{reel.like_count.toLocaleString()}</span>
        </div>
        {demo && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-200 text-[9px] font-mono uppercase tracking-[0.28em]">
            sample
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-[14px] text-foreground font-light truncate">{reel.title}</div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-[0.22em]">
          {reel.creator_name || "Anonymous"}
        </div>
      </div>
    </>
  );
  return demo ? (
    <div className={cardClass}>{inner}</div>
  ) : (
    <Link to={`/watch/${reel.id}`} className={cardClass}>{inner}</Link>
  );
}

function SheetMusicStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="text-center py-12 max-w-md mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
      <Music2 className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
      <h3 className="font-display font-medium text-[22px] text-foreground mb-2">Sheet Music Reader</h3>
      <p className="text-muted-foreground text-[13px] mb-5">Load any MIDI or notation. Play along with an AI accompanist; transpose any key, simplify for beginners.</p>
      <button onClick={onOpen} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em]">
        <Music2 className="w-3.5 h-3.5" /> Open the reader
      </button>
    </div>
  );
}

function KaraokeStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="text-center py-12 max-w-md mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
      <Volume2 className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
      <h3 className="font-display font-medium text-[22px] text-foreground mb-2">Karaoke Mode</h3>
      <p className="text-muted-foreground text-[13px] mb-5">Sing over any track. Auto-pitch helps the rough edges, share the result as a music reel.</p>
      <button onClick={onOpen} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-amber-300/90 hover:bg-amber-300 text-black text-[11px] font-mono uppercase tracking-[0.22em]">
        <Mic2 className="w-3.5 h-3.5" /> Start a take
      </button>
    </div>
  );
}
