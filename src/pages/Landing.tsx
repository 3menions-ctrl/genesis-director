import { useState, useEffect, useCallback, memo, forwardRef, useRef } from 'react';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';

// Extracted landing components
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';

// Lazy load heavy components
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const ExamplesGallery = lazy(() => import('@/components/landing/ExamplesGallery'));
const FAQSection = lazy(() => import('@/components/landing/FAQSection'));
const Footer = lazy(() => import('@/components/landing/Footer'));
const FeaturesShowcase = lazy(() => import('@/components/landing/FeaturesShowcase'));
const CinematicTransition = lazy(() => import('@/components/landing/CinematicTransition'));

// Loading fallbacks
const SectionLoader = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function SectionLoader(_, ref) {
    return (
      <div ref={ref} className="py-24 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
));
SectionLoader.displayName = 'SectionLoader';

const MinimalFallback = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function MinimalFallback(_, ref) {
    return (
      <div ref={ref} className="py-24 flex items-center justify-center">
        <div className="text-center text-white/30">
          <div className="w-8 h-8 mx-auto mb-2 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <p className="text-sm">Loading section...</p>
        </div>
      </div>
    );
  }
));
MinimalFallback.displayName = 'MinimalFallback';

const BackgroundFallback = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function BackgroundFallback(_, ref) {
    return <div ref={ref} className="fixed inset-0 bg-black" />;
  }
));
BackgroundFallback.displayName = 'BackgroundFallback';

// Main Landing Component
export default function Landing() {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  
  const [showExamples, setShowExamples] = useState(false);
  const [showCinematicTransition, setShowCinematicTransition] = useState(false);
  const signUpButtonRef = useRef<HTMLButtonElement>(null);

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  // Navigation handlers
  const scrollToSection = useCallback((target: string) => {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const handleTransitionComplete = useCallback(() => {
    navigate('/gallery', { state: { fromAnimation: true } });
  }, [navigate]);

  const handleEnterStudio = useCallback(() => {
    setShowCinematicTransition(true);
  }, []);

  const handleExamplesChange = useCallback((open: boolean) => {
    setShowExamples(open);
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Cinematic Transition */}
      <ErrorBoundaryWrapper fallback={null}>
        <Suspense fallback={null}>
          {showCinematicTransition && (
            <CinematicTransition 
              isActive={showCinematicTransition} 
              onComplete={handleTransitionComplete} 
            />
          )}
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Abstract Background */}
      <ErrorBoundaryWrapper fallback={<BackgroundFallback />}>
        <Suspense fallback={<BackgroundFallback />}>
          <AbstractBackground className="fixed inset-0 z-0" />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Navigation */}
      <LandingNav 
        onScrollToSection={scrollToSection} 
        onNavigate={handleNavigate} 
        signUpButtonRef={signUpButtonRef}
      />

      {/* Hero Section */}
      <HeroSection onEnterStudio={handleEnterStudio} />

      {/* How it Works */}
      <HowItWorksSection />

      {/* Features Showcase */}
      <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
        <Suspense fallback={<SectionLoader />}>
          <FeaturesShowcase />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Pricing CTA */}
      <PricingSection onNavigate={handleNavigate} />

      {/* FAQ */}
      <div id="faq">
        <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
          <Suspense fallback={<SectionLoader />}>
            <FAQSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Final CTA */}
      <FinalCTASection onNavigate={handleNavigate} />

      {/* Examples Gallery */}
      <ErrorBoundaryWrapper fallback={null}>
        <Suspense fallback={null}>
          <ExamplesGallery open={showExamples} onOpenChange={handleExamplesChange} />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Footer */}
      <ErrorBoundaryWrapper fallback={<footer className="py-12 bg-black" />}>
        <Suspense fallback={<SectionLoader />}>
          <Footer />
        </Suspense>
      </ErrorBoundaryWrapper>
    </div>
  );
}
