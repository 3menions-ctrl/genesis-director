import { memo, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, Shield, Layers, Film, Mic, Music, 
  Eye, Zap, RefreshCw, Brain, Camera, Palette, Lock,
  Sparkles, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';

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
    description: 'A programmatic cinematography layer injects professional camera work, angles, and lighting into every shot — the same visual language used in Hollywood productions.',
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
    title: 'Multi-Model Orchestration',
    subtitle: 'Kling · Veo · Unified Pipeline',
    description: 'We orchestrate across Kling and Veo generation models, selecting the best engine for each shot type — and wrapping both in the same cinematography, identity, and audio layers.',
    details: [
      'Automatic model selection per shot type',
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
  { raw: 'Write a prompt, get a clip', apex: 'Write a concept, get a film' },
  { raw: 'Characters morph between clips', apex: 'Identity locked across every scene' },
  { raw: 'Random camera angles', apex: '12 cinematic movements, 14 angles' },
  { raw: 'No scene continuity', apex: 'Frame-chained sequential linking' },
  { raw: 'AI artifacts & crew reflections', apex: '25-point hallucination filter' },
  { raw: 'Silent video output', apex: 'TTS, music, dialogue ducking' },
];

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
          className="absolute -inset-4 rounded-[2rem] opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, hsl(${layer.accentHsl} / 0.15), transparent 70%)` }}
        />

        <div className="group relative rounded-2xl md:rounded-3xl overflow-hidden">
          {/* Glass border */}
          <div className="absolute inset-0 rounded-2xl md:rounded-3xl p-px">
            <div className={`absolute inset-0 rounded-2xl md:rounded-3xl bg-gradient-to-br ${layer.gradient} opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
          </div>
          
          <div className="relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl md:rounded-3xl p-6 md:p-10 group-hover:border-white/[0.12] transition-all duration-500">
            {/* Layer number */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/[0.1] bg-white/[0.03] group-hover:bg-white/[0.06] transition-all"
                  style={{ boxShadow: `0 0 30px hsl(${layer.accentHsl} / 0.1)` }}
                >
                  <div className="text-white/70 group-hover:text-white transition-colors">
                    {layer.icon}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-mono text-white/30 tracking-widest">LAYER {layer.number}</span>
                  <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight">{layer.title}</h3>
                </div>
              </div>
            </div>

            <p className="text-sm font-medium text-white/50 mb-3 tracking-wide uppercase">{layer.subtitle}</p>
            <p className="text-[15px] text-white/40 leading-relaxed mb-6">{layer.description}</p>

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
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(120,80,200,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(50,130,220,0.06)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,_rgba(200,100,50,0.04)_0%,_transparent_40%)]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <Logo size="md" showText textClassName="text-base" />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
            <Link to="/pricing" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              asChild
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full"
            >
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 btn-star-blink">
              <Link to="/auth?mode=signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8">
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

          <p className="text-sm text-white/20 mb-12">
            Powered by <span className="text-white/40 font-medium">Kling</span> & <span className="text-white/40 font-medium">Veo</span> — orchestrated by Apex
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8"
        >
          <ChevronDown className="w-6 h-6 text-white/20 animate-bounce" style={{ animationDuration: '2s' }} />
        </motion.div>
      </motion.section>

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
              Raw AI vs. Apex Pipeline
            </h2>
            <p className="text-base text-white/35">
              The difference between prompting Kling or Veo directly and using our production system.
            </p>
          </motion.div>

          <div className="space-y-3">
            {COMPARISON_POINTS.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-6 items-center p-4 md:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/10 shrink-0" />
                  <span className="text-sm text-white/30 line-through decoration-white/10">{point.raw}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-white/15 hidden md:block" />
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/60 shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                  <span className="text-sm text-white/70 font-medium">{point.apex}</span>
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
          <Button asChild size="lg" className="h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 btn-star-blink shadow-[0_0_60px_rgba(255,255,255,0.15)]">
            <Link to="/auth?mode=signup">
              Get Started
              <ArrowRight className="w-5 h-5 ml-3" />
            </Link>
          </Button>
          <p className="mt-5 text-sm text-white/20">Credit packs start at $9 · No subscription required</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" showText textClassName="text-sm" />
          <div className="flex items-center gap-6 text-sm text-white/30">
            <Link to="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link to="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
