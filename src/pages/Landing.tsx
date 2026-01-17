import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Video, Image,
  Brain
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const ExamplesGallery = lazy(() => import('@/components/landing/ExamplesGallery'));
const HeroVideoBackground = lazy(() => import('@/components/landing/HeroVideoBackground'));
const CreatorShowcase = lazy(() => import('@/components/landing/CreatorShowcase'));

const HowItWorksSection = lazy(() => import('@/components/landing/HowItWorksSection'));
const UseCasesSection = lazy(() => import('@/components/landing/UseCasesSection'));

const ContactSection = lazy(() => import('@/components/landing/ContactSection'));

const Footer = lazy(() => import('@/components/landing/Footer'));

const CAPABILITIES = [
  'Text to Video',
  'Image to Video', 
  'AI Script Writer',
  'Voice Synthesis',
  'Character Lock',
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
    }, 2500);
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
        <HeroVideoBackground className="fixed inset-0 z-0" overlayOpacity={0.88} />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4 safe-area-inset-top">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 rounded-2xl nav-glass">
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
                className="h-9 sm:h-10 px-3 sm:px-5 text-xs sm:text-sm font-medium rounded-xl"
              >
                Sign in
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="h-9 sm:h-10 px-4 sm:px-6 text-xs sm:text-sm font-semibold rounded-xl shadow-obsidian"
              >
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="w-4 h-4 ml-1 sm:ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-4 lg:px-8 pt-28 sm:pt-32 lg:pt-48 pb-16 sm:pb-32">
        <div className="max-w-7xl mx-auto">

          {/* Main headline */}
          <div className="text-center max-w-5xl mx-auto mb-8 sm:mb-10">
            {/* Quality Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6 border border-emerald-500/30 bg-emerald-500/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-400">Automatic Retry System Included</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[6.5rem] font-bold tracking-tighter leading-[0.95] mb-6 sm:mb-8">
              <span className="block hero-text">AI Video Generation.</span>
              <span className="block mt-2 hero-text">
                Simple and Fast.
              </span>
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl hero-text-secondary max-w-2xl mx-auto leading-relaxed font-light px-4">
              Create videos from text or images. Automatic retries help ensure quality.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex items-center justify-center mb-10 sm:mb-16 px-4">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="group h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base font-semibold rounded-2xl shadow-obsidian hover:shadow-obsidian-lg transition-all hover:-translate-y-0.5"
            >
              Start creating for free
              <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Examples Gallery Modal - Lazy loaded */}
          <Suspense fallback={null}>
            <ExamplesGallery open={showExamples} onOpenChange={setShowExamples} />
          </Suspense>

          {/* Capabilities */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-16 sm:mb-24 px-4">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap}
                className={cn(
                  "relative px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-500 cursor-pointer",
                  activeCapability === i 
                    ? "bg-glossy-black text-white shadow-obsidian scale-105" 
                    : "glass-card text-muted-foreground hover:text-foreground border-transparent hover:scale-105"
                )}
                onClick={() => setActiveCapability(i)}
              >
                {activeCapability === i && (
                  <div className="absolute inset-0 rounded-full bg-foreground/10 blur-xl" />
                )}
                <span className="relative">{cap}</span>
              </div>
            ))}
          </div>

          {/* Feature Showcase Cards */}
          <div className="relative max-w-6xl mx-auto px-4">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.02] to-transparent blur-[60px]" />
            
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Main feature - Text to Video */}
              <div className="md:col-span-2 group relative p-6 sm:p-8 lg:p-10 rounded-3xl bg-black/60 backdrop-blur-xl text-white shadow-obsidian-xl hover:shadow-obsidian-xl transition-all hover:-translate-y-1 overflow-hidden border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-white/[0.05] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative">
                  <div className="w-12 sm:w-14 h-12 sm:h-14 mb-4 sm:mb-6 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Video className="w-6 sm:w-7 h-6 sm:h-7 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-3">Text-to-Video</h3>
                  <p className="text-base sm:text-lg text-white/60 max-w-md leading-relaxed">
                    Describe a scene and our AI generates video content from your text description.
                  </p>
                  
                  <div className="mt-6 sm:mt-8 flex items-center gap-3 text-white/40">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-xs sm:text-sm font-medium">Generating your vision...</span>
                  </div>
                </div>
              </div>

              {/* Side features */}
              <div className="flex flex-row md:flex-col gap-4">
                {/* Image to Video */}
                <div className="group relative flex-1 p-4 sm:p-6 rounded-2xl glass-card hover:border-foreground/10 transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 mb-3 sm:mb-4 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Image className="w-5 sm:w-6 h-5 sm:h-6" />
                    </div>
                    <h4 className="text-base sm:text-lg font-semibold hero-text mb-1 sm:mb-2">Image-to-Video</h4>
                    <p className="text-xs sm:text-sm hero-text-secondary">Animate any image</p>
                  </div>
                </div>

                {/* AI Script */}
                <div className="group relative flex-1 p-4 sm:p-6 rounded-2xl glass-card hover:border-foreground/10 transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 mb-3 sm:mb-4 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Brain className="w-5 sm:w-6 h-5 sm:h-6" />
                    </div>
                    <h4 className="text-base sm:text-lg font-semibold hero-text mb-1 sm:mb-2">AI Script Writer</h4>
                    <p className="text-xs sm:text-sm hero-text-secondary">Generate narratives</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lazy loaded sections */}
      <Suspense fallback={<SectionLoader />}>
        <HowItWorksSection />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <CreatorShowcase />
      </Suspense>


      <Suspense fallback={<SectionLoader />}>
        <UseCasesSection />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <ContactSection />
      </Suspense>


      {/* CTA Section */}
      <section className="relative z-10 py-16 sm:py-24 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-8 sm:p-12 lg:p-16 text-center rounded-3xl bg-glossy-black shadow-obsidian-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[200px] sm:h-[300px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                Ready to try it?
              </h2>
              <p className="text-base sm:text-lg text-white/60 mb-6 sm:mb-8 max-w-xl mx-auto px-4">
                Start with 60 free credits — enough for 1 clip
              </p>
              <Button
                onClick={() => navigate('/auth')}
                size="lg"
                variant="secondary"
                className="h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base font-semibold rounded-2xl"
              >
                Start for free
                <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </div>
  );
}
