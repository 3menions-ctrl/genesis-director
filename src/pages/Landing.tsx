import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Video, 
  Image,
  Brain,
  Sparkles,
  Zap,
  Lock,
  Mic,
  Play,
  CheckCircle2
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';

// Lazy load components
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const ExamplesGallery = lazy(() => import('@/components/landing/ExamplesGallery'));
const CreationTeaser = lazy(() => import('@/components/landing/CreationTeaser'));
const TestimonialsCarousel = lazy(() => import('@/components/landing/TestimonialsCarousel'));
const FAQSection = lazy(() => import('@/components/landing/FAQSection'));
const PricingSection = lazy(() => import('@/components/landing/PricingSection'));
const Footer = lazy(() => import('@/components/landing/Footer'));

const FEATURES = [
  { icon: Video, label: 'Text to Video', description: 'Describe any scene, get cinematic video' },
  { icon: Image, label: 'Image to Video', description: 'Animate any still image with AI motion' },
  { icon: Brain, label: 'AI Script Writer', description: 'Auto-generate professional scripts' },
  { icon: Mic, label: 'Voice Synthesis', description: 'AI-powered narration and voiceover' },
  { icon: Lock, label: 'Character Lock', description: 'Consistent characters across scenes' },
];

const STEPS = [
  { number: '01', title: 'Describe', description: 'Write your idea or upload an image' },
  { number: '02', title: 'Generate', description: 'AI creates your video scenes' },
  { number: '03', title: 'Export', description: 'Download in up to 4K quality' },
];

const SectionLoader = () => (
  <div className="py-24 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  const scrollToSection = useCallback((target: string) => {
    const element = document.getElementById(target);
    element?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] overflow-hidden relative">
      {/* Abstract Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#030303]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-6 py-3 rounded-full bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                  <span className="text-base font-bold text-black">AS</span>
                </div>
                <span className="text-lg font-bold text-white hidden sm:block">Apex Studio</span>
              </div>

              <div className="hidden lg:flex items-center gap-1">
                {['Features', 'Pricing', 'FAQ'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => scrollToSection(item.toLowerCase())}
                    className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                className="h-10 px-5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.05] rounded-full"
              >
                Sign in
              </Button>
              <Button
                onClick={() => navigate('/auth?mode=signup')}
                className="h-10 px-6 text-sm font-semibold rounded-full bg-white text-black hover:bg-white/90"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-4 lg:px-8 pt-32 lg:pt-44 pb-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-white/70">60 Free Credits • No Card Required</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mb-8"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
              <span className="block text-white">Create Videos</span>
              <span className="block text-white/40">with AI</span>
            </h1>
            <p className="text-lg lg:text-xl text-white/50 max-w-xl mx-auto">
              Describe your vision. Watch it come to life.
              <span className="block mt-1 text-white/70">Professional quality in minutes.</span>
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button
              onClick={() => navigate('/auth?mode=signup')}
              size="lg"
              className="h-14 px-10 text-base font-semibold rounded-full bg-white text-black hover:bg-white/90 shadow-2xl shadow-white/10"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Creating Free
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowExamples(true)}
              className="h-14 px-8 text-base font-medium text-white/70 hover:text-white hover:bg-white/[0.05] rounded-full"
            >
              <Play className="w-5 h-5 mr-2" />
              View Examples
            </Button>
          </motion.div>

          {/* Quick Process */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-8 lg:gap-16"
          >
            {STEPS.map((step, i) => (
              <div key={step.number} className="flex items-center gap-3">
                <span className="text-2xl font-bold text-white/20">{step.number}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">{step.title}</div>
                  <div className="text-xs text-white/40">{step.description}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-white/20 ml-4 hidden lg:block" />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              Professional video creation tools, powered by advanced AI
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4 group-hover:bg-white/[0.08] transition-colors">
                    <Icon className="w-6 h-6 text-white/70" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.label}</h3>
                  <p className="text-sm text-white/40">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Creation Teaser */}
      <section className="relative z-10 py-16 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<SectionLoader />}>
            <CreationTeaser className="mb-0" />
          </Suspense>
        </div>
      </section>

      {/* Social Proof */}
      <section className="relative z-10 py-20 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-8 lg:gap-16"
          >
            {[
              { value: '50K+', label: 'Videos Created' },
              { value: '10K+', label: 'Creators' },
              { value: '4.9', label: 'Rating' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/40">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <div id="testimonials">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <TestimonialsCarousel />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Pricing */}
      <div id="pricing">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <PricingSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* FAQ */}
      <div id="faq">
        <ErrorBoundaryWrapper fallback={<SectionLoader />}>
          <Suspense fallback={<SectionLoader />}>
            <FAQSection />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>

      {/* Final CTA */}
      <section className="relative z-10 py-24 px-4 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to create?
            </h2>
            <p className="text-lg text-white/50 mb-8 max-w-xl mx-auto">
              Start with 60 free credits. No credit card required.
            </p>
            <Button
              onClick={() => navigate('/auth?mode=signup')}
              size="lg"
              className="h-14 px-10 text-base font-semibold rounded-full bg-white text-black hover:bg-white/90"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Examples Gallery */}
      <Suspense fallback={null}>
        <ExamplesGallery open={showExamples} onOpenChange={setShowExamples} />
      </Suspense>

      {/* Footer */}
      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </div>
  );
}
