import { useEffect, useCallback, lazy, Suspense, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, getGatekeeperMessage, GATEKEEPER_PRESETS } from '@/hooks/useGatekeeperLoading';

import { LandingNav } from '@/components/landing/LandingNav';
import { B2BHero } from '@/components/landing/B2BHero';
import { AudienceSegments } from '@/components/landing/AudienceSegments';
import { B2BFinalCTA } from '@/components/landing/B2BFinalCTA';
import { B2BWorkflow } from '@/components/landing/B2BGlassFeatures';
import { CinematicMosaic } from '@/components/landing/CinematicMosaic';
import { HoppyImmersiveIntro } from '@/components/landing/HoppyImmersiveIntro';
import { HoppyImmersiveScrollSection } from '@/components/landing/HoppyImmersiveScrollSection';
import { IdleEnterOverlay } from '@/components/landing/IdleEnterOverlay';
import { SeedanceSection } from '@/components/landing/SeedanceSection';
import { CategoryChooserOverlay, type AudienceCategory } from '@/components/landing/CategoryChooserOverlay';
import { motion } from 'framer-motion';

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
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useSafeNavigation();

  const { isLoading, progress, phase } = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.landing,
    authLoading,
    dataLoading: false,
    dataSuccess: true,
  });

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
      navigate(`/auth?mode=signup&audience=${category}`);
    },
    [navigate],
  );
  const handleSales = useCallback(() => navigate('/contact?topic=sales'), [navigate]);

  if (isLoading) {
    return (
      <CinemaLoader
        isVisible={true}
        message={getGatekeeperMessage(phase, GATEKEEPER_PRESETS.landing.messages)}
        progress={progress}
        showProgress={true}
        variant="fullscreen"
      />
    );
  }

  return (
    <div className="landing-glass-scope min-h-screen overflow-hidden relative">
      {/* Idle-triggered immersive intro */}
      <HoppyImmersiveIntro />

      {/* 30s-idle Enter chooser (Business vs Enterprise) */}
      <IdleEnterOverlay />

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

      {/* Immersive scroll-locked full-video moment — single fixed video that
          activates once the user scrolls past the hero. Mounted OUTSIDE the
          foreground column so its `position: fixed` layer escapes the z-10
          stacking context and sits beneath all landing content. */}
      <HoppyImmersiveScrollSection onGetStarted={handleStart} />

      {/* Foreground content column — stacks above the fixed video layer */}
      <div className="relative z-10">
      {/* Hero — extra top breathing room from sticky nav */}
      <div className="pt-16 md:pt-24"><B2BHero onPrimary={handleStart} onSecondary={handleSales} /></div>

      <Divider size="lg" />

      {/* For everyone — Personal · Business · Enterprise tracks */}
      <Chapter n="01" kicker="For Everyone" size="md">
        <AudienceSegments onStart={handleStart} />
      </Chapter>
      <Divider size="lg" />

      {/* In Motion — multi-format cinematic mosaic (proof) */}
      <Chapter n="02" kicker="In Motion"><CinematicMosaic /></Chapter>
      <Divider size="lg" />

      {/* The Engine — generation engine reveal (the "wow") */}
      <Chapter n="03" kicker="The Engine" size="lg">
        <SeedanceSection onCta={handleStart} />
      </Chapter>
      <Divider size="lg" />

      {/* The Workflow — prompt → film, in plain language */}
      <Chapter n="04" kicker="The Workflow"><B2BWorkflow /></Chapter>
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
      <Spaced size="lg"><B2BFinalCTA onPrimary={handleStart} onSecondary={handleSales} /></Spaced>

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
  );
}
