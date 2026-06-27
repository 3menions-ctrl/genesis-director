import { memo, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  ArrowRight, Shield, Layers, Film, Music,
  Eye, Zap, Brain, Camera, Palette, Lock,
  Sparkles, ChevronDown, Image as ImageIcon, Users, LayoutTemplate,
  Globe, AudioLines, Type, Wand2, Cpu, Share2, Code2, Scissors
} from 'lucide-react';
import { GlassButton } from '@/components/foundation/Floating';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { VioletBackdrop } from '@/components/marketing/VioletBackdrop';
import { Footer as SiteFooter } from '@/components/cinema/Footer';
import { PhotoBand } from '@/components/marketing/PhotoBand';

import { usePageMeta } from '@/hooks/usePageMeta';
// ─── Pipeline Layer Data ────────────────────────────────────────────
const PIPELINE_LAYERS = [
  {
    number: '01',
    title: 'Identity Lock System',
    subtitle: '3-Point Character Bible',
    description: 'Every character is anchored by a 3-point identity bible — face geometry, wardrobe DNA, and body proportions. This prevents the morphing and inconsistency that plagues raw AI generation.',
    details: [
      'Face geometry mapping across angles',
      'Wardrobe & accessory consistency lock',
      'Body proportion anchoring per scene',
      '7-tier continuity fallback chain',
    ],
    icon: <Lock className="w-6 h-6" />,
    gradient: 'from-white/20 to-white/5',
    accentHsl: '0 0% 100%',
  },
  {
    number: '02',
    title: 'Cinematography Engine',
    subtitle: '12 Camera Movements · 14 Angles · 9 Lighting Styles',
    description: 'A programmatic cinematography layer injects professional camera work, angles, and lighting into every shot — the visual grammar of real film.',
    details: [
      'Dolly push-ins, crane reveals, steadicam tracking',
      'Rembrandt, chiaroscuro, golden hour lighting',
      'Shot-size progression (wide → medium → close)',
      'Static-start positioning — no walking-in artifacts',
    ],
    icon: <Camera className="w-6 h-6" />,
    gradient: 'from-blue-500/20 to-cyan-500/5',
    accentHsl: '200 100% 60%',
  },
  {
    number: '03',
    title: 'Frame-Chain Continuity',
    subtitle: 'Sequential Scene Linking',
    description: 'The last frame of each clip becomes the starting image for the next — preserving posture, lighting, and environment across cuts with zero manual intervention.',
    details: [
      'Automatic last-frame extraction',
      'Lighting & color temperature matching',
      'Posture and gesture continuity',
      'Golden-frame fallback for failed extractions',
    ],
    icon: <Layers className="w-6 h-6" />,
    gradient: 'from-violet-500/20 to-purple-500/5',
    accentHsl: '270 80% 65%',
  },
  {
    number: '04',
    title: 'Cinematic Auditor',
    subtitle: 'Pre-Generation Review Agent',
    description: 'Before a single credit is spent, an AI auditor reviews every prompt for physics violations, continuity breaks, and logical errors — catching problems before they render.',
    details: [
      'Physics plausibility validation',
      'Character continuity cross-check',
      'Scene transition logic analysis',
      'Prompt clarity & specificity scoring',
    ],
    icon: <Eye className="w-6 h-6" />,
    gradient: 'from-amber-500/20 to-orange-500/5',
    accentHsl: '40 100% 60%',
  },
  {
    number: '05',
    title: 'Hallucination Filter',
    subtitle: '25 Negative Prompt Guards',
    description: 'A hardcoded filter of 25+ negative prompts eliminates common AI artifacts — camera rigs, boom mics, lens flares, crew reflections — that break immersion.',
    details: [
      'Production equipment removal (rigs, cranes, mics)',
      'Lens artifact suppression',
      'Crew reflection elimination',
      'UI/watermark prevention',
    ],
    icon: <Shield className="w-6 h-6" />,
    gradient: 'from-rose-500/20 to-red-500/5',
    accentHsl: '0 80% 60%',
  },
  {
    number: '06',
    title: 'Smart Script Engine',
    subtitle: 'Concept → Shot List → Timeline',
    description: 'Transform a single concept into a structured shot list with pacing, transitions, match-cuts, and camera scale progression — all orchestrated automatically.',
    details: [
      'Automatic scene decomposition',
      'Match-cut & dissolve planning',
      'Pacing rhythm optimization',
      'Multi-character blocking intelligence',
    ],
    icon: <Brain className="w-6 h-6" />,
    gradient: 'from-emerald-500/20 to-teal-500/5',
    accentHsl: '160 70% 50%',
  },
  {
    number: '07',
    title: 'Audio Intelligence',
    subtitle: 'TTS · Scoring · Dialogue Ducking',
    description: 'Automated voiceover generation, AI-composed music, and real-time dialogue ducking — music dims to 20% during speech and recovers seamlessly.',
    details: [
      '50+ voice profiles with emotion control',
      'Scene-aware music composition',
      'Automatic dialogue ducking (20% dim)',
      'HLS manifest assembly & sync',
    ],
    icon: <Music className="w-6 h-6" />,
    gradient: 'from-cyan-500/20 to-sky-500/5',
    accentHsl: '190 90% 55%',
  },
  {
    number: '08',
    title: 'Multi-Engine Routing',
    subtitle: 'Wan · Kling · Seedance · Veo · Runway · Sora',
    description: 'No single model is best at everything. Every shot is routed to the right engine — by mode, duration and the look you want — through one unified prompt and post-processing pipeline.',
    details: [
      'Automatic engine selection per shot',
      'Unified prompt engineering across engines',
      'Consistent post-processing pipeline',
      'Quality-optimized routing',
    ],
    icon: <Zap className="w-6 h-6" />,
    gradient: 'from-fuchsia-500/20 to-pink-500/5',
    accentHsl: '300 80% 60%',
  },
];

