import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { useSafeNavigation } from '@/lib/navigation';
import { PublicMarketingShell } from '@/components/shell/PublicMarketingShell';
import {
  Wand2, Image as ImageIcon, Mic, Music2, Users, Lock,
  Layers, Workflow, Palette, Globe2, GitBranch, Sparkles,
  Film, Camera, Type, Scissors, ArrowRight, Play,
  Cpu, Zap, Brain, Aperture, Gauge, Box, Grid3x3,
  Volume2, Languages, ShieldCheck, Eye, Pause, ChevronRight,
  Send, Mic2, Hash,
} from 'lucide-react';
import { CategoryChooserOverlay, type AudienceCategory } from '@/components/landing/CategoryChooserOverlay';

/* ---------------- Asset constants (videos via /__l5e CDN paths) ----- */

const HERO_VIDEO = '/__l5e/assets-v1/2d6f0d1d-4ec0-4d3f-8819-fbb60f4cbaf2/landing-immersive-hero.mp4';
const SEEDANCE_VIDEO = '/__l5e/assets-v1/db9b8c6e-776b-4292-b571-6f2aac699445/seedance-avatar-test.mp4';
const KLING_VIDEO = '/__l5e/assets-v1/1fac204f-d8cc-4285-aee2-28065b1f7bb4/test-seedance-clip.mp4';
const AVATAR_VIDEO = '/__l5e/assets-v1/ae9bd02b-cca0-4763-8fe7-39e9cbd2d56c/landing-avatar-wave-hello.mp4';
const HOPPY_VIDEO = '/__l5e/assets-v1/4b8810b3-4a03-4ffb-9b67-c79a9bb59ecd/landing-hoppy-intro.mp4';

/* ---------------- Asset imports (Vite bundles the URLs) ------------- */

import textToVideo from '@/assets/features/text-to-video-premium.jpg';
import imageToVideo from '@/assets/features/image-to-video-premium.jpg';
import characterLock from '@/assets/features/character-lock-premium.jpg';
import voiceoverImg from '@/assets/features/voiceover-premium.jpg';
import musicImg from '@/assets/features/music-premium.jpg';
import styleImg from '@/assets/features/style-transfer-premium.jpg';

import tplBrandStory from '@/assets/templates/brand-story.jpg';
import tplProductReveal from '@/assets/templates/product-reveal.jpg';
import tplActionMontage from '@/assets/templates/action-montage.jpg';
import tplMusicVideo from '@/assets/templates/music-video.jpg';
import tplDocumentary from '@/assets/templates/documentary.jpg';
import tplViralHook from '@/assets/templates/viral-hook.jpg';
import tplNeoNoir from '@/assets/templates/neo-noir.jpg';
import tplTravelVlog from '@/assets/templates/travel-vlog.jpg';
import tplAnime from '@/assets/templates/anime-style.jpg';
import tplFood from '@/assets/templates/food-lifestyle.jpg';
import tplTutorial from '@/assets/templates/tutorial.jpg';
import tplTransform from '@/assets/templates/transformation.jpg';
import tplAesthetic from '@/assets/templates/aesthetic-vlog.jpg';
import tplStorytime from '@/assets/templates/storytime.jpg';
import tplCourse from '@/assets/templates/course-trailer.jpg';
import tplUgc from '@/assets/templates/ugc-testimonial.jpg';
import tplPodcast from '@/assets/templates/podcast-clips.jpg';
import tplBreakTiktok from '@/assets/templates/breakout-tiktok.jpg';

import sceneCinematic from '@/assets/scenes/cinematic-hero-preview.jpg';
import sceneFourthWall from '@/assets/scenes/4th-wall-breakthrough-preview.jpg';
import sceneEmbed from '@/assets/scenes/minimal-embed-preview.jpg';

import envNeon from '@/assets/environments/neon-noir-city.jpg';
import envAlpine from '@/assets/environments/alpine-dawn.jpg';
import envCherry from '@/assets/environments/cherry-blossom.jpg';
import envGolden from '@/assets/environments/golden-hour-magic.jpg';
import envSpace from '@/assets/environments/space-station.jpg';
import envForest from '@/assets/environments/enchanted-forest.jpg';
import envUnderwater from '@/assets/environments/underwater-dreams.jpg';
import envDesert from '@/assets/environments/desert-dunes.jpg';
import envSteampunk from '@/assets/environments/steampunk-lab.jpg';
import envCabin from '@/assets/environments/cozy-cabin.jpg';
import envBoardroom from '@/assets/environments/corporate-boardroom.jpg';
import envArctic from '@/assets/environments/arctic-aurora.jpg';

import avEmma from '@/assets/avatars/emma-thompson.png';
import avMarcus from '@/assets/avatars/marcus-stone.png';
import avZara from '@/assets/avatars/zara-okonkwo.png';
import avHiroshi from '@/assets/avatars/hiroshi-tanaka.png';
import avCamila from '@/assets/avatars/camila-santos.png';
import avAaliya from '@/assets/avatars/aaliyah-james.png';
import avDarius from '@/assets/avatars/darius-jackson.png';
import avIngrid from '@/assets/avatars/ingrid-andersson.png';
import avRohan from '@/assets/avatars/rohan-kapoor.png';
import avSofia from '@/assets/avatars/sofia-valentina.png';
import avDiego from '@/assets/avatars/diego-fernandez.png';
import avMei from '@/assets/avatars/mei-lin-zhang.png';
import avChioma from '@/assets/avatars/chioma-eze.png';
import avAndre from '@/assets/avatars/andre-williams.png';
import avMia from '@/assets/avatars/mia-rodriguez.png';
import avKevin from '@/assets/avatars/kevin-chen.png';
import avHannah from '@/assets/avatars/hannah-miller.png';
import avVikram from '@/assets/avatars/vikram-singh.png';
import avNia from '@/assets/avatars/nia-thompson.png';
import avDragon from '@/assets/avatars/drake-dragon.jpg';

import editorConcept from '@/assets/editor-concepts/concept-10-cinematic.jpg';
import editorBrutal from '@/assets/editor-concepts/concept-3-command-center.jpg';

/* =================================================================== */
/*                         PRIMITIVE COMPONENTS                         */
/* =================================================================== */

