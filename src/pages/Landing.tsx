import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Video, Image,
  Brain,
  Sparkles,
  Zap,
  Lock,
  Mic
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';

// Lazy load heavy components
const ExamplesGallery = lazy(() => import('@/components/landing/ExamplesGallery'));
const HeroVideoBackground = lazy(() => import('@/components/landing/HeroVideoBackground'));
const CreatorShowcase = lazy(() => import('@/components/landing/CreatorShowcase'));
const CreationTeaser = lazy(() => import('@/components/landing/CreationTeaser'));
const SocialProofBar = lazy(() => import('@/components/landing/SocialProofBar'));
const TestimonialsCarousel = lazy(() => import('@/components/landing/TestimonialsCarousel'));
const TrustBadges = lazy(() => import('@/components/landing/TrustBadges'));
const ExitIntentPopup = lazy(() => import('@/components/landing/ExitIntentPopup'));

const HowItWorksSection = lazy(() => import('@/components/landing/HowItWorksSection'));
const UseCasesSection = lazy(() => import('@/components/landing/UseCasesSection'));
const VideoShowcasePreview = lazy(() => import('@/components/landing/VideoShowcasePreview'));

const ContactSection = lazy(() => import('@/components/landing/ContactSection'));

const Footer = lazy(() => import('@/components/landing/Footer'));

const CAPABILITIES = [
  { label: 'Text to Video', icon: Video },
  { label: 'Image to Video', icon: Image }, 
  { label: 'AI Script Writer', icon: Brain },
  { label: 'Voice Synthesis', icon: Mic },
  { label: 'Character Lock', icon: Lock },
];