const COMPARISON_POINTS = [
  { raw: 'Write a prompt, get a clip', us: 'Write a concept, get a film' },
  { raw: 'Characters morph between clips', us: 'Identity locked across every scene' },
  { raw: 'Random camera angles', us: '12 cinematic movements, 14 angles' },
  { raw: 'No scene continuity', us: 'Frame-chained sequential linking' },
  { raw: 'AI artifacts & crew reflections', us: '25-point hallucination filter' },
  { raw: 'Silent video output', us: 'TTS, music, dialogue ducking' },
];

// ─── Studio overview tiles ──────────────────────────────────────────
const OVERVIEW_TILES = [
  { icon: <Film className="w-5 h-5" />, title: 'Non-linear editor', line: 'Stage, timeline, script & storyboard in sync.' },
  { icon: <ImageIcon className="w-5 h-5" />, title: 'Photo & image studio', line: 'Generate stills, then brush-edit and inpaint.' },
  { icon: <Users className="w-5 h-5" />, title: 'A cast that stays itself', line: '461 characters with identity bibles & voices.' },
  { icon: <LayoutTemplate className="w-5 h-5" />, title: 'Templates that ship a look', line: '40+ looks across 7 categories.' },
  { icon: <Globe className="w-5 h-5" />, title: '120 worlds to shoot in', line: 'Lighting, palette & lens, baked into the render.' },
  { icon: <Music className="w-5 h-5" />, title: 'Sound, scored & mixed', line: 'Composer presets, per-clip EQ & loudness.' },
  { icon: <Palette className="w-5 h-5" />, title: 'Finish like film', line: 'Color grade, chyrons & motion VFX.' },
  { icon: <Cpu className="w-5 h-5" />, title: 'Six engines, one pipeline', line: 'The studio routes each shot to the right model.' },
  { icon: <Share2 className="w-5 h-5" />, title: 'Ship it, together', line: 'Render queue, publishing & live collaboration.' },
  { icon: <Code2 className="w-5 h-5" />, title: 'Built for developers', line: 'API keys & webhooks from your account.' },
];