function Eyebrow({ n, kicker }: { n: string; kicker: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.8 }}
      className="flex justify-center mb-6"
    >
      <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl">
        <span className="text-[10px] font-medium text-white/40 tracking-[0.32em] uppercase">{n}</span>
        <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
        <span className="text-[10px] font-medium text-[#0A84FF]/85 tracking-[0.32em] uppercase">{kicker}</span>
      </div>
    </motion.div>
  );
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className={`font-display text-center text-4xl md:text-6xl text-white tracking-[-0.03em] leading-[1.05] max-w-4xl mx-auto ${className}`}
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      {children}
    </motion.h2>
  );
}

function Italic({ children }: { children: React.ReactNode }) {
  return (
    <span className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent" style={{ fontFamily: "'Fraunces', serif" }}>
      {children}
    </span>
  );
}

/** Auto-playing, muted, looped video tile with smart lazy mounting. */
function VideoTile({
  src, poster, className = '', objectPosition = 'center',
}: { src: string; poster?: string; className?: string; objectPosition?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setVisible(true);
          el.play().catch(() => undefined);
        } else {
          el.pause();
        }
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={visible ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      className={`w-full h-full object-cover ${className}`}
      style={{ objectPosition }}
    />
  );
}

/* =================================================================== */
/*                                PAGE                                  */
/* =================================================================== */

export default function Studio() {
  const { navigate } = useSafeNavigation();
  const [chooserOpen, setChooserOpen] = useState(false);
  const handleEnter = useCallback(() => setChooserOpen(true), []);
  const handleSelect = useCallback((category: AudienceCategory) => {
    try { localStorage.setItem('apex.audience', category); } catch {}
    setChooserOpen(false);
    navigate(`/start?type=${category}`);
  }, [navigate]);
  const goSignup = useCallback(() => navigate('/auth?mode=signup'), [navigate]);

  /* SEO */
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'The Studio — every craft of cinema, one room | Apex';
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute('content') ?? '';
    meta?.setAttribute('content',
      'Tour Apex Studio — Seedance and Kling V3 engines, avatar cast, environments, templates, scoring, the editor, and a live create-page preview.');
    return () => { document.title = prevTitle; meta?.setAttribute('content', prev); };
  }, []);

  return (
    <PublicMarketingShell>
      <Hero onEnter={handleEnter} />
      <FilmstripTicker />
      <EnginesSection />
      <CapabilitiesBento />
      <AvatarCast />
      <EnvironmentsSection />
      <TemplatesShowcase />
      <ScenesReel />
      <PipelineSection />
      <EditorMockupSection />
      <CreatePageMockup onSignup={goSignup} />
      <FinalCTA onEnter={handleEnter} />
      <CategoryChooserOverlay open={chooserOpen} onClose={() => setChooserOpen(false)} onSelect={handleSelect} />
    </PublicMarketingShell>
  );
}

/* =================================================================== */
/*                               1. HERO                                */
/* =================================================================== */

function Hero({ onEnter }: { onEnter: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 240]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.1]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section ref={ref} className="relative min-h-[110vh] flex items-end overflow-hidden">
      {/* Video bed */}
      <motion.div style={{ y, scale, opacity }} className="absolute inset-0 -z-10">
        <VideoTile src={HERO_VIDEO} className="brightness-[0.55]" />
        {/* Color graded overlay */}
        <div aria-hidden className="absolute inset-0" style={{
          background:
            'radial-gradient(60% 60% at 50% 30%, transparent 30%, rgba(0,0,0,0.55) 80%),' +
            'linear-gradient(180deg, rgba(2,4,10,0.5) 0%, rgba(2,4,10,0.85) 70%, hsl(220,14%,2%) 100%)',
        }} />
        {/* Faint scanlines */}
        <div aria-hidden className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)' }} />
      </motion.div>

      {/* Aurora */}
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <motion.div animate={{ x: ['-6%', '8%', '-6%'], y: ['-3%', '4%', '-3%'] }} transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1/3 left-1/4 w-[60vw] h-[60vw] rounded-full bg-[#0A84FF]/[0.18] blur-[160px]" />
        <motion.div animate={{ x: ['6%', '-6%', '6%'], y: ['3%', '-3%', '3%'] }} transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 right-0 w-[50vw] h-[50vw] rounded-full bg-[#5AC8FA]/[0.10] blur-[180px]" />
      </div>

      <motion.div style={{ y: titleY }} className="relative w-full max-w-7xl mx-auto px-6 pb-32 pt-44">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] animate-pulse" />
          <span className="text-[10.5px] font-medium text-white/75 tracking-[0.32em] uppercase">A guided tour · 11 chapters</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="font-display text-[3.4rem] md:text-[8rem] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          The studio,<br />
          <Italic>not the software.</Italic>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.25 }}
          className="mt-10 max-w-2xl text-white/65 text-lg md:text-2xl font-light leading-relaxed"
        >
          Eleven chapters through every craft inside Apex. Seedance and Kling V3,
          a cast of avatars, forty environments, the score room, the editor — and
          the pipeline that walks a sentence into a finished film.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-start gap-4"
        >
          <button
            onClick={onEnter}
            className="group h-14 px-10 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.04] shadow-[0_20px_60px_-20px_rgba(255,255,255,0.4)] inline-flex items-center gap-2.5"
          >
            Enter the Studio
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <a href="#engines" className="h-14 px-10 text-sm font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all inline-flex items-center gap-2 border border-white/[0.08]">
            <Play className="w-3.5 h-3.5" /> Take the tour
          </a>
        </motion.div>

        {/* Footer strip — chapters list */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 1 }}
          className="mt-24 hidden md:flex items-center gap-6 text-[10.5px] tracking-[0.28em] uppercase text-white/40">
          <span className="text-[#0A84FF]/80">01 · Engines</span>
          <span>02 · Capabilities</span>
          <span>03 · Cast</span>
          <span>04 · Worlds</span>
          <span>05 · Templates</span>
          <span>06 · Scenes</span>
          <span>07 · Pipeline</span>
          <span>08 · Editor</span>
          <span>09 · Create</span>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* =================================================================== */
/*                       1.5  FILMSTRIP TICKER                          */
/* =================================================================== */

