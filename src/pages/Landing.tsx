import { useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, getGatekeeperMessage, GATEKEEPER_PRESETS } from '@/hooks/useGatekeeperLoading';

import { LandingNav } from '@/components/landing/LandingNav';
import { B2BHero } from '@/components/landing/B2BHero';
import { B2BLogoBar } from '@/components/landing/B2BLogoBar';
import { B2BUseCases } from '@/components/landing/B2BUseCases';
import { B2BPlatformPillars } from '@/components/landing/B2BPlatformPillars';
import { B2BROISection } from '@/components/landing/B2BROISection';
import { B2BFinalCTA } from '@/components/landing/B2BFinalCTA';
import { B2BGlassFeatures, B2BWorkflow } from '@/components/landing/B2BGlassFeatures';
import { CinematicMosaic } from '@/components/landing/CinematicMosaic';
import { ScrollBackdrop } from '@/components/landing/ScrollBackdrop';
import { B2BTestimonials } from '@/components/landing/B2BTestimonials';
import { B2BComparison } from '@/components/landing/B2BComparison';
import { B2BSecurityBar } from '@/components/landing/B2BSecurityBar';
import { HoppyImmersiveIntro } from '@/components/landing/HoppyImmersiveIntro';
import { IdleEnterOverlay } from '@/components/landing/IdleEnterOverlay';
import { SeedanceSection } from '@/components/landing/SeedanceSection';
import { motion, useScroll, useTransform } from 'framer-motion';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const FAQSection = lazy(() => import('@/components/landing/FAQSection'));
const Footer = lazy(() => import('@/components/landing/Footer'));

const SectionLoader = () => (
  <div className="py-24 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

const BackgroundFallback = () => <div className="fixed inset-0 bg-black" />;

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
  const handleStart = useCallback(() => navigate('/auth?mode=signup'), [navigate]);
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

  // Premium section divider — generous breathing room with a hairline glow
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

  // Editorial spacing wrapper — generous vertical rhythm around every section
  const Spaced = ({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) => {
    const py = size === 'lg' ? 'py-20 md:py-32' : size === 'sm' ? 'py-8 md:py-14' : 'py-14 md:py-24';
    return <div className={`relative ${py}`}>{children}</div>;
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
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

      <LandingNav onScrollToSection={scrollToSection} onNavigate={handleNavigate} />

      {/* Hero — extra top breathing room from sticky nav */}
      <div className="pt-16 md:pt-24"><B2BHero onPrimary={handleStart} onSecondary={handleSales} /></div>

      <Divider size="sm" />
      <Spaced size="sm"><B2BLogoBar /></Spaced>
      <Divider size="lg" />

      {/* Seedance 2.0 — epic generation engine reveal */}
      <Spaced size="lg"><SeedanceSection onCta={handleStart} /></Spaced>
      <Divider size="lg" />

      {/* Cinematic video mosaic — multi-format showcase */}
      <Spaced><CinematicMosaic /></Spaced>
      <Divider size="md" />

      {/* Scroll-driven cinematic backdrop — premium imagery crossfade */}
      <Spaced size="lg"><ScrollBackdrop /></Spaced>
      <Divider size="lg" />

      <Spaced><B2BUseCases /></Spaced>
      <Divider size="md" />

      <Spaced><B2BGlassFeatures /></Spaced>
      <Divider size="md" />

      <Spaced><B2BComparison /></Spaced>
      <Divider size="md" />

      <Spaced><B2BWorkflow /></Spaced>
      <Divider size="md" />

      <Spaced><B2BPlatformPillars /></Spaced>
      <Divider size="md" />

      <Spaced><B2BROISection /></Spaced>
      <Divider size="md" />

      <Spaced><B2BTestimonials /></Spaced>
      <Divider size="md" />

      <Spaced size="sm"><B2BSecurityBar /></Spaced>
      <Divider size="lg" />

      {/* Pricing anchor — keep simple, link to /pricing */}
      <section id="pricing" className="relative z-10 py-40 md:py-56 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto text-center"
        >
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Pricing
          </p>
          <h2 className="font-display text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-[1.02]">
            Pay only for what you ship.
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
  );
}
