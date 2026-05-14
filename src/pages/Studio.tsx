import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useSafeNavigation } from '@/lib/navigation';
import { PublicMarketingShell } from '@/components/shell/PublicMarketingShell';
import {
  Wand2, Image as ImageIcon, Mic, Music2, Users, Lock,
  Layers, Workflow, Palette, Globe2, GitBranch, Sparkles,
  Film, Camera, Type, Scissors, ArrowRight, Play,
} from 'lucide-react';
import { CategoryChooserOverlay, type AudienceCategory } from '@/components/landing/CategoryChooserOverlay';

import textToVideo from '@/assets/features/text-to-video-premium.jpg';
import imageToVideo from '@/assets/features/image-to-video-premium.jpg';
import characterLock from '@/assets/features/character-lock-premium.jpg';
import voiceover from '@/assets/features/voiceover-premium.jpg';
import music from '@/assets/features/music-premium.jpg';
import styleTransfer from '@/assets/features/style-transfer-premium.jpg';

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

import sceneCinematic from '@/assets/scenes/cinematic-hero-preview.jpg';
import sceneFourthWall from '@/assets/scenes/4th-wall-breakthrough-preview.jpg';
import sceneEmbed from '@/assets/scenes/minimal-embed-preview.jpg';

/* ----------------------------- Data --------------------------------- */

const CAPABILITIES = [
  { icon: Wand2, title: 'Text → Video', tag: 'Generation', img: textToVideo,
    desc: 'Type a scene, get a fully-rendered cinematic clip with native audio, camera motion and dialogue. Powered by Kling V3.' },
  { icon: ImageIcon, title: 'Image → Video', tag: 'Generation', img: imageToVideo,
    desc: 'Animate any still — stills become living frames with preserved identity, lighting and atmosphere.' },
  { icon: Users, title: 'Multi-Character Dialogue', tag: 'Avatars', img: characterLock,
    desc: 'Cast two avatars in the same scene. Cinematic switch protocols handle eyelines, beats and acting.' },
  { icon: Lock, title: 'Character Lock', tag: 'Identity', img: characterLock,
    desc: 'Face-lock identity engine prevents drift across hops — your hero looks like your hero, every clip.' },
  { icon: Mic, title: 'Voice & Lip-Sync', tag: 'Audio', img: voiceover,
    desc: 'Studio-grade voiceover with frame-accurate lip-sync and automated dialogue ducking under score.' },
  { icon: Music2, title: 'Cinematic Score', tag: 'Audio', img: music,
    desc: 'MusicGen composes original score that breathes with your edit — never a stock loop.' },
  { icon: Palette, title: 'Style & Look', tag: 'Direction', img: styleTransfer,
    desc: 'Anime, neo-noir, documentary, hyper-real — lock a visual grammar and apply it across the cut.' },
  { icon: Scissors, title: 'Pro Editor', tag: 'Post', img: textToVideo,
    desc: 'HTML5 timeline, multi-track audio, keyframes, scopes and 3-way color. Desktop studio in the browser.' },
] as const;

const PILLARS = [
  { icon: Sparkles, k: '01', title: 'Direct',
    body: 'Speak the film. We translate brief into screenplay, shot list, casting and score in a single sweep.' },
  { icon: Film, k: '02', title: 'Generate',
    body: 'A single Kling V3 engine handles T2V and I2V with native audio and extended clip duration. No model juggling.' },
  { icon: Workflow, k: '03', title: 'Continuity',
    body: 'A 7-tier fallback and persistent continuity manifest keep characters, wardrobe and lighting locked across hops.' },
  { icon: GitBranch, k: '04', title: 'Variants',
    body: 'One master film fans out into 9:16, 1:1 and 16:9 platform cuts with hooks, captions and CTAs auto-tailored.' },
  { icon: Globe2, k: '05', title: 'Localize',
    body: 'Re-voice and re-caption in 30+ languages without re-rendering a single frame.' },
  { icon: Layers, k: '06', title: 'Ship',
    body: 'Approval gates, role-based review, audit trail. Export an HD master or push to social, all from one room.' },
] as const;

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
] as const;

const SCENES = [
  { img: sceneCinematic, title: 'Cinematic Hero', body: 'Anamorphic frame, volumetric light, slow dolly. The opening minute of your brand film.' },
  { img: sceneFourthWall, title: '4th-Wall Break', body: 'Avatar steps out of the frame to address the viewer directly — built for hook-first social.' },
  { img: sceneEmbed, title: 'Minimal Embed', body: 'Editorial restraint. A single subject, generous negative space, score breathing underneath.' },
] as const;

