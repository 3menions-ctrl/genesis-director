import { useEffect, useCallback, lazy, Suspense, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import landingAbstractBg from '@/assets/bg-idea-6-epic-landscape.jpg';

import { LandingNav } from '@/components/landing/LandingNav';
import { B2BHero } from '@/components/landing/B2BHero';
import { HoppyImmersiveIntro } from '@/components/landing/HoppyImmersiveIntro';
import { StudioIntro } from '@/components/intro/StudioIntro';
import { motion } from 'framer-motion';

// ── Round-2 premium landing primitives ─────────────────────────────────
import { FilmGrainOverlay } from '@/components/landing/FilmGrainOverlay';
import { FrameTimecode } from '@/components/landing/FrameTimecode';
import { LiveStatRibbon } from '@/components/landing/LiveStatRibbon';
import { ProductionSlate } from '@/components/landing/ProductionSlate';
import { DirectorsReel } from '@/components/landing/DirectorsReel';
import { InlineSandbox } from '@/components/landing/InlineSandbox';
import { CastingWall } from '@/components/landing/CastingWall';
import { PressJunketFAQ } from '@/components/landing/PressJunketFAQ';
import { PricingCrew } from '@/components/landing/PricingCrew';
import { Footer as SiteFooter } from '@/components/cinema/Footer';

import { usePageMeta } from '@/hooks/usePageMeta';
import {
  LandingDiagnosticsProvider,
  TrackedSection,
  useGate,
} from '@/components/landing/LandingDiagnostics';
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
const EnterStudioEpic = lazy(() =>
  import('@/components/landing/EnterStudioEpic').then(m => ({ default: m.EnterStudioEpic })),
);

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
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_24px_6px_hsl(212_100%_52%/0.45)]" />
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
          className="text-[10px] font-medium text-primary/70 tracking-[0.32em] uppercase rotate-180"
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
  return (
    <LandingDiagnosticsProvider>
      <LandingInner />
    </LandingDiagnosticsProvider>
  );
}