function FilmstripTicker() {
  const items = [
    'Kling V3', 'Seedance', 'MusicGen', 'FLUX 1.1 Pro Ultra', 'Gemini 3 Pro',
    'Face-Lock Identity', 'Native audio', '30+ languages', 'Multi-character',
    'Cinematic scoring', 'Variant engine', 'Approval gates', 'HD master export',
  ];
  const row = [...items, ...items, ...items];
  return (
    <section className="relative py-10 border-y border-white/[0.05] bg-black/40 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
      <motion.div className="flex gap-12 w-max" animate={{ x: ['0%', '-33.333%'] }} transition={{ duration: 50, ease: 'linear', repeat: Infinity }}>
        {row.map((t, i) => (
          <div key={i} className="flex items-center gap-3 text-[12.5px] uppercase tracking-[0.28em] text-white/55">
            <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
            {t}
          </div>
        ))}
      </motion.div>
    </section>
  );
}

/* =================================================================== */
/*                            2. ENGINES                                */
/* =================================================================== */

const ENGINES = [
  {
    name: 'Kling V3',
    role: 'Primary Generation Engine',
    desc: 'Cinematic text-to-video and image-to-video with native audio, extended clip duration, and faithful identity continuity. The workhorse behind every shot.',
    spec: [
      ['Modality', 'T2V · I2V'],
      ['Audio', 'Native, in-frame'],
      ['Duration', 'Extended clips'],
      ['Identity', 'Face-Lock continuity'],
    ],
    icon: Cpu,
    accent: '#0A84FF',
    video: KLING_VIDEO,
  },
  {
    name: 'Seedance',
    role: 'Performance & Motion Engine',
    desc: 'Choreographs body language, performance beats and dance-grade motion. The reason an avatar acts instead of just speaking — used for movement-heavy scenes.',
    spec: [
      ['Modality', 'Performance T2V'],
      ['Specialty', 'Body motion · dance'],
      ['Camera', 'Auto-blocking'],
      ['Continuity', 'Pose anchoring'],
    ],
    icon: Zap,
    accent: '#5AC8FA',
    video: SEEDANCE_VIDEO,
  },
  {
    name: 'MusicGen',
    role: 'Cinematic Score Engine',
    desc: 'Composes original score that breathes with the cut — never a stock loop. Automated dialogue ducking handled in the master bus.',
    spec: [
      ['Modality', 'Symbolic + audio'],
      ['Output', 'Original score'],
      ['Mix', 'Auto dialogue duck'],
      ['Sync', 'Beat-locked to edit'],
    ],
    icon: Music2,
    accent: '#7DD3FC',
    video: AVATAR_VIDEO,
  },
  {
    name: 'FLUX 1.1 Pro Ultra',
    role: 'Cinematic Scene Image Engine',
    desc: 'Generates the still that becomes the seed of every scene — anamorphic compositions, volumetric light, identity-aware backplates ready for I2V.',
    spec: [
      ['Modality', 'Text-to-image'],
      ['Resolution', 'Ultra · 4K-grade'],
      ['Aspect', 'Auto outpainted'],
      ['Output', 'I2V seed frames'],
    ],
    icon: Aperture,
    accent: '#60A5FA',
    video: HERO_VIDEO,
  },
  {
    name: 'Gemini 3 Pro',
    role: 'Direction & Reasoning Engine',
    desc: 'Reads briefs, drafts cinematic screenplays, casts avatars, and scores shot lists. The director that never sleeps — and never edits your dialogue.',
    spec: [
      ['Modality', 'Multimodal LLM'],
      ['Context', 'Massive · whole brief'],
      ['Output', 'Screenplay + shot list'],
      ['Guardrail', 'Verbatim dialogue'],
    ],
    icon: Brain,
    accent: '#9DCBFF',
    video: HOPPY_VIDEO,
  },
] as const;