// ─── Engine catalog ─────────────────────────────────────────────────
const ENGINE_CATALOG = [
  { name: 'Wan 2.5', maker: 'Alibaba' },
  { name: 'Kling V3', maker: 'Kuaishou' },
  { name: 'Seedance 2.0', maker: 'ByteDance' },
  { name: 'Veo 3 Fast', maker: 'Google DeepMind' },
  { name: 'Runway Gen-4', maker: 'Runway' },
  { name: 'Sora 2', maker: 'OpenAI' },
];

// ─── Section heading helper ─────────────────────────────────────────
function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="mb-12 md:mb-16 max-w-3xl"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-violet-300">{eyebrow}</span>
      <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
      <p className="mt-4 text-base md:text-lg text-white/55 leading-relaxed">{intro}</p>
    </motion.div>
  );
}

// ─── Animated Layer Card ────────────────────────────────────────────
const LayerCard = memo(function LayerCard({ layer, index }: { layer: typeof PIPELINE_LAYERS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="relative">
      {/* Connecting line */}
      {index < PIPELINE_LAYERS.length - 1 && (
        <div className="absolute left-1/2 -translate-x-px top-full w-px h-16 md:h-24 bg-gradient-to-b from-white/10 to-transparent" />
      )}

      <motion.div
        initial={{ opacity: 0, x: isEven ? -60 : 60, y: 20 }}
        animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className={`relative max-w-3xl ${isEven ? 'mr-auto' : 'ml-auto'}`}
      >
        {/* Ambient glow */}
        <div 
          className="absolute -inset-4 rounded-[2rem] opacity-50 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, hsl(${layer.accentHsl} / 0.15), transparent 70%)` }}
        />

        <div className="group relative">
          <div className="relative p-2 md:p-4">
            {/* Layer number */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div
                  className="relative w-12 h-12 rounded-full flex items-center justify-center text-white/80 transition-colors group-hover:text-white"
                  style={{ filter: `drop-shadow(0 0 14px hsl(${layer.accentHsl} / 0.45))` }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full blur-xl opacity-50 transition-opacity duration-500 group-hover:opacity-90"
                    style={{ background: `radial-gradient(circle, hsl(${layer.accentHsl} / 0.35), transparent 70%)` }}
                  />
                  {layer.icon}
                </div>
                <div>
                  <span className="text-xs font-mono text-white/65 tracking-widest">LAYER {layer.number}</span>
                  <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight">{layer.title}</h3>
                </div>
              </div>
            </div>

            <p className="text-sm font-medium text-white/50 mb-3 tracking-wide uppercase">{layer.subtitle}</p>
            <p className="text-[15px] text-white/75 leading-relaxed mb-6">{layer.description}</p>

            {/* Detail list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {layer.details.map((detail, i) => (
                <motion.div
                  key={detail}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-start gap-2.5"
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: `hsl(${layer.accentHsl})`, boxShadow: `0 0 8px hsl(${layer.accentHsl} / 0.5)` }}
                  />
                  <span className="text-sm text-white/50">{detail}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

// ─── Main Page ──────────────────────────────────────────────────────
export default function HowItWorks() {
  usePageMeta({ title: "How It Works — Small Bridges", description: "The whole studio in one tab: a non-linear editor, photo editor, 461 avatars, scored music, 6 video engines, film-grade color and one-click export — all from a sentence." });

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <MarketingHeader />
      {/* Ambient background */}
      <VioletBackdrop />

      {/* Hero */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-10 min-h-[85vh] flex flex-col items-center justify-center px-6 pt-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] backdrop-blur-xl mb-8">
            <Sparkles className="w-3.5 h-3.5 text-white/50" />
            <span className="text-xs text-white/50 tracking-widest uppercase">Under the Hood</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[0.9]">
            <span className="block text-white">Not just</span>
            <span className="block bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">a prompt box</span>
          </h1>

          <p className="text-lg md:text-xl text-white/35 max-w-2xl mx-auto leading-relaxed mb-6">
            8 engineering layers between your idea and the final video. 
            This is what separates a production pipeline from a text field.
          </p>

          <p className="text-sm text-white/55 mb-12">
            Six frontier engines render the frames — <span className="text-white/75 font-medium">the film is everything between them</span>.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8"
        >
          <ChevronDown className="w-6 h-6 text-white/55 animate-bounce" style={{ animationDuration: '2s' }} />
        </motion.div>
      </motion.section>

      {/* Editorial photo band */}
      <PhotoBand
        src="/blog/cinema-hero.jpg"
        alt="A film crew on a production set"
        eyebrow="The old way"
        caption="Crews, cameras, edit bays, weeks of work — replaced by a sentence."
        className="py-12 md:py-16"
      />

      {/* Pipeline Layers */}
      <section className="relative z-10 py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20 md:mb-28"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              The 8-Layer Pipeline
            </h2>
            <p className="text-base md:text-lg text-white/35 max-w-lg mx-auto">
              Each layer adds intelligence that raw AI models don't have.
            </p>
          </motion.div>

          <div className="space-y-16 md:space-y-24">
            {PIPELINE_LAYERS.map((layer, i) => (
              <LayerCard key={layer.number} layer={layer} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Studio overview ─────────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="The studio"
            title="The whole studio in one tab"
            intro="Generation is one step. Everything a film needs — written, cast, scored, cut, graded and shipped — happens in the same browser tab."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {OVERVIEW_TILES.map((tile, i) => (
              <motion.div
                key={tile.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: (i % 3) * 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-start gap-4 rounded-2xl p-5 transition-colors"
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))] transition-colors group-hover:text-violet-200">
                  {tile.icon}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white tracking-tight">{tile.title}</h3>
                  <p className="mt-1 text-sm text-white/55 leading-relaxed">{tile.line}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The editor (annotated screenshot) ───────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="The cut"
            title="A real non-linear editor"
            intro="Not a render-and-pray box. A frame-accurate timeline with four synchronized views, default tracks and per-clip audio — the kind of room you actually finish a film in."
          />
          <motion.figure
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.22),_transparent_70%)] blur-2xl pointer-events-none" />
            <div className="relative">
              <img
                src="/cinema-assets/editor-annotated.jpg"
                alt="The Small Bridges editor — four views, a frame-accurate timeline, the cast/voice inspector and per-clip audio mixing, with callouts"
                className="w-full rounded-2xl"
              />
            </div>
          </motion.figure>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
            {[
              'Four synchronized views — Stage (real-time preview), Timeline, Script, Storyboard.',
              'Five default tracks (V3 titles, V2 overlay/VFX, V1 video, A1 dialogue, A2 music) — add, rename, reorder, lock, mute, solo.',
              'Frame-accurate clip ops — trim, split, slip, duplicate, copy/paste, undo/redo, markers, in/out loop.',
              'Playback 0.25×–4×, theater mode.',
            ].map((b, i) => (
              <motion.div
                key={b}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3"
              >
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(216,180,254,0.6)]" />
                <span className="text-sm text-white/65 leading-relaxed">{b}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo & image studio ────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Stills"
            title="Photo & image studio"
            intro="Every film needs key art, plates and inserts. Make them here, then take them to a real editor."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6 }}
              className="relativep-7 md:p-8"
            >
              <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Generate</h3>
              <p className="text-[15px] text-white/65 leading-relaxed">
                Stills from a prompt in <span className="text-violet-300">8 looks</span> — cinematic, editorial, brutalist, dreamlike, product, illustration, noir and poster — across <span className="text-violet-300">6 aspect ratios</span>, 1, 2 or 4 at a time, with reference-image anchoring.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="relativep-7 md:p-8"
            >
              <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                <Wand2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Refine</h3>
              <p className="text-[15px] text-white/65 leading-relaxed">
                A brush-based photo editor to <span className="text-violet-300">mask</span> and <span className="text-violet-300">inpaint</span> exactly what you want changed, with before/after and full undo.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Avatars ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Casting"
            title="A cast that stays itself"
            intro="The hardest part of AI film is a face that survives the cut. Ours is anchored to an identity bible, so it holds."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <motion.figure
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.22),_transparent_70%)] blur-2xl pointer-events-none" />
              <div className="relative">
                <img
                  src="/cinema-assets/surface-avatars.jpg"
                  alt="The Small Bridges avatar library — characters across categories, each with multi-angle reference images"
                  className="w-full rounded-2xl"
                />
              </div>
            </motion.figure>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-lg text-white/70 leading-relaxed">
                <span className="text-white font-semibold">461 characters</span> across <span className="text-violet-300">17+ categories</span>. Each has an identity bible — multi-angle reference images, wardrobe and distinguishing features — so the same face holds shot after shot.
              </p>
              <p className="mt-5 text-[15px] text-white/55 leading-relaxed">
                Assign a voice (ElevenLabs, voice-clone, or OpenAI-TTS) and a role, and they're ready to direct.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Templates ───────────────────────────────────────────── */}
      <section id="templates" className="relative z-10 scroll-mt-24 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Starting points"
            title="Templates that ship a look"
            intro="Don't start from a blank timeline. Start from a finished aesthetic and make it yours."
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="relativep-7 md:p-9"
          >
            <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
              <LayoutTemplate className="w-6 h-6" />
            </div>
            <p className="text-lg text-white/70 leading-relaxed max-w-3xl">
              <span className="text-white font-semibold">40+ built-in templates</span> across <span className="text-violet-300">7 categories</span> — trending, cinematic, commercial, educational, entertainment, corporate and VFX — including <span className="text-violet-300">10 premium "Breakout" 4th-wall VFX templates</span>.
            </p>
            <p className="mt-4 text-[15px] text-white/55 leading-relaxed max-w-3xl">
              Each carries its own clips, durations, transitions, color grade and music mood, with an engine recommended per template and multiple aspect variants.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Environments ────────────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Locations"
            title="120 worlds to shoot in"
            intro="Pick a world and the studio dresses the shot for you — light, color and lens included."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <p className="text-lg text-white/70 leading-relaxed">
                <span className="text-white font-semibold">120+ environments</span> across <span className="text-violet-300">9 worlds</span> — golden-hour, blue-hour, night-neon, storm, wilderness, urban, interiors, surreal and cosmic.
              </p>
              <p className="mt-5 text-[15px] text-white/55 leading-relaxed">
                Each injects lighting, a 4-stop color palette, camera/lens hints and matched VFX into the render.
              </p>
            </motion.div>
            <motion.figure
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative order-1 lg:order-2"
            >
              <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.22),_transparent_70%)] blur-2xl pointer-events-none" />
              <div className="relative">
                <img
                  src="/cinema-assets/surface-environments.jpg"
                  alt="The Small Bridges environment library — worlds with their own lighting and color palettes"
                  className="w-full rounded-2xl"
                />
              </div>
            </motion.figure>
          </div>
        </div>
      </section>

      {/* ── Sound ───────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="The score"
            title="Sound, scored and mixed"
            intro="A film is half sound. The studio composes it, mixes it per clip, and masters it to spec."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <Music className="w-6 h-6" />, title: 'Compose', body: '6 cinematic composer presets — Hans Zimmer, Ramin Djawadi, Steve Jablonsky, Ludwig Göransson, John Williams and Howard Shore.' },
              { icon: <AudioLines className="w-6 h-6" />, title: 'Mix', body: 'Per-clip audio: 3-band EQ, compressor (5 presets), noise reduction and reverb. Voices via ElevenLabs + clones with lip-sync.' },
              { icon: <Zap className="w-6 h-6" />, title: 'Master', body: 'Loudness presets for streaming (-14 LUFS), podcast (-16), broadcast/EBU-R128 (-23) and cinema (-27).' },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.07 }}
                className="relativep-7"
              >
                <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                  {c.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2.5">{c.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{c.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Finish like film ────────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="The finish"
            title="Finish like film"
            intro="The last 10% is what separates a clip from a film. Grade it, title it, and add the motion."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <Palette className="w-6 h-6" />, title: 'Color grading', body: 'LUT looks (film-stock, era, mood, director), lift/gamma/gain wheels, curves (master + RGB), HSL per hue, grain, halation and vignette.' },
              { icon: <Type className="w-6 h-6" />, title: 'Text & chyrons', body: '7 fonts, 17 animations, gradient/stroke/shadow/glow, 9 anchor positions and animated counters.' },
              { icon: <Scissors className="w-6 h-6" />, title: 'Motion VFX', body: '20 effects across light, particle, pigment, geometric, optical and atmospheric, plus 17 timeline transitions.' },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.07 }}
                className="relativep-7"
              >
                <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                  {c.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2.5">{c.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{c.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Engines ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="The engine room"
            title="Six engines, one pipeline"
            intro="No single model is best at everything. The studio routes each shot to the right one."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ENGINE_CATALOG.map((e, i) => (
              <motion.div
                key={e.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
                className="group flex items-center gap-4 rounded-2xl p-5 transition-colors"
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white tracking-tight">{e.name}</h3>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">{e.maker}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-8 text-[15px] text-white/55 leading-relaxed max-w-3xl"
          >
            Text-to-video, image-to-video and avatar modes; the studio routes each shot to the right model. <span className="text-violet-300">Veo 3 and Sora 2 reach 60-second takes with native audio.</span>
          </motion.p>
        </div>
      </section>

      {/* ── Ship it, together ───────────────────────────────────── */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Delivery"
            title="Ship it, together"
            intro="Finishing is a team sport. Render, publish and collaborate without leaving the tab."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6 }}
              className="relativep-7 md:p-8"
            >
              <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Export</h3>
              <p className="text-[15px] text-white/65 leading-relaxed">
                Export in <span className="text-violet-300">6 aspect ratios</span> (16:9, 9:16, 1:1, 21:9, 4:5, 4:3) through a persistent render queue, then publish to your channel.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="relativep-7 md:p-8"
            >
              <div className="relative mb-5 flex h-12 w-12 items-center justify-center text-violet-300 [filter:drop-shadow(0_0_14px_rgba(216,180,254,0.4))]">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Collaborate</h3>
              <p className="text-[15px] text-white/65 leading-relaxed">
                Comments, presence, version snapshots and a <span className="text-violet-300">Director Chat</span> that can rewrite scenes.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Developers ──────────────────────────────────────────── */}
      <section id="developers" className="relative z-10 scroll-mt-24 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-3xl p-8 md:p-12"
          >
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(168,85,247,0.25),_transparent_70%)] blur-2xl pointer-events-none" />
            <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-violet-300">For builders</span>
            <h2 className="mt-4 font-display text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-white">Built for developers</h2>
            <p className="mt-4 max-w-2xl text-base md:text-lg text-white/60 leading-relaxed">
              Programmatic access via <span className="text-violet-300">API keys and webhooks</span> from your account's Developer settings — automate generation and wire Small Bridges into your own pipeline.
            </p>
            <GlassButton to="/auth?mode=signup" tone="solid" size="lg" className="mt-8">
              Get an API key
              <ArrowRight className="w-4 h-4" />
            </GlassButton>
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="relative z-10 py-20 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              Raw AI vs. Small Bridges Pipeline
            </h2>
            <p className="text-base text-white/35">
              The difference between prompting a raw model directly and using our full production system.
            </p>
          </motion.div>

          <div className="divide-y divide-white/[0.06]">
            {COMPARISON_POINTS.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-6 items-center p-4 md:p-5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/10 shrink-0" />
                  <span className="text-sm text-white/65 line-through decoration-white/10">{point.raw}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-white/15 hidden md:block" />
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/60 shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                  <span className="text-sm text-white/70 font-medium">{point.us}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-24 md:py-40 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Ready to create?
          </h2>
          <p className="text-lg text-white/35 mb-10">
            Stop prompting. Start producing.
          </p>
          <GlassButton to="/auth?mode=signup" tone="solid" size="lg" className="btn-star-blink">
            Get Started
            <ArrowRight className="w-5 h-5" />
          </GlassButton>
          <p className="mt-5 text-sm text-white/55">Credit packs start at $9 · No subscription required</p>
        </motion.div>
      </section>

      {/* Footer */}
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}