const STAGES: { t: string; sub: string }[] = [
  { t: 'Brief', sub: 'Drop a sentence or a deck. We extract intent, audience and tone.' },
  { t: 'Screenplay', sub: 'Cinematic script with verbatim dialogue preservation.' },
  { t: 'Casting', sub: 'Pick avatars or generate them. Identity locked from frame one.' },
  { t: 'Shot List', sub: 'Smart placement engine sets posture, anchor and camera per beat.' },
  { t: 'Generation', sub: 'Kling V3 renders with native audio. Watchdog handles timeouts.' },
  { t: 'Score', sub: 'MusicGen composes; dialogue ducking is automatic.' },
  { t: 'Edit', sub: 'Open the HTML5 timeline. Trim, grade, layer, keyframe.' },
  { t: 'Ship', sub: 'Export master, fan to platform cuts, route through approvals.' },
];

/* ----------------------------- Page --------------------------------- */

export default function Studio() {
  const { navigate } = useSafeNavigation();
  const [chooserOpen, setChooserOpen] = useState(false);
  const handleEnter = useCallback(() => setChooserOpen(true), []);
  const handleSelect = useCallback((category: AudienceCategory) => {
    try { localStorage.setItem('apex.audience', category); } catch {}
    setChooserOpen(false);
    navigate(`/start?type=${category}`);
  }, [navigate]);

  /* SEO */
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Enter the Studio — every capability, one cinematic room | Apex';
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') ?? '';
    meta?.setAttribute('content', 'Tour every capability of Apex Studio: text-to-video, image-to-video, avatars, character lock, voice, score, style and the pro editor — with examples.');
    return () => {
      document.title = prevTitle;
      meta?.setAttribute('content', prevDesc);
    };
  }, []);

  return (
    <PublicMarketingShell>
      <StudioHero onEnter={handleEnter} />
      <CapabilitiesSection />
      <PillarsSection />
      <ScenesSection />
      <TemplatesMarquee />
      <PipelineSection />
      <SpecsSection />
      <StudioFinalCTA onEnter={handleEnter} />
      <CategoryChooserOverlay open={chooserOpen} onClose={() => setChooserOpen(false)} onSelect={handleSelect} />
    </PublicMarketingShell>
  );
}

/* ----------------------------- Hero --------------------------------- */