function EnginesSection() {
  const [active, setActive] = useState(0);
  const E = ENGINES[active];
  return (
    <section id="engines" className="relative py-32 md:py-44 px-6">
      <Eyebrow n="01" kicker="The Engine Room" />
      <SectionTitle>
        Five engines.{' '}<Italic>One director.</Italic>
      </SectionTitle>
      <p className="mt-6 max-w-2xl mx-auto text-center text-white/55 text-base md:text-lg font-light">
        Apex doesn't ride one model — it conducts five, each a master of one craft. Pick a name to look inside.
      </p>

      <div className="max-w-7xl mx-auto mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Selector rail */}
        <div className="lg:col-span-4 space-y-2">
          {ENGINES.map((e, i) => (
            <button
              key={e.name}
              onClick={() => setActive(i)}
              className={`group w-full text-left p-5 rounded-2xl border transition-all duration-500 ${
                i === active
                  ? 'border-[#0A84FF]/40 bg-gradient-to-br from-[#0A84FF]/[0.08] to-transparent'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                    i === active ? 'border-[#0A84FF]/40 bg-[#0A84FF]/[0.15]' : 'border-white/[0.08] bg-white/[0.04]'
                  }`}>
                    <e.icon className="w-4 h-4 text-[#0A84FF]" />
                  </div>
                  <div>
                    <div className="font-display text-lg text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>{e.name}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/45 mt-0.5">{e.role}</div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${i === active ? 'text-[#0A84FF] translate-x-0.5' : 'text-white/30'}`} />
              </div>
            </button>
          ))}
        </div>

        {/* Detail card with video preview */}
        <div className="lg:col-span-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={E.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-black"
            >
              <div className="relative aspect-[16/10]">
                <VideoTile src={E.video} className="brightness-[0.7]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute top-5 left-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/55 border border-white/10 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: E.accent }} />
                  <span className="text-[10px] uppercase tracking-[0.24em] text-white/75">Live · Engine demo</span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="text-[10.5px] uppercase tracking-[0.32em] text-[#0A84FF]/85 mb-2">{E.role}</div>
                  <h3 className="font-display text-4xl md:text-5xl text-white tracking-[-0.02em] mb-3" style={{ fontFamily: "'Fraunces', serif" }}>{E.name}</h3>
                  <p className="text-white/70 text-sm md:text-base font-light leading-relaxed max-w-2xl">{E.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06]">
                {E.spec.map(([k, v]) => (
                  <div key={k} className="bg-black/80 p-4">
                    <div className="text-[9.5px] uppercase tracking-[0.26em] text-white/40 mb-1">{k}</div>
                    <div className="text-[13px] text-white/85 font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*                       3. CAPABILITIES BENTO                          */
/* =================================================================== */

function CapabilitiesBento() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <Eyebrow n="02" kicker="Capabilities" />
      <SectionTitle>The crafts inside.{' '}<Italic>Each one fluent in cinema.</Italic></SectionTitle>

      <div className="max-w-7xl mx-auto mt-20 grid grid-cols-12 grid-rows-[260px_260px_260px_260px] gap-4 md:gap-5">
        {/* Big featured: Text-to-Video with live video */}
        <BentoCard className="col-span-12 md:col-span-7 row-span-2">
          <div className="absolute inset-0">
            <VideoTile src={KLING_VIDEO} className="brightness-[0.55]" />
          </div>
          <BentoBadge icon={Wand2} label="Generation" />
          <BentoCaption
            title="Text → Cinema"
            sub="A sentence becomes a shot. Kling V3 renders with native audio, extended duration and cinematic motion — locked to your direction."
            metric={[{ k: '1', l: 'Sentence' }, { k: '8s', l: 'First frame' }, { k: 'HD', l: 'Master out' }]}
          />
        </BentoCard>

        <BentoCard className="col-span-6 md:col-span-5">
          <img src={imageToVideo} alt="" className="absolute inset-0 w-full h-full object-cover brightness-[0.6]" />
          <BentoBadge icon={ImageIcon} label="I2V" />
          <BentoCaption title="Image → Video" sub="Animate any still. Identity, lighting and atmosphere preserved frame one to last." compact />
        </BentoCard>

        <BentoCard className="col-span-6 md:col-span-5">
          <img src={characterLock} alt="" className="absolute inset-0 w-full h-full object-cover brightness-[0.55]" />
          <BentoBadge icon={Lock} label="Identity" />
          <BentoCaption title="Character Lock" sub="Face-Lock prevents drift across hops. Your hero looks like your hero, every clip." compact />
        </BentoCard>

        <BentoCard className="col-span-6 md:col-span-4">
          <div className="absolute inset-0">
            <VideoTile src={AVATAR_VIDEO} className="brightness-[0.6]" />
          </div>
          <BentoBadge icon={Users} label="Cast" />
          <BentoCaption title="Multi-Character" sub="Two avatars, one scene. Cinematic switch protocols handle eyelines and beats." compact />
        </BentoCard>

        <BentoCard className="col-span-6 md:col-span-4">
          <img src={voiceoverImg} alt="" className="absolute inset-0 w-full h-full object-cover brightness-[0.6]" />
          <BentoBadge icon={Mic} label="Voice" />
          <BentoCaption title="Voice & Lip-Sync" sub="Studio-grade voiceover, frame-accurate lip-sync, automated ducking." compact />
        </BentoCard>

        <BentoCard className="col-span-12 md:col-span-4">
          <img src={musicImg} alt="" className="absolute inset-0 w-full h-full object-cover brightness-[0.6]" />
          <BentoBadge icon={Music2} label="Score" />
          <BentoCaption title="Cinematic Score" sub="MusicGen composes a score that breathes with your edit." compact />
        </BentoCard>

        <BentoCard className="col-span-6 md:col-span-4">
          <img src={styleImg} alt="" className="absolute inset-0 w-full h-full object-cover brightness-[0.6]" />
          <BentoBadge icon={Palette} label="Look" />
          <BentoCaption title="Style & Grade" sub="Anime, neo-noir, documentary — lock a visual grammar across the cut." compact />
        </BentoCard>

        <BentoCard className="col-span-6 md:col-span-4">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A84FF]/30 via-black to-black" />
          <BentoBadge icon={Languages} label="Reach" />
          <BentoCaption
            title="30+ Languages"
            sub="Re-voice and re-caption from a single master. Never re-render a frame."
            compact
          />
        </BentoCard>

        <BentoCard className="col-span-12 md:col-span-4">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0A84FF]/20 to-black" />
          <BentoBadge icon={ShieldCheck} label="Ship" />
          <BentoCaption title="Approval Gates" sub="Draft → Review → Approved with role-based access and audit trail." compact />
        </BentoCard>
      </div>
    </section>
  );
}

function BentoCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] ${className}`}
    >
      {children}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
      <div aria-hidden className="absolute inset-0 ring-1 ring-inset ring-white/[0.04] rounded-2xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </motion.div>
  );
}

function BentoBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 border border-white/10 backdrop-blur-md">
      <Icon className="w-3 h-3 text-[#0A84FF]" />
      <span className="text-[9.5px] tracking-[0.22em] uppercase text-white/75">{label}</span>
    </div>
  );
}

