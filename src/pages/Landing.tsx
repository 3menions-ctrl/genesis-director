import { useState, useEffect, useCallback, memo, useMemo, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useSafeNavigation } from '@/lib/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import { SimpleVideoPlayer } from '@/components/player';

// Lazy load heavy components
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const ExamplesGallery = lazy(() => import('@/components/landing/ExamplesGallery'));
const FAQSection = lazy(() => import('@/components/landing/FAQSection'));
const Footer = lazy(() => import('@/components/landing/Footer'));
const FeaturesShowcase = lazy(() => import('@/components/landing/FeaturesShowcase'));
const CinematicTransition = lazy(() => import('@/components/landing/CinematicTransition'));

// Optimized section loader with minimal footprint - forwardRef for AnimatePresence compatibility
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

// Minimal fallback for critical failures - now visible for debugging
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

// Background fallback
const BackgroundFallback = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function BackgroundFallback(_, ref) {
    return <div ref={ref} className="fixed inset-0 bg-black" />;
  }
));
BackgroundFallback.displayName = 'BackgroundFallback';

// Static data - immutable outside component to prevent recreation
const NAV_ITEMS = ['Features', 'Pricing', 'FAQ'] as const;

const STEPS = [
  { step: '01', title: 'Describe', desc: 'Write what you want to see. Be as detailed or simple as you like.' },
  { step: '02', title: 'Generate', desc: 'AI creates your video scene by scene with cinematic quality.' },
  { step: '03', title: 'Export', desc: 'Download in HD or 4K. Share anywhere instantly.' },
] as const;

const PRICING_STATS = [
  { value: '$0.10', label: 'per credit' },
  { value: '10-15', label: 'credits/clip' },
  { value: '∞', label: 'no expiry' },
] as const;

// Optimized animation variants - static objects
const heroLetterVariants = {
  hidden: (isApex: boolean) => ({ 
    y: 150, 
    opacity: 0, 
    rotateX: -90,
    rotateY: isApex ? 15 : -15
  }),
  visible: { 
    y: 0, 
    opacity: 1, 
    rotateX: 0,
    rotateY: 0
  }
};

// Optimized animation variants - static objects with safer defaults
// Use animate instead of whileInView for critical content to ensure visibility
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

// Immediate visibility variant - doesn't wait for viewport intersection
const fadeInUpImmediate = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, delay: 0.1 }
  }
};