function StudioHero({ onEnter }: { onEnter: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.2]);

  return (
    <section ref={ref} className="relative min-h-[100vh] flex items-center justify-center pt-32 pb-24 overflow-hidden">
      {/* Cinematic backdrop */}
      <motion.div style={{ y, opacity }} aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(800px 600px at 18% 20%, hsla(212,100%,52%,0.18), transparent 60%),' +
              'radial-gradient(700px 500px at 82% 30%, hsla(190,90%,55%,0.10), transparent 60%),' +
              'radial-gradient(900px 700px at 50% 110%, hsla(212,100%,52%,0.08), transparent 70%)',
          }}
        />
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      </motion.div>

      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl mb-10"
        >
          <span className="w-1 h-1 rounded-full bg-[#0A84FF] animate-pulse" />
          <span className="text-[10.5px] font-medium text-white/70 tracking-[0.32em] uppercase">
            The Studio Tour
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="font-display text-[3.4rem] md:text-[6.4rem] leading-[0.96] tracking-[-0.04em] text-white mb-8"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Step inside.{' '}
          <span
            className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
          >
            Every craft, one room.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-white/55 text-lg md:text-2xl font-light leading-relaxed max-w-2xl mx-auto mb-12"
        >
          A tour through every capability of Apex Studio — from screenplay to score,
          from generation to grade. Eight crafts, one cinematic room.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.35 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onEnter}
            className="group h-14 px-10 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.04] shadow-[0_20px_60px_-20px_rgba(255,255,255,0.4)] inline-flex items-center gap-2.5"
          >
            Enter the Studio
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <a
            href="#capabilities"
            className="h-14 px-10 text-sm font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all inline-flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            Take the tour
          </a>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-px max-w-4xl mx-auto rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl"
        >
          {[
            { k: '8', l: 'Crafts unified' },
            { k: '30+', l: 'Languages' },
            { k: '$0.10', l: 'Per credit' },
            { k: 'Kling V3', l: 'Engine' },
          ].map((s) => (
            <div key={s.l} className="bg-black/40 p-6 text-left">
              <div className="font-display text-3xl md:text-4xl text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
                {s.k}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/50">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------- Capabilities ----------------------------- */

function CapabilitiesSection() {
  return (
    <section id="capabilities" className="relative py-32 md:py-44 px-6">
      <SectionEyebrow n="01" kicker="Capabilities" />
      <SectionTitle>
        The crafts inside.{' '}
        <span className="italic font-light text-white/60" style={{ fontFamily: "'Fraunces', serif" }}>
          Each one fluent in cinema.
        </span>
      </SectionTitle>

      <div className="max-w-7xl mx-auto mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {CAPABILITIES.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.8, delay: (i % 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <img
                src={c.img}
                alt={c.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.08]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.04]" />
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                <c.icon className="w-3 h-3 text-[#0A84FF]" />
                <span className="text-[9.5px] tracking-[0.22em] uppercase text-white/70">{c.tag}</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3
                  className="font-display text-2xl md:text-[1.7rem] leading-tight text-white tracking-tight mb-2"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {c.title}
                </h3>
                <p className="text-[13px] text-white/65 leading-relaxed font-light">
                  {c.desc}
                </p>
              </div>
              <div
                aria-hidden
                className="absolute -bottom-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Pillars -------------------------------- */

function PillarsSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <SectionEyebrow n="02" kicker="Method" />
      <SectionTitle>
        The six movements{' '}
        <span className="italic font-light text-white/60" style={{ fontFamily: "'Fraunces', serif" }}>
          of every film.
        </span>
      </SectionTitle>

      <div className="max-w-6xl mx-auto mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.8, delay: (i % 3) * 0.08 }}
            className="group relative p-8 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-[#0A84FF]/[0.10] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            />
            <div className="flex items-start justify-between mb-8">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <p.icon className="w-5 h-5 text-[#0A84FF]" />
              </div>
              <span className="font-display text-xl text-white/30 tracking-wide" style={{ fontFamily: "'Fraunces', serif" }}>
                {p.k}
              </span>
            </div>
            <h3 className="font-display text-3xl text-white mb-3 tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
              {p.title}
            </h3>
            <p className="text-[13.5px] text-white/55 leading-relaxed font-light">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------- Scenes -------------------------------- */

function ScenesSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <SectionEyebrow n="03" kicker="Examples" />
      <SectionTitle>
        Three scenes,{' '}
        <span className="italic font-light text-white/60" style={{ fontFamily: "'Fraunces', serif" }}>
          three grammars.
        </span>
      </SectionTitle>

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
                  <img src={s.img} alt={s.title} loading="lazy"
                       className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.05]" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-5 left-5 px-3 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md text-[10px] tracking-[0.24em] uppercase text-white/70">
                    Scene {String(i + 1).padStart(2, '0')}
                  </div>
                  <button
                    aria-label="Preview"
                    className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-white/[0.08] border border-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/[0.16] transition"
                  >
                    <Play className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
                {/* Glow under */}
                <div aria-hidden className="absolute -inset-x-10 -bottom-10 h-24 bg-[#0A84FF]/20 blur-3xl -z-10" />
              </div>
              <div className="lg:col-span-5">
                <div className="text-[10px] tracking-[0.32em] uppercase text-[#0A84FF]/80 mb-4">Example {i + 1}</div>
                <h3 className="font-display text-4xl md:text-5xl text-white tracking-[-0.02em] mb-5" style={{ fontFamily: "'Fraunces', serif" }}>
                  {s.title}
                </h3>
                <p className="text-white/60 text-base md:text-lg font-light leading-relaxed mb-8">
                  {s.body}
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Anamorphic', 'Native audio', 'Identity-locked', 'Auto-graded'].map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60 tracking-wide">
                      {t}
                    </span>
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

/* -------------------------- Templates ------------------------------- */

function TemplatesMarquee() {
  // Two rows scrolling opposite directions
  const rowA = useMemo(() => [...TEMPLATES, ...TEMPLATES], []);
  const rowB = useMemo(() => [...TEMPLATES.slice().reverse(), ...TEMPLATES.slice().reverse()], []);

  return (
    <section className="relative py-32 md:py-44 overflow-hidden">
      <div className="px-6">
        <SectionEyebrow n="04" kicker="Templates" />
        <SectionTitle>
          Forty starting points.{' '}
          <span className="italic font-light text-white/60" style={{ fontFamily: "'Fraunces', serif" }}>
            One blank canvas.
          </span>
        </SectionTitle>
        <p className="max-w-2xl mx-auto text-center text-white/50 text-base font-light mt-6">
          A library of cinematic templates across brand, narrative, social, education and music — each one a directorial shortcut, never a stock loop.
        </p>
      </div>

      <div className="relative mt-20 space-y-5">
        {/* edge fades */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />

        <MarqueeRow items={rowA} direction="left" />
        <MarqueeRow items={rowB} direction="right" />
      </div>
    </section>
  );
}

function MarqueeRow({ items, direction }: { items: { img: string; label: string }[]; direction: 'left' | 'right' }) {
  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex gap-5 w-max"
        animate={{ x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
      >
        {items.map((t, i) => (
          <div key={`${t.label}-${i}`} className="relative w-64 h-40 shrink-0 rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] group">
            <img src={t.img} alt={t.label} loading="lazy"
                 className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <div className="text-[11px] tracking-[0.22em] uppercase text-white/85">{t.label}</div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* --------------------------- Pipeline ------------------------------- */

function PipelineSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <SectionEyebrow n="05" kicker="Workflow" />
      <SectionTitle>
        Eight stages,{' '}
        <span className="italic font-light text-white/60" style={{ fontFamily: "'Fraunces', serif" }}>
          one continuous take.
        </span>
      </SectionTitle>

      <div className="relative max-w-5xl mx-auto mt-20">
        {/* spine */}
        <div aria-hidden className="absolute left-[19px] md:left-1/2 md:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.10] to-transparent" />
        <div className="space-y-10">
          {STAGES.map((s, i) => {
            const right = i % 2 === 1;
            return (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.7, delay: i * 0.04 }}
                className={`relative pl-12 md:pl-0 md:grid md:grid-cols-2 md:gap-12 items-center`}
              >
                {/* node */}
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-2 w-[38px] h-[38px] rounded-full bg-black border border-[#0A84FF]/40 flex items-center justify-center text-[11px] font-medium text-[#0A84FF] tracking-wider shadow-[0_0_30px_rgba(10,132,255,0.35)]">
                  {String(i + 1).padStart(2, '0')}
                </div>

                <div className={`md:col-start-${right ? 2 : 1} md:row-start-1 ${right ? 'md:pl-12' : 'md:pr-12 md:text-right'}`}>
                  <h4 className="font-display text-2xl md:text-3xl text-white tracking-tight mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
                    {s.t}
                  </h4>
                  <p className="text-white/55 text-[14px] leading-relaxed font-light max-w-md md:inline-block">
                    {s.sub}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- Specs --------------------------------- */

function SpecsSection() {
  const SPECS = [
    { icon: Camera, label: 'Engine', value: 'Kling V3', sub: 'Native audio, extended duration' },
    { icon: Lock, label: 'Identity', value: 'Face-Lock', sub: '7-tier continuity fallback' },
    { icon: Music2, label: 'Score', value: 'MusicGen', sub: 'Auto dialogue ducking' },
    { icon: Type, label: 'Typography', value: 'Fraunces', sub: 'Serif, in-product display face' },
    { icon: Globe2, label: 'Localization', value: '30+ languages', sub: 'No re-render required' },
    { icon: Layers, label: 'Pricing', value: '$0.10 / credit', sub: 'Pay-as-you-ship, non-expiring' },
  ];
  return (
    <section className="relative py-32 md:py-44 px-6">
      <SectionEyebrow n="06" kicker="Specifications" />
      <SectionTitle>
        The technical{' '}
        <span className="italic font-light text-white/60" style={{ fontFamily: "'Fraunces', serif" }}>
          fine print.
        </span>
      </SectionTitle>

      <div className="max-w-6xl mx-auto mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.04]">
        {SPECS.map((s) => (
          <div key={s.label} className="relative bg-black/60 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <s.icon className="w-4 h-4 text-[#0A84FF]" />
              <span className="text-[10px] tracking-[0.28em] uppercase text-white/35">{s.label}</span>
            </div>
            <div className="font-display text-3xl text-white tracking-tight mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
              {s.value}
            </div>
            <div className="text-[12px] text-white/45 font-light">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------- Final CTA ----------------------------- */

function StudioFinalCTA({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="relative py-40 md:py-56 px-6 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(60% 70% at 50% 40%, hsla(212,100%,52%,0.18), transparent 70%)',
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
          <span className="text-[10.5px] font-medium text-white/65 tracking-[0.32em] uppercase">Open the doors</span>
        </div>
        <h2 className="font-display text-5xl md:text-7xl font-bold text-white tracking-[-0.035em] mb-8 leading-[1.02]" style={{ fontFamily: "'Fraunces', serif" }}>
          Ready to{' '}
          <span className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent">
            roll camera?
          </span>
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

/* --------------------------- Primitives ----------------------------- */

function SectionEyebrow({ n, kicker }: { n: string; kicker: string }) {
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className="font-display text-center text-4xl md:text-6xl text-white tracking-[-0.03em] leading-[1.05] max-w-4xl mx-auto"
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      {children}
    </motion.h2>
  );
}