// Section loading placeholder
const SectionLoader = () => (
  <div className="py-24 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCapability, setActiveCapability] = useState(0);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCapability((prev) => (prev + 1) % CAPABILITIES.length);
    }, 4000); // Slowed from 2.5s to 4s for better readability
    return () => clearInterval(interval);
  }, []);


  const scrollToSection = useCallback((target: string) => {
    const element = document.getElementById(target);
    element?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-hidden relative">
      {/* Premium Video Background - Lazy loaded */}
      <Suspense fallback={<div className="fixed inset-0 bg-background" />}>
        <HeroVideoBackground className="fixed inset-0 z-0" overlayOpacity={0.92} />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4 safe-area-inset-top">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 rounded-full nav-glass border border-white/20">
            <div className="flex items-center gap-4 sm:gap-10">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-foreground/20 blur-lg" />
                  <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-glossy-black flex items-center justify-center shadow-obsidian">
                    <span className="text-base sm:text-lg font-bold text-white">AS</span>
                  </div>
                </div>
                <span className="text-lg sm:text-xl font-bold text-foreground hidden xs:block">Apex Studio</span>
              </div>

              <div className="hidden lg:flex items-center">
                {[
                  { label: 'Product', target: 'how-it-works' },
                  { label: 'Features', target: 'features' },
                  { label: 'Contact', target: 'contact' },
                ].map((item) => (
                  <button 
                    key={item.label}
                    onClick={() => scrollToSection(item.target)}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
                  >
                    {item.label}
                  </button>
                ))}
                <button 
                  onClick={() => navigate('/press')}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
                >
                  Press
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                className="h-9 sm:h-10 px-3 sm:px-5 text-xs sm:text-sm font-medium rounded-full"
              >
                Sign in
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="h-9 sm:h-10 px-4 sm:px-6 text-xs sm:text-sm font-semibold rounded-full shadow-obsidian"
              >
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Reimagined */}
      <section className="relative z-10 px-4 lg:px-8 pt-32 sm:pt-40 lg:pt-48 pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto">
          {/* Floating badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-600">60 Free Credits • No Card Required</span>
            </div>
          </motion.div>

          {/* Main headline - Outcome-focused */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-center max-w-5xl mx-auto mb-10"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mb-6">
              <span className="block hero-text">Turn Ideas Into</span>
              <span className="block hero-text bg-clip-text">Pro Videos in Minutes</span>
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Type a description, upload an image, or let AI write your script. 
              <span className="text-foreground font-medium"> Get your first video free.</span>
            </p>
          </motion.div>

          {/* Creation Teaser Form - Try before signup */}
          <Suspense fallback={
            <div className="w-full max-w-2xl mx-auto h-[400px] rounded-3xl bg-muted/30 animate-pulse" />
          }>
            <CreationTeaser className="mb-12" />
          </Suspense>

          {/* Social Proof Stats */}
          <Suspense fallback={null}>
            <SocialProofBar className="mb-8" />
          </Suspense>

          {/* Trust Badges */}
          <Suspense fallback={null}>
            <TrustBadges className="mb-16" />
          </Suspense>

          {/* Examples Gallery Modal - Lazy loaded */}
          <Suspense fallback={null}>
            <ExamplesGallery open={showExamples} onOpenChange={setShowExamples} />
          </Suspense>

          {/* BENTO GRID - Modern Feature Cards */}
          <motion.div 
            id="features"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-6xl mx-auto"
          >
            <div className="grid grid-cols-12 gap-4 auto-rows-[140px] sm:auto-rows-[160px]">
              
              {/* Hero Card - Text to Video (Large) */}
              <div className="col-span-12 md:col-span-8 row-span-2 group relative rounded-3xl bg-glossy-black p-6 sm:p-8 overflow-hidden border border-white/10 shadow-obsidian-xl hover:shadow-2xl transition-all hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/[0.03] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative h-full flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 mb-4">
                      <Sparkles className="w-3.5 h-3.5 text-white/70" />
                      <span className="text-xs font-medium text-white/70">Featured</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">Text-to-Video</h3>
                    <p className="text-base sm:text-lg text-white/50 max-w-md leading-relaxed">
                      Describe any scene and watch AI bring your vision to life with cinematic quality.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-sm text-white/40">Generating...</span>
                  </div>
                </div>
                
                {/* Icon */}
                <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                  <Video className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
              </div>

              {/* Image to Video - Transparent Card (Medium) */}
              <div className="col-span-6 md:col-span-4 row-span-2 group relative rounded-3xl p-5 sm:p-6 overflow-hidden bg-white/40 backdrop-blur-xl border border-white/60 hover:bg-white/50 transition-all hover:-translate-y-1 shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform">
                    <Image className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2">Image-to-Video</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">Animate any static image with AI-powered motion.</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Instant animation</span>
                  </div>
                </div>
              </div>

              {/* AI Script - Compact Card */}
              <div className="col-span-6 md:col-span-4 row-span-1 group relative rounded-2xl p-4 sm:p-5 overflow-hidden bg-foreground text-background shadow-obsidian hover:-translate-y-1 transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] to-transparent pointer-events-none" />
                <div className="relative flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-bold">AI Script Writer</h4>
                    <p className="text-xs sm:text-sm text-white/60">Generate narratives instantly</p>
                  </div>
                </div>
              </div>

              {/* Voice Synthesis - Compact Transparent */}
              <div className="col-span-6 md:col-span-4 row-span-1 group relative rounded-2xl p-4 sm:p-5 overflow-hidden bg-white/30 backdrop-blur-md border border-white/50 hover:bg-white/40 transition-all hover:-translate-y-1">
                <div className="relative flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                    <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-foreground">Voice Synthesis</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">AI-powered narration</p>
                  </div>
                </div>
              </div>

              {/* Character Lock - Small */}
              <div className="col-span-6 md:col-span-4 row-span-1 group relative rounded-2xl p-4 sm:p-5 overflow-hidden bg-gradient-to-br from-muted/80 to-muted/40 backdrop-blur-sm border border-foreground/5 hover:border-foreground/10 transition-all hover:-translate-y-1">
                <div className="relative flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 shadow-lg">
                    <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-foreground">Character Lock</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Consistent characters</p>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

          {/* Animated Capabilities Pills */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-12"
          >
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.label}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-500 cursor-pointer",
                    activeCapability === i 
                      ? "bg-foreground text-background shadow-obsidian scale-105" 
                      : "bg-white/50 backdrop-blur-sm text-muted-foreground hover:text-foreground border border-white/60 hover:scale-105"
                  )}
                  onClick={() => setActiveCapability(i)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cap.label}</span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Video Showcase - Immediate proof of quality */}
      <ErrorBoundaryWrapper fallback={<SectionLoader />}>
        <Suspense fallback={<SectionLoader />}>
          <VideoShowcasePreview 
            className="relative z-10" 
            onViewAllClick={() => setShowExamples(true)} 
          />
        </Suspense>
      </ErrorBoundaryWrapper>

      {/* Lazy loaded sections */}
      <div id="how-it-works">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <HowItWorksSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Testimonials Section */}
      <ErrorBoundaryWrapper fallback={<SectionLoader />}>
        <Suspense fallback={<SectionLoader />}>
          <TestimonialsCarousel />
        </Suspense>
      </ErrorBoundaryWrapper>

      <div id="showcase">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <CreatorShowcase />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      <div id="use-cases">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <UseCasesSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      <div id="contact">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <ContactSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>


      {/* CTA Section - With Urgency */}
      <section className="relative z-10 py-20 sm:py-28 px-4 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-[2rem] overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-glossy-black" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/[0.04] rounded-full blur-[100px]" />
            
            <div className="relative p-10 sm:p-16 lg:p-20 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Urgency badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 mb-6">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-sm font-medium text-amber-300">Limited: Free credits for new users</span>
                </div>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Start Creating Today
                </h2>
                <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
                  60 free credits waiting for you. Create your first professional AI video in under 5 minutes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    onClick={() => navigate('/auth?mode=signup')}
                    size="lg"
                    variant="secondary"
                    className="h-14 px-10 text-base font-semibold rounded-full"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Claim Free Credits
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <p className="text-sm text-white/40">No credit card required</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>

      {/* Exit Intent Popup */}
      <Suspense fallback={null}>
        <ExitIntentPopup />
      </Suspense>
    </div>
  );
}