function LandingInner() {
  usePageMeta({ title: "Small Bridges — Cinematic AI video creation", description: "Generate Hollywood-quality video scenes from a single prompt. Avatars, environments, and dialogue, all unified." });

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
  // Account-type choice is gone: every "Get started" lands on the sign-up form,
  // where business teams take the dedicated "Set up a business account" path.
  const handleStart = useCallback(() => navigate('/auth?mode=signup'), [navigate]);
  const handleSales = useCallback(() => navigate('/contact?topic=sales'), [navigate]);

  // Cinematic studio entrance — plays before navigating to /studio.
  const [studioIntroPlaying, setStudioIntroPlaying] = useState(false);
  const handleEnterStudio = useCallback(() => {
    setStudioIntroPlaying(true);
    // Navigate during the iris-out reveal (intro total = 4500ms). Going slightly
    // before completion lets /studio paint underneath the white-flash dissolve
    // so there is no black flash between scenes — but late enough that the
    // wordmark + monogram beats are fully visible first.
    window.setTimeout(() => navigate('/studio'), 7300);
  }, [navigate]);

  // The cinema loader is a sibling of the page content. We render the page
  // markup eagerly (hidden at opacity-0) so the browser can lay it out and
  // decode imagery while the loader is still on screen — this guarantees
  // the crossfade reveals an already-painted hero, never a blank flash.
  const showLoader = authLoading || !presentationReady;

  // Report each loader gate to the diagnostics panel.
  useGate('auth', !authLoading);
  useGate('presentationReady', presentationReady, phaseLabel);
  useGate('contentVisible', contentVisible);
  useGate('deferredMount', deferredMount);

  return (
    <>
      <CinemaLoader
        isVisible={showLoader}
        message={phaseLabel}
        progress={phaseProgress}
        showProgress={true}
        variant="fullscreen"
      />
      {/* Always-on cinematic overlays — film grain texture + scrubber timecode */}
      <FilmGrainOverlay />
      <FrameTimecode />
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
      <TrackedSection name="AbstractBackground" fallback={<BackgroundFallback />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </TrackedSection>

      {/* Ambient aurora — subtle blue glow that drifts across the page */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <motion.div
          animate={{ x: ['-10%', '10%', '-10%'], y: ['-5%', '5%', '-5%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1/4 left-1/4 w-[60vw] h-[60vw] rounded-full bg-primary/[0.08] blur-[140px]"
        />
        <motion.div
          animate={{ x: ['8%', '-8%', '8%'], y: ['4%', '-4%', '4%'] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 right-0 w-[50vw] h-[50vw] rounded-full bg-primary/90/[0.05] blur-[160px]"
        />
      </div>

      <LandingNav onScrollToSection={scrollToSection} onNavigate={handleNavigate} onGetStarted={handleStart} />

      {/* Immersive scroll-locked full-video moment — deferred until after
          first paint so it never competes with the hero render. */}
      {deferredMount && (
        <TrackedSection name="HoppyImmersiveScrollSection" fallback={null}>
          <HoppyImmersiveScrollSection onGetStarted={handleStart} />
        </TrackedSection>
      )}

      {/* Live stat ribbon — top-of-page "the platform is alive" signal */}
      <LiveStatRibbon />

      {/* Foreground content column — stacks above the fixed video layer */}
      <div className="relative z-10">
      {/* Hero — extra top breathing room from sticky nav */}
      <div className="pt-16 md:pt-24"><B2BHero onPrimary={handleStart} onSecondary={handleEnterStudio} /></div>

      <ProductionSlate
        eyebrow="Up Next"
        scene="01"
        location="The Sandbox"
        intExt="INT."
        timeOfDay="CONTINUOUS"
        take={1}
        roll="SB.01"
      />

      {/* Inline Sandbox — the unsignaled magic moment */}
      <TrackedSection name="InlineSandbox" fallback={<SectionLoader />}>
        <InlineSandbox />
      </TrackedSection>

      <ProductionSlate
        eyebrow="Up Next"
        scene="02"
        location="The Director's Reel"
        intExt="INT."
        timeOfDay="DAY"
        take={2}
        roll="DR.02"
      />

      {/* Director's Reel — replaces BeforeAfter + Seedance + FrameChaining + B2BWorkflow */}
      <TrackedSection name="DirectorsReel" fallback={<SectionLoader />}>
        <DirectorsReel />
      </TrackedSection>

      <ProductionSlate
        eyebrow="Up Next"
        scene="03"
        location="The Casting Wall"
        intExt="INT."
        timeOfDay="DUSK"
        take={3}
        roll="CW.03"
      />

      {/* Casting Wall — real generated characters as social proof */}
      <TrackedSection name="CastingWall" fallback={<SectionLoader />}>
        <CastingWall />
      </TrackedSection>

      <ProductionSlate
        eyebrow="Up Next"
        scene="04"
        location="For Everyone"
        intExt="EXT."
        timeOfDay="DAY"
        take={4}
        roll="AS.04"
      />

      {/* For everyone — Personal · Business · Enterprise tracks (kept) */}
      <TrackedSection name="AudienceSegments" fallback={<SectionLoader />}>
        <AudienceSegments onStart={handleStart} />
      </TrackedSection>

      <ProductionSlate
        eyebrow="Up Next"
        scene="05"
        location="Enter the Studio"
        intExt="INT."
        timeOfDay="NIGHT"
        take={5}
        roll="ES.05"
      />

      {/* Enter the Studio — kept; cinematic CTA */}
      <TrackedSection name="EnterStudioEpic" fallback={<SectionLoader />}>
        <EnterStudioEpic onStart={handleStart} onEnter={() => navigate('/studio')} />
      </TrackedSection>

      <ProductionSlate
        eyebrow="Up Next"
        scene="06"
        location="The Production Crew"
        intExt="INT."
        timeOfDay="DAY"
        take={6}
        roll="PC.06"
      />

      {/* Pricing as Production Crew — replaces the inline price block */}
      <TrackedSection name="PricingCrew" fallback={<SectionLoader />}>
        <PricingCrew />
      </TrackedSection>

      <ProductionSlate
        eyebrow="Up Next"
        scene="07"
        location="The Junket"
        intExt="INT."
        timeOfDay="DAY"
        take={7}
        roll="PJ.07"
      />

      {/* Press Junket FAQ — replaces standard accordion */}
      <TrackedSection name="PressJunketFAQ" fallback={<SectionLoader />}>
        <PressJunketFAQ />
      </TrackedSection>

      {/* Final CTA */}
      <Spaced size="lg">
        <TrackedSection name="B2BFinalCTA" fallback={<SectionLoader />}>
          <B2BFinalCTA onPrimary={handleStart} onSecondary={handleSales} />
        </TrackedSection>
      </Spaced>

      {/* Premium site footer (shared across landing + all marketing pages) */}
      <TrackedSection name="SiteFooter" fallback={<SectionLoader />}>
        <SiteFooter />
      </TrackedSection>
      </div>
      </div>

      {/* Cinematic title-card sequence — rendered OUTSIDE the landing wrapper
          so `overflow-hidden` / opacity transitions on the page shell can never
          clip or hide it. This is the top-level overlay above all page chrome. */}
      <StudioIntro isPlaying={studioIntroPlaying} />
    </>
  );
}