function BentoCaption({
  title, sub, compact = false, metric,
}: { title: string; sub: string; compact?: boolean; metric?: { k: string; l: string }[] }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 z-10">
      <h3
        className={`font-display text-white tracking-[-0.02em] mb-2 ${compact ? 'text-xl md:text-2xl' : 'text-3xl md:text-5xl'}`}
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {title}
      </h3>
      <p className={`text-white/65 font-light leading-relaxed ${compact ? 'text-[12px]' : 'text-sm md:text-[15px] max-w-md'}`}>
        {sub}
      </p>
      {metric && (
        <div className="mt-5 flex gap-6">
          {metric.map((m) => (
            <div key={m.l}>
              <div className="font-display text-2xl text-white" style={{ fontFamily: "'Fraunces', serif" }}>{m.k}</div>
              <div className="text-[9.5px] uppercase tracking-[0.24em] text-white/40 mt-0.5">{m.l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/*                          4. AVATAR CAST                              */
/* =================================================================== */

const AVATARS = [
  { img: avEmma, name: 'Emma' }, { img: avMarcus, name: 'Marcus' }, { img: avZara, name: 'Zara' },
  { img: avHiroshi, name: 'Hiroshi' }, { img: avCamila, name: 'Camila' }, { img: avAaliya, name: 'Aaliyah' },
  { img: avDarius, name: 'Darius' }, { img: avIngrid, name: 'Ingrid' }, { img: avRohan, name: 'Rohan' },
  { img: avSofia, name: 'Sofia' }, { img: avDiego, name: 'Diego' }, { img: avMei, name: 'Mei-Lin' },
  { img: avChioma, name: 'Chioma' }, { img: avAndre, name: 'Andre' }, { img: avMia, name: 'Mia' },
  { img: avKevin, name: 'Kevin' }, { img: avHannah, name: 'Hannah' }, { img: avVikram, name: 'Vikram' },
  { img: avNia, name: 'Nia' }, { img: avDragon, name: 'Drake' },
];

function AvatarCast() {
  const rowA = useMemo(() => [...AVATARS, ...AVATARS], []);
  const rowB = useMemo(() => [...AVATARS.slice().reverse(), ...AVATARS.slice().reverse()], []);
  return (
    <section className="relative py-32 md:py-44 overflow-hidden">
      <div className="px-6">
        <Eyebrow n="03" kicker="The Cast" />
        <SectionTitle>A bench of{' '}<Italic>working actors.</Italic></SectionTitle>
        <p className="mt-6 max-w-2xl mx-auto text-center text-white/55 text-base md:text-lg font-light">
          Seventy-plus avatars — humans, archetypes, mascots — every face Face-Locked
          for continuity, every voice castable in 30+ languages.
        </p>
      </div>

      <div className="relative mt-16 space-y-6">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
        <AvatarRow items={rowA} direction="left" />
        <AvatarRow items={rowB} direction="right" />
      </div>
    </section>
  );
}

function AvatarRow({ items, direction }: { items: { img: string; name: string }[]; direction: 'left' | 'right' }) {
  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex gap-5 w-max"
        animate={{ x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: 80, ease: 'linear', repeat: Infinity }}
      >
        {items.map((a, i) => (
          <div key={`${a.name}-${i}`} className="relative w-[180px] h-[240px] shrink-0 rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black group">
            <img src={a.img} alt={a.name} loading="lazy"
                 className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="text-[12px] tracking-[0.18em] uppercase text-white/85">{a.name}</div>
              <div className="text-[9.5px] tracking-[0.24em] uppercase text-[#0A84FF]/80">Locked</div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* =================================================================== */
/*                         5. ENVIRONMENTS                              */
/* =================================================================== */

const ENVS = [
  { img: envNeon, label: 'Neon Noir', tag: 'Cinematic' },
  { img: envAlpine, label: 'Alpine Dawn', tag: 'Natural' },
  { img: envCherry, label: 'Cherry Blossom', tag: 'Lyrical' },
  { img: envGolden, label: 'Golden Hour', tag: 'Editorial' },
  { img: envSpace, label: 'Space Station', tag: 'Sci-Fi' },
  { img: envForest, label: 'Enchanted Forest', tag: 'Fantasy' },
  { img: envUnderwater, label: 'Underwater', tag: 'Surreal' },
  { img: envDesert, label: 'Desert Dunes', tag: 'Epic' },
  { img: envSteampunk, label: 'Steampunk Lab', tag: 'Stylized' },
  { img: envCabin, label: 'Cozy Cabin', tag: 'Intimate' },
  { img: envBoardroom, label: 'Boardroom', tag: 'Corporate' },
  { img: envArctic, label: 'Arctic Aurora', tag: 'Atmospheric' },
];

function EnvironmentsSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <Eyebrow n="04" kicker="Worlds" />
      <SectionTitle>Forty environments.{' '}<Italic>One you'll fall in love with.</Italic></SectionTitle>
      <div className="max-w-7xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {ENVS.map((e, i) => (
          <motion.div
            key={e.label}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.7, delay: (i % 4) * 0.05 }}
            className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black ${
              i === 0 ? 'md:col-span-2 md:row-span-2 aspect-square' : 'aspect-[4/5]'
            }`}
          >
            <img src={e.img} alt={e.label} loading="lazy"
                 className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/55 border border-white/10 backdrop-blur-md text-[9.5px] uppercase tracking-[0.24em] text-white/70">
              {e.tag}
            </div>
            <div className="absolute bottom-5 left-5 right-5">
              <div className={`font-display text-white tracking-tight ${i === 0 ? 'text-3xl md:text-5xl' : 'text-xl md:text-2xl'}`}
                   style={{ fontFamily: "'Fraunces', serif" }}>
                {e.label}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* =================================================================== */
/*                          6. TEMPLATES                                */
/* =================================================================== */

const TEMPLATES = [
  { img: tplBrandStory, label: 'Brand Story' },
  { img: tplProductReveal, label: 'Product Reveal' },
  { img: tplActionMontage, label: 'Action Montage' },
  { img: tplMusicVideo, label: 'Music Video' },
  { img: tplDocumentary, label: 'Documentary' },
  { img: tplViralHook, label: 'Viral Hook' },
  { img: tplNeoNoir, label: 'Neo-Noir' },
  { img: tplTravelVlog, label: 'Travel Vlog' },
  { img: tplAnime, label: 'Anime' },
  { img: tplFood, label: 'Food & Lifestyle' },
  { img: tplTutorial, label: 'Tutorial' },
  { img: tplTransform, label: 'Transformation' },
  { img: tplAesthetic, label: 'Aesthetic Vlog' },
  { img: tplStorytime, label: 'Storytime' },
  { img: tplCourse, label: 'Course Trailer' },
  { img: tplUgc, label: 'UGC Testimonial' },
  { img: tplPodcast, label: 'Podcast Clips' },
  { img: tplBreakTiktok, label: 'TikTok Breakout' },
];

function TemplatesShowcase() {
  const rowA = useMemo(() => [...TEMPLATES, ...TEMPLATES], []);
  const rowB = useMemo(() => [...TEMPLATES.slice().reverse(), ...TEMPLATES.slice().reverse()], []);
  return (
    <section className="relative py-32 md:py-44 overflow-hidden">
      <div className="px-6">
        <Eyebrow n="05" kicker="Templates" />
        <SectionTitle>Forty starting points.{' '}<Italic>One blank canvas.</Italic></SectionTitle>
        <p className="mt-6 max-w-2xl mx-auto text-center text-white/55 text-base md:text-lg font-light">
          Cinematic templates across brand, narrative, social, education and music — each a directorial shortcut.
        </p>
      </div>
      <div className="relative mt-20 space-y-5">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
        <TplRow items={rowA} dir="left" />
        <TplRow items={rowB} dir="right" />
      </div>
    </section>
  );
}

function TplRow({ items, dir }: { items: { img: string; label: string }[]; dir: 'left' | 'right' }) {
  return (
    <div className="overflow-hidden">
      <motion.div className="flex gap-5 w-max"
        animate={{ x: dir === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: 70, ease: 'linear', repeat: Infinity }}>
        {items.map((t, i) => (
          <div key={`${t.label}-${i}`} className="relative w-72 h-44 shrink-0 rounded-xl overflow-hidden border border-white/[0.06] group">
            <img src={t.img} alt={t.label} loading="lazy"
                 className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="text-[11px] tracking-[0.22em] uppercase text-white/85">{t.label}</div>
              <Play className="w-3.5 h-3.5 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* =================================================================== */
/*                            7. SCENES REEL                            */
/* =================================================================== */

const SCENES = [
  { img: sceneCinematic, video: KLING_VIDEO, title: 'Cinematic Hero',
    body: 'Anamorphic frame, volumetric light, slow dolly. The opening minute of your brand film — generated, never stitched.' },
  { img: sceneFourthWall, video: AVATAR_VIDEO, title: '4th-Wall Break',
    body: 'Avatar steps out of the frame to address the viewer. Built for hook-first social — eyeline locked to camera.' },
  { img: sceneEmbed, video: HOPPY_VIDEO, title: 'Minimal Embed',
    body: 'Editorial restraint. A single subject, generous negative space, score breathing underneath dialogue.' },
] as const;

function ScenesReel() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <Eyebrow n="06" kicker="Created Films" />
      <SectionTitle>Three scenes,{' '}<Italic>three grammars.</Italic></SectionTitle>

      <div className="max-w-7xl mx-auto mt-20 space-y-32">
        {SCENES.map((s, i) => {
          const reverse = i % 2 === 1;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className={`grid grid-cols-1 lg:grid-cols-12 gap-10 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              <div className="relative lg:col-span-7 group">
                <div className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-black aspect-[16/10]">
                  <VideoTile src={s.video} poster={s.img} className="brightness-[0.85]" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-5 left-5 px-3 py-1 rounded-full bg-black/55 border border-white/10 backdrop-blur-md text-[10px] tracking-[0.24em] uppercase text-white/70">
                    Scene {String(i + 1).padStart(2, '0')}
                  </div>
                  {/* Pseudo-scrubber */}
                  <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3">
                    <button aria-label="Play" className="w-10 h-10 rounded-full bg-white/[0.10] border border-white/15 backdrop-blur-md flex items-center justify-center text-white">
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
                      <motion.div className="h-full bg-[#0A84FF] origin-left"
                        animate={{ scaleX: [0, 1] }}
                        transition={{ duration: 8, ease: 'linear', repeat: Infinity }} />
                    </div>
                    <span className="text-[11px] font-mono text-white/60">00:0{i + 2} / 00:08</span>
                  </div>
                </div>
                <div aria-hidden className="absolute -inset-x-10 -bottom-10 h-24 bg-[#0A84FF]/20 blur-3xl -z-10" />
              </div>
              <div className="lg:col-span-5">
                <div className="text-[10px] tracking-[0.32em] uppercase text-[#0A84FF]/80 mb-4">Example {i + 1}</div>
                <h3 className="font-display text-4xl md:text-5xl text-white tracking-[-0.02em] mb-5" style={{ fontFamily: "'Fraunces', serif" }}>{s.title}</h3>
                <p className="text-white/60 text-base md:text-lg font-light leading-relaxed mb-8">{s.body}</p>
                <div className="flex flex-wrap gap-2">
                  {['Anamorphic', 'Native audio', 'Identity-locked', 'Auto-graded'].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 tracking-wide">{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* =================================================================== */
/*                          8. PIPELINE                                 */
/* =================================================================== */

const STAGES = [
  { t: 'Brief', sub: 'Drop a sentence or a deck. Gemini extracts intent, audience and tone.', icon: Sparkles },
  { t: 'Screenplay', sub: 'Cinematic script with verbatim dialogue preservation guarded.', icon: Type },
  { t: 'Casting', sub: 'Pick avatars or generate them. Identity Face-Locked from frame one.', icon: Users },
  { t: 'Shot List', sub: 'Smart placement engine sets posture, anchor and camera per beat.', icon: Camera },
  { t: 'Generation', sub: 'Kling V3 + Seedance render with native audio. Watchdog handles timeouts.', icon: Cpu },
  { t: 'Score', sub: 'MusicGen composes; auto dialogue ducking is applied at the master bus.', icon: Music2 },
  { t: 'Edit', sub: 'Open the HTML5 timeline. Trim, grade, layer, keyframe, scope.', icon: Scissors },
  { t: 'Ship', sub: 'Export master, fan to 9:16 / 1:1 / 16:9, route through approval gates.', icon: ShieldCheck },
];

function PipelineSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 30%'] });
  const fillH = useSpring(useTransform(scrollYProgress, [0, 1], ['0%', '100%']), { stiffness: 80, damping: 20 });

  return (
    <section className="relative py-32 md:py-44 px-6">
      <Eyebrow n="07" kicker="Pipeline" />
      <SectionTitle>Eight stages,{' '}<Italic>one continuous take.</Italic></SectionTitle>

      <div ref={ref} className="relative max-w-5xl mx-auto mt-20">
        {/* spine */}
        <div aria-hidden className="absolute left-[19px] md:left-1/2 md:-translate-x-px top-0 bottom-0 w-px bg-white/[0.08]" />
        <motion.div aria-hidden style={{ height: fillH }}
          className="absolute left-[19px] md:left-1/2 md:-translate-x-px top-0 w-px bg-gradient-to-b from-[#0A84FF] via-[#5AC8FA] to-transparent shadow-[0_0_30px_rgba(10,132,255,0.6)]" />

        <div className="space-y-10">
          {STAGES.map((s, i) => {
            const right = i % 2 === 1;
            return (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.8, delay: i * 0.04 }}
                className="relative pl-12 md:pl-0 md:grid md:grid-cols-2 md:gap-12 items-center"
              >
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-1 w-[40px] h-[40px] rounded-full bg-black border border-[#0A84FF]/40 flex items-center justify-center shadow-[0_0_30px_rgba(10,132,255,0.35)]">
                  <s.icon className="w-4 h-4 text-[#0A84FF]" />
                </div>
                <div className={`md:row-start-1 ${right ? 'md:col-start-2 md:pl-12' : 'md:col-start-1 md:pr-12 md:text-right'}`}>
                  <div className="text-[10px] tracking-[0.32em] uppercase text-[#0A84FF]/80 mb-2">Stage {String(i + 1).padStart(2, '0')}</div>
                  <h4 className="font-display text-2xl md:text-3xl text-white tracking-tight mb-2" style={{ fontFamily: "'Fraunces', serif" }}>{s.t}</h4>
                  <p className="text-white/55 text-[14px] leading-relaxed font-light max-w-md md:inline-block">{s.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*                           9. EDITOR MOCKUP                           */
/* =================================================================== */

function EditorMockupSection() {
  return (
    <section className="relative py-32 md:py-44 px-6 overflow-hidden">
      <Eyebrow n="08" kicker="The Editor" />
      <SectionTitle>A pro NLE,{' '}<Italic>in your browser.</Italic></SectionTitle>

      <div className="max-w-7xl mx-auto mt-20 grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_60px_140px_-40px_rgba(10,132,255,0.35)]"
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <div className="ml-4 text-[10.5px] tracking-[0.22em] uppercase text-white/40 font-mono">apex.studio / editor / brand-film-v3</div>
              <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/40">
                <span>4K · 23.976</span>
                <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
                <span>Auto-Sync</span>
              </div>
            </div>

            {/* Viewer */}
            <div className="relative aspect-[16/9] bg-black">
              <VideoTile src={KLING_VIDEO} className="brightness-[0.85]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* Scopes overlay (top-right) */}
              <div className="absolute top-3 right-3 flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-16 h-12 rounded-md border border-white/15 bg-black/60 backdrop-blur-md p-1.5 overflow-hidden">
                    <div className="text-[7.5px] uppercase tracking-[0.18em] text-white/40">{['Wave', 'Vec', 'Hist'][i]}</div>
                    <svg viewBox="0 0 60 24" className="w-full h-7 mt-0.5">
                      <path d="M0 18 Q 10 4 20 14 T 40 10 T 60 16" stroke="#0A84FF" strokeWidth="1" fill="none" />
                    </svg>
                  </div>
                ))}
              </div>
              {/* Transport */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
                <button className="w-9 h-9 rounded-full bg-white/[0.10] border border-white/15 backdrop-blur-md flex items-center justify-center text-white">
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-white/70">00:00:24:12</span>
                <div className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-[#0A84FF] origin-left"
                    animate={{ scaleX: [0, 1] }} transition={{ duration: 12, ease: 'linear', repeat: Infinity }} />
                </div>
                <span className="text-[11px] font-mono text-white/40">/ 00:01:36:00</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-black/80 border-t border-white/[0.06]">
              {/* Ruler */}
              <div className="flex items-center gap-0 h-6 border-b border-white/[0.06] px-2 font-mono text-[9px] text-white/35">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 text-left">{i % 2 === 0 ? `${i}s` : ''}</div>
                ))}
              </div>
              {/* Tracks */}
              <TimelineTrack label="V2" color="#5AC8FA" segments={[{ x: 6, w: 28, lbl: 'B-roll' }, { x: 50, w: 18, lbl: 'Insert' }]} />
              <TimelineTrack label="V1" color="#0A84FF" segments={[{ x: 0, w: 38, lbl: 'Hero · Scene 01' }, { x: 40, w: 22, lbl: 'Scene 02' }, { x: 64, w: 30, lbl: 'Scene 03' }]} />
              <TimelineTrack label="A1" color="#7DD3FC" segments={[{ x: 0, w: 94, lbl: 'Score · MusicGen v2' }]} thin />
              <TimelineTrack label="A2" color="#9DCBFF" segments={[{ x: 4, w: 36, lbl: 'VO · Emma' }, { x: 44, w: 18, lbl: 'VO · Marcus' }]} thin />
              <div className="h-3" />
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {[
            { icon: Layers, t: 'Multi-track HTML5 timeline', d: 'Native, no plugins. Drop video, audio, text, overlays — magnetic sequencing keeps the cut tight.' },
            { icon: Scissors, t: 'Keyframes, transitions, FX', d: 'Curved interpolation, dissolves, push, slide, whip — and a 3-way color grade panel.' },
            { icon: Eye, t: 'Pro scopes & monitoring', d: 'Waveform, vectorscope, histogram. Timecode-accurate. Built for finishing.' },
            { icon: Volume2, t: 'Multi-track audio bus', d: 'Score, dialogue and SFX live on independent buses with auto-ducking.' },
            { icon: GitBranch, t: 'Variant export engine', d: 'One master fans to 9:16, 1:1, 16:9 — with hooks, captions and CTAs auto-tailored.' },
          ].map((f) => (
            <motion.div key={f.t}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-5%' }}
              transition={{ duration: 0.7 }}
              className="flex gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-[#0A84FF]/[0.12] border border-[#0A84FF]/20 flex items-center justify-center">
                <f.icon className="w-4 h-4 text-[#0A84FF]" />
              </div>
              <div>
                <div className="font-display text-lg text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>{f.t}</div>
                <div className="text-[13px] text-white/55 leading-relaxed font-light mt-1">{f.d}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineTrack({
  label, color, segments, thin = false,
}: { label: string; color: string; segments: { x: number; w: number; lbl: string }[]; thin?: boolean }) {
  return (
    <div className={`flex items-center px-2 border-b border-white/[0.04] ${thin ? 'h-8' : 'h-12'}`}>
      <div className="w-9 text-[10px] font-mono text-white/40 uppercase tracking-[0.18em]">{label}</div>
      <div className="relative flex-1 h-full">
        {segments.map((s, i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-1 bottom-1 origin-left rounded-md flex items-center px-2 overflow-hidden"
            style={{
              left: `${s.x}%`,
              width: `${s.w}%`,
              background: `linear-gradient(90deg, ${color}33, ${color}1A)`,
              borderLeft: `2px solid ${color}`,
              boxShadow: `inset 0 0 0 1px ${color}22`,
            }}
          >
            <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/75 truncate">{s.lbl}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* =================================================================== */
/*                       10. CREATE-PAGE MOCKUP                         */
/* =================================================================== */

const SUGGEST_PROMPTS = [
  'A noir-styled product reveal of a chrome watch under volumetric light',
  'Anime opening: rooftop at dusk, lone hero, gust of wind, no dialogue',
  'Documentary opener: founder walks the warehouse floor, voiceover swells',
  '4th-wall break — Emma turns to camera and addresses the viewer',
];

function CreatePageMockup({ onSignup }: { onSignup: () => void }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % SUGGEST_PROMPTS.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative py-32 md:py-44 px-6 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(50% 60% at 50% 30%, hsla(212,100%,52%,0.14), transparent 70%)',
        }} />
      </div>

      <Eyebrow n="09" kicker="The Create Page" />
      <SectionTitle>Where{' '}<Italic>a sentence becomes a film.</Italic></SectionTitle>
      <p className="mt-6 max-w-2xl mx-auto text-center text-white/55 text-base md:text-lg font-light">
        A peek at the room you walk into after sign-in. Type a brief, pick a cast,
        choose a world — Apex takes it from there.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-5xl mx-auto mt-16"
      >
        {/* Glow halo */}
        <div aria-hidden className="absolute -inset-12 -z-10 bg-[#0A84FF]/20 blur-[120px]" />

        <div className="relative rounded-3xl overflow-hidden border border-white/[0.10] bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-2xl shadow-[0_60px_160px_-40px_rgba(10,132,255,0.45)]">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 h-10 border-b border-white/[0.06] bg-black/30">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <div className="mx-auto text-[10.5px] tracking-[0.22em] uppercase text-white/40 font-mono">apex.studio / create / new-project</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Untitled</div>
          </div>

          <div className="p-8 md:p-12">
            {/* Brief input */}
            <div className="text-[10.5px] uppercase tracking-[0.32em] text-[#0A84FF]/80 mb-3">Step 01 · Brief</div>
            <div className="font-display text-3xl md:text-5xl text-white tracking-[-0.02em] leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>
              Tell me about your film.
            </div>

            <div className="mt-8 relative rounded-2xl border border-white/[0.10] bg-black/40 backdrop-blur-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/[0.15] border border-[#0A84FF]/30 flex items-center justify-center shrink-0">
                  <Wand2 className="w-4 h-4 text-[#0A84FF]" />
                </div>
                <div className="flex-1 min-h-[80px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.6 }}
                      className="text-white/85 text-base md:text-lg font-light leading-relaxed"
                    >
                      {SUGGEST_PROMPTS[active]}
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="inline-block w-[2px] h-5 bg-[#0A84FF] ml-1 align-middle"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <button className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/60">
                    <Mic2 className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/60">
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button className="h-10 px-4 rounded-lg bg-[#0A84FF] text-white text-[12px] font-medium tracking-wide flex items-center gap-2">
                    Generate <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pill controls */}
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { i: Camera, l: 'Cinematic' },
                  { i: Users, l: '2 avatars' },
                  { i: Box, l: 'Neon Noir' },
                  { i: Music2, l: 'Score: tense' },
                  { i: Languages, l: 'EN · ES · JA' },
                  { i: Hash, l: '9:16 · 1:1 · 16:9' },
                ].map((p) => (
                  <span key={p.l} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/65 tracking-wide">
                    <p.i className="w-3 h-3 text-[#0A84FF]" /> {p.l}
                  </span>
                ))}
              </div>
            </div>

            {/* Casting & worlds preview */}
            <div className="mt-8 grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10.5px] uppercase tracking-[0.28em] text-white/45">Cast</div>
                  <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#0A84FF]/80">2 selected</div>
                </div>
                <div className="flex -space-x-3">
                  {[avEmma, avMarcus, avZara, avHiroshi, avCamila].map((src, i) => (
                    <div key={i} className="w-12 h-12 rounded-full overflow-hidden border-2 border-black ring-1 ring-white/10">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <button className="w-12 h-12 rounded-full bg-white/[0.04] border-2 border-black ring-1 ring-white/10 flex items-center justify-center text-white/50 text-lg">+</button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10.5px] uppercase tracking-[0.28em] text-white/45">World</div>
                  <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#0A84FF]/80">Neon Noir</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[envNeon, envCherry, envSpace, envGolden].map((src, i) => (
                    <div key={i} className={`relative aspect-square rounded-md overflow-hidden border ${i === 0 ? 'border-[#0A84FF]/60' : 'border-white/[0.08]'}`}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {i === 0 && <div className="absolute inset-0 ring-2 ring-inset ring-[#0A84FF]/60 rounded-md" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA — sign in to actually create */}
            <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-5 p-5 rounded-2xl border border-white/[0.10] bg-gradient-to-r from-[#0A84FF]/[0.08] to-transparent">
              <div>
                <div className="font-display text-xl md:text-2xl text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
                  This is the room you walk into.
                </div>
                <div className="text-[13px] text-white/55 mt-1 font-light">
                  Sign up free to set your first scene — credits cost $0.10 each, no expiry.
                </div>
              </div>
              <button
                onClick={onSignup}
                className="group h-12 px-7 rounded-full bg-white text-black hover:bg-white/90 text-sm font-medium inline-flex items-center gap-2.5 shadow-[0_20px_50px_-20px_rgba(255,255,255,0.4)]"
              >
                Sign up to create <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* =================================================================== */
/*                          11. FINAL CTA                               */
/* =================================================================== */

function FinalCTA({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="relative py-40 md:py-56 px-6 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(60% 70% at 50% 40%, hsla(212,100%,52%,0.20), transparent 70%)',
        }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl mx-auto text-center"
      >
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl mb-8">
          <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
          <span className="text-[10.5px] font-medium text-white/65 tracking-[0.32em] uppercase">The doors are open</span>
        </div>
        <h2 className="font-display text-5xl md:text-7xl font-bold text-white tracking-[-0.035em] mb-8 leading-[1.02]" style={{ fontFamily: "'Fraunces', serif" }}>
          Ready to{' '}<Italic>roll camera?</Italic>
        </h2>
        <p className="text-white/55 text-lg md:text-xl font-light leading-relaxed mb-12 max-w-xl mx-auto">
          Walk in. Cast your first character, set your first scene, score your first cut. The room is warm.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onEnter}
            className="group h-14 px-10 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.04] shadow-[0_20px_60px_-20px_rgba(255,255,255,0.4)] inline-flex items-center gap-2.5"
          >
            Enter the Studio
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.div>
    </section>
  );
}