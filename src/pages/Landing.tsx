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
import { SeedanceBanner } from '@/components/landing/SeedanceBanner';

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

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Idle-triggered immersive intro */}
      <HoppyImmersiveIntro />

      {/* Top announcement banner */}
      <SeedanceBanner onLearnMore={() => scrollToSection('pricing')} />

      {/* Abstract Background */}
      <ErrorBoundaryWrapper fallback={<BackgroundFallback />}>
        <Suspense fallback={<BackgroundFallback />}>
          <AbstractBackground className="fixed inset-0 z-0" />
        </Suspense>
      </ErrorBoundaryWrapper>

      <LandingNav onScrollToSection={scrollToSection} onNavigate={handleNavigate} />

      {/* Hero */}
      <B2BHero onPrimary={handleStart} onSecondary={handleSales} />

      {/* Trust bar */}
      <B2BLogoBar />

      {/* Cinematic video mosaic — multi-format showcase */}
      <CinematicMosaic />

      {/* Scroll-driven cinematic backdrop — premium imagery crossfade */}
      <ScrollBackdrop />

      {/* Use cases */}
      <B2BUseCases />

      {/* Premium glassmorphic feature grid */}
      <B2BGlassFeatures />

      {/* The shift — old way vs. Apex */}
      <B2BComparison />

      {/* Workflow */}
      <B2BWorkflow />

      {/* Platform pillars */}
      <B2BPlatformPillars />

      {/* ROI strip */}
      <B2BROISection />

      {/* Social proof — testimonials */}
      <B2BTestimonials />

      {/* Enterprise security */}
      <B2BSecurityBar />

      {/* Pricing anchor — keep simple, link to /pricing */}
      <section id="pricing" className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Pricing
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Pay only for what you ship.
          </h2>
          <p className="text-white/55 text-lg font-light leading-relaxed mb-8">
            $0.10 per credit. No seats, no minimums. Add credits as your team
            scales — or talk to us about volume contracts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/pricing')}
              className="h-12 px-7 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all"
            >
              See pricing
            </button>
            <button
              onClick={handleSales}
              className="h-12 px-7 text-sm font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              Volume & enterprise
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div id="faq">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <FAQSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Final CTA */}
      <B2BFinalCTA onPrimary={handleStart} onSecondary={handleSales} />

      {/* Footer */}
      <ErrorBoundaryWrapper fallback={<footer className="py-12 bg-black" />}>
        <Suspense fallback={<SectionLoader />}>
          <Footer />
        </Suspense>
      </ErrorBoundaryWrapper>
    </div>
  );
}
