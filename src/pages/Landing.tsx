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
    const h = size === 'lg' ? 'h-40 md:h-56' : size === 'sm' ? 'h-16 md:h-24' : 'h-28 md:h-40';
    return (
      <div aria-hidden className={`relative ${h} w-full`}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] max-w-[480px] h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>
    );
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

      <LandingNav onScrollToSection={scrollToSection} onNavigate={handleNavigate} />

      {/* Hero — extra top breathing room from sticky nav */}
      <div className="pt-10 md:pt-14"><B2BHero onPrimary={handleStart} onSecondary={handleSales} /></div>

      <Divider size="sm" />
      <B2BLogoBar />
      <Divider size="lg" />

      {/* Seedance 2.0 — epic generation engine reveal */}
      <SeedanceSection onCta={handleStart} />
      <Divider size="lg" />

      {/* Cinematic video mosaic — multi-format showcase */}
      <CinematicMosaic />
      <Divider size="md" />

      {/* Scroll-driven cinematic backdrop — premium imagery crossfade */}
      <ScrollBackdrop />
      <Divider size="lg" />

      <B2BUseCases />
      <Divider size="md" />

      <B2BGlassFeatures />
      <Divider size="md" />

      <B2BComparison />
      <Divider size="md" />

      <B2BWorkflow />
      <Divider size="md" />

      <B2BPlatformPillars />
      <Divider size="md" />

      <B2BROISection />
      <Divider size="md" />

      <B2BTestimonials />
      <Divider size="md" />

      <B2BSecurityBar />
      <Divider size="lg" />

      {/* Pricing anchor — keep simple, link to /pricing */}
      <section id="pricing" className="relative z-10 py-32 md:py-40 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Pricing
          </p>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-white tracking-tight mb-6 leading-[1.04]">
            Pay only for what you ship.
          </h2>
          <p className="text-white/55 text-lg font-light leading-relaxed mb-10 max-w-xl mx-auto">
            $0.10 per credit. No seats, no minimums. Add credits as your team
            scales — or talk to us about volume contracts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/pricing')}
              className="h-13 px-8 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all hover:scale-[1.02]"
            >
              See pricing
            </button>
            <button
              onClick={handleSales}
              className="h-13 px-8 text-sm font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              Volume & enterprise
            </button>
          </div>
        </div>
      </section>

      <Divider size="md" />

      {/* FAQ */}
      <div id="faq">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <FAQSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      <Divider size="lg" />

      {/* Final CTA */}
      <B2BFinalCTA onPrimary={handleStart} onSecondary={handleSales} />

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
