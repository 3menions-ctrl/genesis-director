import { useState, useEffect, useCallback, memo, forwardRef, useRef } from 'react';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, getGatekeeperMessage, GATEKEEPER_PRESETS } from '@/hooks/useGatekeeperLoading';
import { useScrollReveal } from '@/hooks/useScrollReveal';

// Extracted landing components
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { PricingSection, ImmersiveVideoBackground, LetsGoCTA, INACTIVITY_TIMEOUT_MS } from '@/components/landing/PricingSection';
import { AvatarCTASection } from '@/components/landing/AvatarCTASection';
import { SocialProofTicker } from '@/components/landing/SocialProofTicker';
import { PromptResultShowcase } from '@/components/landing/PromptResultShowcase';

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
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useSafeNavigation();
  
  const [showExamples, setShowExamples] = useState(false);
  const [showCinematicTransition, setShowCinematicTransition] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [showImmersiveCTA, setShowImmersiveCTA] = useState(false);
  const signUpButtonRef = useRef<HTMLButtonElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoTriggeredRef = useRef(false);

  // Gatekeeper for clean fade-in
  const { isLoading, progress, phase } = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.landing,
    authLoading,
    dataLoading: false,
    dataSuccess: true,
  });

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

  // Immersive video handlers
  const handleEnterImmersive = useCallback(() => {
    hasAutoTriggeredRef.current = true;
    setIsImmersive(true);
    setShowImmersiveCTA(false);
  }, []);

  const handleExitImmersive = useCallback(() => {
    setIsImmersive(false);
    setShowImmersiveCTA(false);
  }, []);

  const handleImmersiveVideoEnded = useCallback(() => {
    setShowImmersiveCTA(true);
  }, []);

  // Inactivity detection — auto-enter immersive after 10s of no deliberate interaction
  useEffect(() => {
    // Don't start/run timer if gallery is open (too many concurrent video players cause crashes)
    if (isImmersive || hasAutoTriggeredRef.current || showExamples) return;

    const startTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        if (!hasAutoTriggeredRef.current) {
          hasAutoTriggeredRef.current = true;
          setIsImmersive(true);
        }
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => startTimer();
    const events = ['mousedown', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    startTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [isImmersive, showExamples]);

  // Scroll reveal observer for landing sections
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    // Observe all scroll-reveal elements
    const els = document.querySelectorAll('.scroll-reveal');
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [isLoading]); // Re-run after loading completes

  // Show CinemaLoader while gatekeeper is active
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
      {/* Immersive fullscreen video — lives at top level so it works from any scroll position */}
      {isImmersive && (
        <ImmersiveVideoBackground 
          onClose={handleExitImmersive} 
          onVideoEnded={handleImmersiveVideoEnded}
        />
      )}
      {showImmersiveCTA && <LetsGoCTA onNavigate={handleNavigate} />}
      {/* Cinematic Transition - lazy loaded to reduce landing bundle */}
      {showCinematicTransition && (
        <Suspense fallback={<div className="fixed inset-0 z-[99999] bg-black" />}>
          <CinematicTransition 
            isActive={showCinematicTransition} 
            onComplete={handleTransitionComplete} 
          />
        </Suspense>
      )}

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

      {/* Prompt → Result Showcase */}
      <div className="relative z-10 -mt-20 pb-12 px-6">
        <PromptResultShowcase />
      </div>

      {/* Social Proof Ticker */}
      <SocialProofTicker />

      {/* How it Works — scroll reveal */}
      <div className="scroll-reveal">
        <HowItWorksSection />
      </div>

      {/* Features Showcase — scroll reveal */}
      <div className="scroll-reveal" style={{ animationDelay: '100ms' }}>
        <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
          <Suspense fallback={<SectionLoader />}>
            <FeaturesShowcase />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Pricing CTA — scroll reveal */}
      <div className="scroll-reveal" style={{ animationDelay: '200ms' }}>
        <PricingSection onNavigate={handleNavigate} isImmersive={isImmersive} onEnterImmersive={handleEnterImmersive} suppressVideo={showExamples || isImmersive} />
      </div>

      {/* FAQ */}
      <div id="faq" className="scroll-reveal">
        <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
          <Suspense fallback={<SectionLoader />}>
            <FAQSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Avatar CTA — scroll reveal */}
      <div className="scroll-reveal">
        <AvatarCTASection onNavigate={handleNavigate} />
      </div>

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