// Memoized Hero Title - forwardRef for AnimatePresence compatibility
const HeroTitle = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function HeroTitle(_, ref) {
    return (
      <div ref={ref} className="relative mb-8">
        {/* Optimized glow - static gradient, no animation for stability */}
        <div 
          className="absolute inset-0 blur-[80px] pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at center, rgba(255,255,255,0.2) 0%, rgba(100,100,255,0.08) 40%, transparent 70%)',
          }}
        />
        
        <motion.div
          initial={{ rotateX: 25, rotateY: -5, scale: 0.9 }}
          animate={{ rotateX: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <h1 className="relative text-[clamp(3rem,15vw,12rem)] font-black leading-[0.85] tracking-[-0.04em]">
            <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
              {'APEX'.split('').map((letter, i) => (
                <motion.span
                  key={`apex-${i}`}
                  className="inline-block text-white"
                  custom={true}
                  variants={heroLetterVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 1.2, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ 
                    transformOrigin: 'bottom center',
                    transformStyle: 'preserve-3d',
                    textShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 60px rgba(255,255,255,0.1)',
                    willChange: 'transform, opacity'
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
            
            <motion.span
              className="inline-block mx-2 md:mx-6 text-white/20"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              –
            </motion.span>
            
            <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
              {'STUDIO'.split('').map((letter, i) => (
                <motion.span
                  key={`studio-${i}`}
                  className="inline-block text-white/30"
                  custom={false}
                  variants={heroLetterVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 1.2, delay: 0.6 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  style={{ 
                    transformOrigin: 'bottom center',
                    transformStyle: 'preserve-3d',
                    textShadow: '0 4px 30px rgba(0,0,0,0.3)',
                    willChange: 'transform, opacity'
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          </h1>
        </motion.div>

        {/* Underline */}
        <motion.div
          className="absolute -bottom-6 left-1/2 h-[2px]"
          initial={{ width: 0, x: '-50%', opacity: 0 }}
          animate={{ width: '70%', opacity: 1 }}
          transition={{ duration: 1.5, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            boxShadow: '0 0 20px rgba(255,255,255,0.3)',
          }}
        />
      </div>
    );
  }
));
HeroTitle.displayName = 'HeroTitle';

// Memoized Step Card - forwardRef for AnimatePresence compatibility
const StepCard = memo(forwardRef<HTMLDivElement, { item: typeof STEPS[number]; index: number }>(
  function StepCard({ item, index }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 + index * 0.15 }}
        className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]"
      >
        <span className="text-6xl font-bold text-white/[0.06] absolute top-6 right-6">
          {item.step}
        </span>
        <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
        <p className="text-white/40 leading-relaxed">{item.desc}</p>
      </motion.div>
    );
  }
));
StepCard.displayName = 'StepCard';

// Memoized Pricing Stat - forwardRef for AnimatePresence compatibility
const PricingStat = memo(forwardRef<HTMLDivElement, { stat: typeof PRICING_STATS[number] }>(
  function PricingStat({ stat }, ref) {
    return (
      <div ref={ref} className="text-center">
        <div className="text-2xl md:text-3xl font-semibold text-white">{stat.value}</div>
        <div className="text-xs text-white/30 mt-1">{stat.label}</div>
      </div>
    );
  }
));
PricingStat.displayName = 'PricingStat';

// Memoized Navigation - forwardRef for AnimatePresence compatibility
const Navigation = memo(forwardRef<HTMLElement, { 
  onScrollToSection: (target: string) => void;
  onNavigate: (path: string) => void;
}>(
  function Navigation({ onScrollToSection, onNavigate }, ref) {
    return (
      <nav ref={ref} className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-black">A-S</span>
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Apex-Studio</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <button 
                key={item}
                onClick={() => onScrollToSection(item.toLowerCase())}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => onNavigate('/auth')}
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full"
            >
              Sign in
            </Button>
            <Button
              onClick={() => onNavigate('/auth?mode=signup')}
              className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90"
            >
              Start Free
            </Button>
          </div>
        </div>
      </nav>
    );
  }
));
Navigation.displayName = 'Navigation';

// Studio Storytelling Journey Video URL
const STUDIO_VIDEO_URL = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4';

// Memoized Pricing Section - forwardRef for parent ref compatibility
const PricingSection = memo(forwardRef<HTMLElement, { onNavigate: (path: string) => void }>(
  function PricingSection({ onNavigate }, ref) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    
    const handlePlayVideo = useCallback(() => {
      setIsVideoPlaying(true);
      const video = document.getElementById('pricing-video') as HTMLVideoElement;
      if (video) {
        video.play().catch(console.error);
      }
    }, []);

    return (
      <section ref={ref} id="pricing" className="relative z-10 py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-5xl mx-auto"
        >
          {/* Video Showcase */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                See it in action
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold text-white mb-2">
                Your Storytelling Journey
              </h3>
              <p className="text-white/40 max-w-md mx-auto">
                Watch how creators bring their stories to life with AI-powered video
              </p>
            </div>
            
            <div className="relative aspect-video max-w-3xl mx-auto rounded-2xl overflow-hidden bg-black/50 border border-white/[0.08]">
              <SimpleVideoPlayer
                src={STUDIO_VIDEO_URL}
                className="w-full h-full object-contain"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onEnded={() => setIsVideoPlaying(false)}
                showControls={isVideoPlaying}
              />
              
              {/* Play overlay */}
              {!isVideoPlaying && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer transition-opacity hover:bg-black/30"
                  onClick={handlePlayVideo}
                >
                  <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg shadow-white/20 transition-transform hover:scale-110">
                    <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div 
              onClick={() => onNavigate('/pricing')}
              className="relative rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] p-12 md:p-16 cursor-pointer transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/[0.02] to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/[0.03] to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs text-white/50">Simple pricing</span>
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-3">
                    Pay once. Create forever.
                  </h2>
                  <p className="text-white/40 text-lg">
                    No subscriptions. Credits that never expire.
                  </p>
                </div>
                
                <div className="shrink-0">
                  <div className="group/btn relative">
                    <div className="absolute -inset-1 bg-white/20 rounded-full blur-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                    <Button
                      size="lg"
                      className="relative h-14 px-8 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all duration-300"
                    >
                      View Pricing
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="relative mt-10 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-4">
                {PRICING_STATS.map((stat, i) => (
                  <PricingStat key={i} stat={stat} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }
));
PricingSection.displayName = 'PricingSection';

// Memoized Final CTA Section - forwardRef for parent ref compatibility
const FinalCTASection = memo(forwardRef<HTMLElement, { onNavigate: (path: string) => void }>(
  function FinalCTASection({ onNavigate }, ref) {
    return (
      <section ref={ref} className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-6">
              Ready to create?
            </h2>
            <p className="text-lg text-white/40 mb-10 max-w-md mx-auto">
              Join thousands of creators making videos with AI.
            </p>
            <Button
              onClick={() => onNavigate('/auth?mode=signup')}
              size="lg"
              className="h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Get Started Free
            </Button>
          </motion.div>
        </div>
      </section>
    );
  }
));
FinalCTASection.displayName = 'FinalCTASection';

// Main Landing Component
export default function Landing() {
  // FIX: useAuth now returns safe fallback if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user } = useAuth();
  
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  
  const [showExamples, setShowExamples] = useState(false);
  const [showCinematicTransition, setShowCinematicTransition] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  // Stable callbacks using useCallback with proper dependencies
  const scrollToSection = useCallback((target: string) => {
    try {
      const element = document.getElementById(target);
      element?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.warn('Failed to scroll to section:', target);
    }
  }, []);

  const handleNavigate = useCallback((path: string) => {
    try {
      navigate(path);
    } catch (error) {
      console.error('Navigation failed:', error);
      // Fallback to window.location
      window.location.href = path;
    }
  }, [navigate]);

  const handleTransitionComplete = useCallback(() => {
    try {
      navigate('/gallery', { state: { fromAnimation: true } });
    } catch (error) {
      console.error('Gallery navigation failed:', error);
      window.location.href = '/gallery';
    }
  }, [navigate]);

  const handleEnterStudio = useCallback(() => {
    setShowCinematicTransition(true);
  }, []);

  const handleExamplesChange = useCallback((open: boolean) => {
    setShowExamples(open);
  }, []);

  // Memoized steps rendering
  const stepsContent = useMemo(() => (
    <div className="grid md:grid-cols-3 gap-8 md:gap-4">
      {STEPS.map((item, i) => (
        <StepCard key={item.step} item={item} index={i} />
      ))}
    </div>
  ), []);

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Cinematic Transition - with error boundary */}
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

      {/* Abstract Background - lazy loaded with fallback */}
      <ErrorBoundaryWrapper fallback={<BackgroundFallback />}>
        <Suspense fallback={<BackgroundFallback />}>
          <AbstractBackground className="fixed inset-0 z-0" />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Navigation - memoized */}
      <Navigation onScrollToSection={scrollToSection} onNavigate={handleNavigate} />

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-6xl mx-auto text-center" style={{ perspective: '1000px' }}>
          <HeroTitle />

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="text-base md:text-lg text-white/30 tracking-[0.3em] uppercase mb-16"
          >
            The Future of Video Creation
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6 }}
          >
            <Button
              onClick={handleEnterStudio}
              size="lg"
              className="group h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.15)] transition-all duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.25)]"
            >
              Enter Studio
              <ArrowRight className="w-5 h-5 ml-3 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-5 h-9 rounded-full border border-white/20 flex items-start justify-center p-1.5 animate-bounce" style={{ animationDuration: '2s' }}>
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              Three simple steps
            </h2>
            <p className="text-lg text-white/40 max-w-md mx-auto">
              From idea to video in minutes, not hours.
            </p>
          </motion.div>

          {stepsContent}
        </div>
      </section>

      {/* Features Showcase - with error boundary */}
      <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
        <Suspense fallback={<SectionLoader />}>
          <FeaturesShowcase />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Pricing CTA - memoized */}
      <PricingSection onNavigate={handleNavigate} />

      {/* FAQ - with error boundary */}
      <div id="faq">
        <ErrorBoundaryWrapper fallback={<MinimalFallback />}>
          <Suspense fallback={<SectionLoader />}>
            <FAQSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Final CTA - memoized */}
      <FinalCTASection onNavigate={handleNavigate} />

      {/* Examples Gallery - with error boundary */}
      <ErrorBoundaryWrapper fallback={null}>
        <Suspense fallback={null}>
          <ExamplesGallery open={showExamples} onOpenChange={handleExamplesChange} />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Footer - with error boundary */}
      <ErrorBoundaryWrapper fallback={<footer className="py-12 bg-black" />}>
        <Suspense fallback={<SectionLoader />}>
          <Footer />
        </Suspense>
      </ErrorBoundaryWrapper>
    </div>
  );
}
