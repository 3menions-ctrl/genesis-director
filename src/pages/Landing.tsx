import { useEffect, useCallback, lazy, Suspense, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import landingAbstractBg from '@/assets/bg-idea-6-epic-landscape.jpg';

import { LandingNav } from '@/components/landing/LandingNav';
import { B2BHero } from '@/components/landing/B2BHero';
import { HoppyImmersiveIntro } from '@/components/landing/HoppyImmersiveIntro';
import { CategoryChooserOverlay, type AudienceCategory } from '@/components/landing/CategoryChooserOverlay';
import { StudioIntro } from '@/components/intro/StudioIntro';
import { motion } from 'framer-motion';

import { usePageMeta } from '@/hooks/usePageMeta';
// Heavy below-the-fold sections — lazy split to keep first paint snappy
const AudienceSegments = lazy(() => import('@/components/landing/AudienceSegments').then(m => ({ default: m.AudienceSegments })));
const BeforeAfterGallery = lazy(() => import('@/components/landing/BeforeAfterGallery').then(m => ({ default: m.BeforeAfterGallery })));
const SeedanceSection = lazy(() => import('@/components/landing/SeedanceSection').then(m => ({ default: m.SeedanceSection })));
const B2BWorkflow = lazy(() => import('@/components/landing/B2BGlassFeatures').then(m => ({ default: m.B2BWorkflow })));
const FrameChainingSection = lazy(() => import('@/components/landing/FrameChainingSection').then(m => ({ default: m.FrameChainingSection })));
const B2BFinalCTA = lazy(() => import('@/components/landing/B2BFinalCTA').then(m => ({ default: m.B2BFinalCTA })));
const HoppyImmersiveScrollSection = lazy(() =>
  import('@/components/landing/HoppyImmersiveScrollSection').then(m => ({ default: m.HoppyImmersiveScrollSection })),
);
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const FAQSection = lazy(() => import('@/components/landing/FAQSection'));
const Footer = lazy(() => import('@/components/landing/Footer'));

const SectionLoader = () => (
  <div className="py-24 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

const BackgroundFallback = () => <div className="fixed inset-0 bg-black" />;

// Premium section divider — generous breathing room with a hairline glow.
// Defined at module scope so it isn't re-created on every Landing render
// (which was triggering "Function components cannot be given refs" warnings
// when framer-motion's whileInView attached its ref).
const Divider = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const h = size === 'lg' ? 'h-56 md:h-80' : size === 'sm' ? 'h-24 md:h-32' : 'h-40 md:h-56';
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, scaleX: 0.4 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${h} w-full origin-center`}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] max-w-[640px] h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_24px_6px_hsl(212_100%_52%/0.45)]" />
    </motion.div>
  );
};

// Editorial spacing wrapper — generous vertical rhythm around every section.
const Spaced = ({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) => {
  const py = size === 'lg' ? 'py-20 md:py-32' : size === 'sm' ? 'py-8 md:py-14' : 'py-14 md:py-24';
  return <div className={`relative ${py}`}>{children}</div>;
};

// Editorial chapter frame — adds a premium "magazine spread" feel with
// a numbered margin, eyebrow kicker, and faint vertical rail.
const Chapter = ({
  n,
  kicker,
  children,
  size = 'md',
}: {
  n: string;
  kicker: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const py = size === 'lg' ? 'py-24 md:py-40' : size === 'sm' ? 'py-12 md:py-20' : 'py-16 md:py-28';
  return (
    <section className={`relative ${py}`}>
      <div
        aria-hidden
        className="hidden lg:block absolute left-10 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent"
      />
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex absolute left-6 top-12 flex-col items-start gap-3 select-none"
      >
        <span
          className="text-[10px] font-medium text-white/35 tracking-[0.4em] uppercase"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          {n}
        </span>
        <span className="block w-px h-10 bg-gradient-to-b from-[#0A84FF]/60 to-transparent" />
        <span
          className="text-[10px] font-medium text-[#0A84FF]/70 tracking-[0.32em] uppercase rotate-180"
          style={{ writingMode: 'vertical-rl', fontFamily: "'Instrument Sans', sans-serif" }}
        >
          {kicker}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </section>
  );
};

export default function Landing() {
  usePageMeta({ title: "Apex Studio — Cinematic AI video creation", description: "Generate Hollywood-quality video scenes from a single prompt. Avatars, environments, and dialogue, all unified." });

  const { user, loading: authLoading } = useAuth();
  const { navigate } = useSafeNavigation();

  /**
   * Premium presentation gate.
   *
   * The landing must NEVER pop in. On a fresh load (or after logout) we
   * hold a cinematic loader on screen until ALL of these are true:
   *   1. Auth has resolved (so we don't briefly render the public landing
   *      for a returning user we're about to redirect away).
   *   2. The hero background image has fully decoded.
   *   3. Web fonts (Fraunces / Instrument Sans) have loaded — otherwise
   *      the headline reflows from a fallback face.
   *   4. The browser has actually committed a paint (double-rAF).
   *   5. A minimum cinematic beat has elapsed so the loader feels
   *      intentional, not like a flicker.
   *
   * A 4.5s hard ceiling guarantees the user is never stranded.
   */
  const [phaseProgress, setPhaseProgress] = useState(8);
  const [phaseLabel, setPhaseLabel] = useState('Preparing the stage');
  const [presentationReady, setPresentationReady] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [deferredMount, setDeferredMount] = useState(false);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    let cancelled = false;
    const MIN_DISPLAY_MS = 1500;
    const HARD_CEILING_MS = 4500;

    const setPhase = (label: string, p: number) => {
      if (cancelled) return;
      setPhaseLabel(label);
      setPhaseProgress((prev) => Math.max(prev, p));
    };

    setPhase('Preparing the stage', 12);

    // 1. Hero background image — must be decoded before we lift the loader
    const imagePromise = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        setPhase('Loading the scene', 45);
        if (typeof img.decode === 'function') {
          img.decode().then(() => resolve()).catch(() => resolve());
        } else {
          resolve();
        }
      };
      img.onerror = () => resolve();
      img.src = landingAbstractBg;
      // Safety — if decode hangs, don't block the page
      setTimeout(() => resolve(), 3500);
    });

    // 2. Web fonts
    const fontsPromise: Promise<unknown> =
      typeof document !== 'undefined' && (document as any).fonts?.ready
        ? (document as any).fonts.ready
            .then(() => setPhase('Setting the typography', 65))
            .catch(() => undefined)
        : Promise.resolve();

    // 3. Paint commit
    const paintPromise = new Promise<void>((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setPhase('Rendering the frame', 80);
          resolve();
        }),
      );
    });

    Promise.all([imagePromise, fontsPromise, paintPromise]).then(() => {
      if (cancelled) return;
      setPhase('Finalizing', 95);
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        setPhase('Ready', 100);
        setPresentationReady(true);
      }, remaining);
    });

    // Hard ceiling — never strand the user
    const ceiling = setTimeout(() => {
      if (!cancelled) {
        setPhase('Ready', 100);
        setPresentationReady(true);
      }
    }, HARD_CEILING_MS);

    return () => {
      cancelled = true;
      clearTimeout(ceiling);
    };
  }, []);

  // Crossfade the landing in once the loader has dismissed
  useEffect(() => {
    if (!presentationReady || authLoading) return;
    // Wait one frame so the DOM commits at opacity-0 first, then transition
    const raf = requestAnimationFrame(() => setContentVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [presentationReady, authLoading]);

  // Mount the heavy fixed-video layer and lazy chunks after the hero is up
  useEffect(() => {
    if (!contentVisible) return;
    const id = window.setTimeout(() => setDeferredMount(true), 600);
    return () => window.clearTimeout(id);
  }, [contentVisible]);

  useEffect(() => {
    if (user) navigate('/projects');
  }, [user, navigate]);

  const scrollToSection = useCallback((target: string) => {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const handleStart = useCallback(() => setChooserOpen(true), []);
  const handleSelectCategory = useCallback(
    (category: AudienceCategory) => {
      try {
        localStorage.setItem('apex.audience', category);
      } catch {}
      setChooserOpen(false);
      navigate(`/start?type=${category}`);
    },
    [navigate],
  );
  const handleSales = useCallback(() => navigate('/contact?topic=sales'), [navigate]);

  // Cinematic studio entrance — plays before navigating to /studio.
  const [studioIntroPlaying, setStudioIntroPlaying] = useState(false);
  const handleEnterStudio = useCallback(() => {
    setStudioIntroPlaying(true);
    // Navigate during the iris-out reveal (intro total = 4500ms). Going slightly
    // before completion lets /studio paint underneath the white-flash dissolve
    // so there is no black flash between scenes — but late enough that the
    // wordmark + monogram beats are fully visible first.
    window.setTimeout(() => navigate('/studio'), 4300);
  }, [navigate]);

  // The cinema loader is a sibling of the page content. We render the page
  // markup eagerly (hidden at opacity-0) so the browser can lay it out and
  // decode imagery while the loader is still on screen — this guarantees
  // the crossfade reveals an already-painted hero, never a blank flash.
  const showLoader = authLoading || !presentationReady;

  return (
    <>
      <CinemaLoader
        isVisible={showLoader}
        message={phaseLabel}
        progress={phaseProgress}
        showProgress={true}
        variant="fullscreen"
      />
      <div
        className="landing-glass-scope min-h-screen overflow-hidden relative"
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: 'opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)',
          // While hidden, prevent any interaction or layout-shifting work
          pointerEvents: contentVisible ? 'auto' : 'none',
        }}
        aria-hidden={!contentVisible}
      >
      <HoppyImmersiveIntro />

      {/* Abstract Background */}
      <ErrorBoundaryWrapper fallback={<BackgroundFallback />}>
        <Suspense fallback={<BackgroundFallback />}>
          <AbstractBackground className="fixed inset-0 z-0" />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Ambient aurora — subtle blue glow that drifts across the page */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <motion.div
          animate={{ x: ['-10%', '10%', '-10%'], y: ['-5%', '5%', '-5%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1/4 left-1/4 w-[60vw] h-[60vw] rounded-full bg-[#0A84FF]/[0.08] blur-[140px]"
        />
        <motion.div
          animate={{ x: ['8%', '-8%', '8%'], y: ['4%', '-4%', '4%'] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 right-0 w-[50vw] h-[50vw] rounded-full bg-[#5AC8FA]/[0.05] blur-[160px]"
        />
      </div>

      <LandingNav onScrollToSection={scrollToSection} onNavigate={handleNavigate} onGetStarted={handleStart} />

      {/* Immersive scroll-locked full-video moment — deferred until after
          first paint so it never competes with the hero render. */}
      {deferredMount && (
        <ErrorBoundaryWrapper fallback={null}>
          <Suspense fallback={null}>
            <HoppyImmersiveScrollSection onGetStarted={handleStart} />
          </Suspense>
        </ErrorBoundaryWrapper>
      )}

      {/* Foreground content column — stacks above the fixed video layer */}
      <div className="relative z-10">
      {/* Hero — extra top breathing room from sticky nav */}
      <div className="pt-16 md:pt-24"><B2BHero onPrimary={handleStart} onSecondary={handleEnterStudio} /></div>

      <Divider size="lg" />

      {/* For everyone — Personal · Business · Enterprise tracks */}
      <Chapter n="01" kicker="For Everyone" size="md">
        <Suspense fallback={<SectionLoader />}>
          <AudienceSegments onStart={handleStart} />
        </Suspense>
      </Chapter>
      <Divider size="lg" />

      {/* Before / After — drag-to-compare brief vs. final film */}
      <Chapter n="02" kicker="Before / After">
        <Suspense fallback={<SectionLoader />}><BeforeAfterGallery /></Suspense>
      </Chapter>
      <Divider size="lg" />

      {/* The Engine — generation engine reveal (the "wow") */}
      <Chapter n="03" kicker="The Engine" size="lg">
        <Suspense fallback={<SectionLoader />}>
          <SeedanceSection onCta={handleStart} />
        </Suspense>
      </Chapter>
      <Divider size="lg" />

      {/* Frame Chaining — five-second clips chain into long-form films */}
      <Chapter n="3.5" kicker="Frame Chaining" size="lg">
        <Suspense fallback={<SectionLoader />}>
          <FrameChainingSection />
        </Suspense>
      </Chapter>
      <Divider size="lg" />

      {/* The Workflow — prompt → film, in plain language */}
      <Chapter n="04" kicker="The Workflow">
        <Suspense fallback={<SectionLoader />}><B2BWorkflow /></Suspense>
      </Chapter>
      <Divider size="lg" />

      {/* Enter the Studio — gateway to the full capability tour */}
      <section id="studio" className="relative z-10 py-32 md:py-44 px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 70% at 50% 40%, hsla(212,100%,52%,0.10), transparent 70%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-6xl mx-auto"
        >
          {/* Eyebrow */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl mb-8">
              <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
              <span className="text-[10.5px] font-medium text-white/65 tracking-[0.32em] uppercase">
                The Studio · Chapter 04
              </span>
            </div>
            <h2
              className="font-display text-5xl md:text-7xl font-bold text-white tracking-[-0.035em] mb-7 leading-[1.02]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Two engines.{' '}
              <span
                className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                One studio.
              </span>
            </h2>
            <p className="text-white/55 text-lg md:text-xl font-light leading-relaxed mb-14 max-w-2xl mx-auto">
              Kling V3 for cinematic dialogue and native audio. Seedance for
              hyperreal motion. The pipeline routes each shot to the right
              engine — or pin one for the whole project.
            </p>
          </div>

          {/* Capability matrix — engines (left) × pipelines/features (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-14">

            {/* ─── ENGINES STACK ─── */}
            <div className="lg:col-span-7 relative rounded-3xl overflow-hidden p-7 md:p-9 backdrop-blur-2xl"
              style={{
                background: 'linear-gradient(180deg, hsla(0,0%,100%,0.025) 0%, hsla(0,0%,100%,0.005) 100%)',
                boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.06), inset 0 1px 0 hsla(0,0%,100%,0.06)',
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, hsla(212,100%,75%,0.5), transparent)' }} />
              <div className="flex items-baseline justify-between mb-6">
                <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono">Generation engines</p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#9DCBFF]/70 font-mono">Pick per shot</p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    name: 'Kling V3',
                    tag: 'Cinematic · Native lip-sync',
                    durations: '5 / 10s',
                    aspects: '16:9 · 9:16 · 1:1',
                    badges: ['T2V', 'I2V', 'Lip-sync', 'Native audio'],
                    accent: '#0A84FF',
                  },
                  {
                    name: 'Seedance 2.0',
                    tag: 'Hyperreal motion',
                    durations: '5 / 10 / 12s',
                    aspects: '16:9 · 9:16 · 1:1',
                    badges: ['T2V', 'I2V', 'Last-frame carry'],
                    accent: '#7DD3FC',
                  },
                ].map((eng, i) => (
                  <motion.div
                    key={eng.name}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="group relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-2xl bg-white/[0.015] hover:bg-white/[0.04] transition-all duration-500 border border-white/[0.04] hover:border-[hsla(212,100%,60%,0.25)]"
                  >
                    {/* Index numeral */}
                    <div className="w-10 shrink-0 text-[11px] font-mono tracking-[0.2em] text-white/30 tabular-nums">
                      0{i + 1}
                    </div>

                    {/* Engine identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0A84FF', boxShadow: '0 0 10px #0A84FF' }} />
                        <h3 className="text-white text-[17px] font-medium tracking-[-0.012em]"
                          style={{ fontFamily: "'Fraunces', serif" }}>
                          {eng.name}
                        </h3>
                      </div>
                      <p className="text-white/45 text-[12.5px] font-light mt-0.5 leading-snug">{eng.tag}</p>
                    </div>

                    {/* Specs */}
                    <div className="flex flex-col items-start sm:items-end shrink-0 gap-1">
                      <span className="text-[10.5px] font-mono tabular-nums text-white/65">{eng.durations}</span>
                      <span className="text-[10px] font-mono tracking-[0.08em] text-white/35">{eng.aspects}</span>
                    </div>

                    {/* Capability badges */}
                    <div className="flex flex-wrap gap-1.5 sm:max-w-[210px] sm:justify-end">
                      {eng.badges.map((b) => (
                        <span
                          key={b}
                          className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/65 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Engine footer note */}
              <p className="mt-6 text-[11px] text-white/40 font-light leading-relaxed">
                Routing is automatic per shot. Pin a single engine for a project
                when you need consistency. Credits bill at $0.10 each.
              </p>
            </div>

            {/* ─── PIPELINES & FEATURES ─── */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                { k: 'Hollywood Pipeline',     v: 'Unified T2V + I2V engine' },
                { k: 'Multi-Character Dialogue', v: 'Two avatars, six-clip arcs' },
                { k: 'Face Lock Identity',     v: 'No drift between cuts' },
                { k: 'Continuity Engine',      v: 'Manifest-level shot memory' },
                { k: 'Cinematic Scoring',      v: 'MusicGen + dialogue duck' },
                { k: 'Verbatim Script',        v: 'Your dialogue, untouched' },
                { k: 'Photo Editor · Gemini',  v: '2-credit preservation edits' },
                { k: 'Native Video Editor',    v: 'Multi-track timeline + scopes' },
              ].map((f, i) => (
                <motion.div
                  key={f.k}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.045] border border-white/[0.05] hover:border-[hsla(212,100%,60%,0.22)] transition-all duration-500 overflow-hidden"
                >
                  <span aria-hidden className="absolute -top-px left-4 right-4 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, hsla(212,100%,75%,0.5), transparent)', opacity: 0.6 }} />
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/55">
                      {f.k}
                    </p>
                  </div>
                  <p className="text-white/82 text-[13.5px] font-light leading-snug tracking-[-0.005em]">
                    {f.v}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Pipeline ribbon — end-to-end flow */}
          <div className="relative mb-12 rounded-3xl p-6 md:p-7 overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, hsla(0,0%,100%,0.018) 0%, hsla(0,0%,100%,0.003) 100%)',
              boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.36em] text-white/40 font-mono mb-5">End-to-end pipeline</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
              {[
                'Prompt', 'Script · LLM', 'Scene DNA', 'Character Lock',
                'Engine Route', 'Generate', 'Continuity Audit', 'Score + Mix', 'Stitch', 'Edit',
              ].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono tabular-nums text-white/35">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[12.5px] text-white/80 font-light tracking-[-0.005em]">{step}</span>
                  {i < arr.length - 1 && (
                    <span aria-hidden className="text-white/20 text-[12px] mx-1.5">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/studio')}
              className="h-14 px-10 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.04] shadow-[0_20px_60px_-20px_rgba(255,255,255,0.4)]"
            >
              Enter the Studio
            </button>
            <button
              onClick={handleStart}
              className="h-14 px-10 text-sm font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              Skip the tour, start now
            </button>
          </div>
        </motion.div>
      </section>

      <Divider size="lg" />

      {/* Pricing anchor — keep simple, link to /pricing */}
      <section id="pricing" className="relative z-10 py-40 md:py-56 px-6">
        {/* Subtle radial spotlight behind pricing */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(50% 60% at 50% 40%, hsla(212,100%,50%,0.10), transparent 70%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl mb-8">
            <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
            <span className="text-[10.5px] font-medium text-white/65 tracking-[0.28em] uppercase">
              Pricing · Chapter 05
            </span>
          </div>
          <h2 className="font-display text-5xl md:text-7xl font-bold text-white tracking-[-0.035em] mb-8 leading-[1.02]">
            Pay only for{' '}
            <span
              className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              what you ship.
            </span>
          </h2>
          <p className="text-white/55 text-lg md:text-xl font-light leading-relaxed mb-12 max-w-xl mx-auto">
            $0.10 per credit. No seats, no minimums. Add credits as your team
            scales — or talk to us about volume contracts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/pricing')}
              className="h-14 px-10 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.04] shadow-[0_20px_60px_-20px_rgba(255,255,255,0.4)]"
            >
              See pricing
            </button>
            <button
              onClick={handleSales}
              className="h-14 px-10 text-sm font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              Volume & enterprise
            </button>
          </div>
        </motion.div>
      </section>

      <Divider size="md" />

      {/* FAQ */}
      <div id="faq">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <Spaced><FAQSection /></Spaced>
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      <Divider size="lg" />

      {/* Final CTA */}
      <Spaced size="lg">
        <Suspense fallback={<SectionLoader />}>
          <B2BFinalCTA onPrimary={handleStart} onSecondary={handleSales} />
        </Suspense>
      </Spaced>

      <Divider size="md" />

      {/* Footer */}
      <ErrorBoundaryWrapper fallback={<footer className="py-12 bg-black" />}>
        <Suspense fallback={<SectionLoader />}>
          <Footer />
        </Suspense>
      </ErrorBoundaryWrapper>
      </div>

      {/* Category chooser — appears after any "Get started" CTA */}
      <CategoryChooserOverlay
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onSelect={handleSelectCategory}
      />
      </div>

      {/* Cinematic title-card sequence — rendered OUTSIDE the landing wrapper
          so `overflow-hidden` / opacity transitions on the page shell can never
          clip or hide it. This is the top-level overlay above all page chrome. */}
      <StudioIntro isPlaying={studioIntroPlaying} />
    </>
  );
}
