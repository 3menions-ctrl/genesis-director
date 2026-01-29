import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ErrorBoundaryWrapper } from '@/components/ui/error-boundary';
import CinematicTransition from '@/components/landing/CinematicTransition';

// Lazy load components
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const ExamplesGallery = lazy(() => import('@/components/landing/ExamplesGallery'));
const FAQSection = lazy(() => import('@/components/landing/FAQSection'));
const Footer = lazy(() => import('@/components/landing/Footer'));
const FeaturesShowcase = lazy(() => import('@/components/landing/FeaturesShowcase'));

const SectionLoader = () => (
  <div className="py-24 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showExamples, setShowExamples] = useState(false);
  const [showCinematicTransition, setShowCinematicTransition] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  const scrollToSection = useCallback((target: string) => {
    const element = document.getElementById(target);
    element?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleViewGallery = useCallback(() => {
    setShowCinematicTransition(true);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    navigate('/gallery', { state: { fromAnimation: true } });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      {/* Epic Cinematic Transition */}
      <CinematicTransition 
        isActive={showCinematicTransition} 
        onComplete={handleTransitionComplete} 
      />

      {/* Abstract Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-black">A-S</span>
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Apex-Studio</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'FAQ'].map((item) => (
              <button 
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/auth')}
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full"
            >
              Sign in
            </Button>
            <Button
              onClick={() => navigate('/auth?mode=signup')}
              className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90"
            >
              Start Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-6xl mx-auto text-center" style={{ perspective: '1000px' }}>
          {/* Epic 3D animated title */}
          <div className="relative mb-8">
            {/* Multi-layer glow effects */}
            <motion.div
              className="absolute inset-0 blur-[120px] pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background: 'radial-gradient(ellipse 80% 50% at center, rgba(255,255,255,0.4) 0%, rgba(100,100,255,0.1) 40%, transparent 70%)',
              }}
            />
            <motion.div
              className="absolute inset-0 blur-[80px] pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.25, 0.1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              style={{
                background: 'radial-gradient(circle at 30% 50%, rgba(255,100,50,0.15) 0%, transparent 50%)',
              }}
            />
            
            {/* 3D Container */}
            <motion.div
              initial={{ rotateX: 25, rotateY: -5, scale: 0.9 }}
              animate={{ rotateX: 0, rotateY: 0, scale: 1 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <h1 className="relative text-[clamp(3rem,15vw,12rem)] font-black leading-[0.85] tracking-[-0.04em]">
                {/* Apex - with 3D depth layers */}
                <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
                  {'APEX'.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      className="inline-block text-white relative"
                      initial={{ 
                        y: 150, 
                        z: -100,
                        opacity: 0, 
                        rotateX: -90,
                        rotateY: 15
                      }}
                      animate={{ 
                        y: 0, 
                        z: 0,
                        opacity: 1, 
                        rotateX: 0,
                        rotateY: 0
                      }}
                      transition={{
                        duration: 1.2,
                        delay: i * 0.1,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{
                        z: 30,
                        scale: 1.1,
                        textShadow: '0 0 40px rgba(255,255,255,0.8)',
                        transition: { duration: 0.2 }
                      }}
                      style={{ 
                        transformOrigin: 'bottom center',
                        transformStyle: 'preserve-3d',
                        textShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 60px rgba(255,255,255,0.1)',
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
                
                {/* Hyphen with 3D flip */}
                <motion.span
                  className="inline-block mx-2 md:mx-6 text-white/20"
                  initial={{ scaleX: 0, rotateY: 90, opacity: 0 }}
                  animate={{ scaleX: 1, rotateY: 0, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  –
                </motion.span>
                
                {/* Studio - with staggered 3D entrance */}
                <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
                  {'STUDIO'.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      className="inline-block text-white/30 relative"
                      initial={{ 
                        y: 150, 
                        z: -100,
                        opacity: 0, 
                        rotateX: -90,
                        rotateY: -15
                      }}
                      animate={{ 
                        y: 0, 
                        z: 0,
                        opacity: 1, 
                        rotateX: 0,
                        rotateY: 0
                      }}
                      transition={{
                        duration: 1.2,
                        delay: 0.6 + i * 0.08,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{
                        z: 30,
                        scale: 1.1,
                        color: 'rgba(255,255,255,0.7)',
                        textShadow: '0 0 40px rgba(255,255,255,0.5)',
                        transition: { duration: 0.2 }
                      }}
                      style={{ 
                        transformOrigin: 'bottom center',
                        transformStyle: 'preserve-3d',
                        textShadow: '0 4px 30px rgba(0,0,0,0.3)',
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
              </h1>
            </motion.div>

            {/* Animated 3D underline */}
            <motion.div
              className="absolute -bottom-6 left-1/2 h-[2px]"
              initial={{ width: 0, x: '-50%', opacity: 0 }}
              animate={{ width: '70%', opacity: 1 }}
              transition={{ duration: 1.5, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                boxShadow: '0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.1)',
              }}
            />
            
            {/* Floating particles around text */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white/40 rounded-full"
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.6, 0],
                  y: [-20, -60],
                  x: [0, (i % 2 === 0 ? 1 : -1) * 20],
                }}
                transition={{
                  duration: 3,
                  delay: 2 + i * 0.4,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
                style={{
                  left: `${15 + i * 14}%`,
                  top: '50%',
                }}
              />
            ))}
          </div>

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
              onClick={() => setShowCinematicTransition(true)}
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
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-5 h-9 rounded-full border border-white/20 flex items-start justify-center p-1.5"
          >
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              Three simple steps
            </h2>
            <p className="text-lg text-white/40 max-w-md mx-auto">
              From idea to video in minutes, not hours.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-4">
            {[
              { step: '01', title: 'Describe', desc: 'Write what you want to see. Be as detailed or simple as you like.' },
              { step: '02', title: 'Generate', desc: 'AI creates your video scene by scene with cinematic quality.' },
              { step: '03', title: 'Export', desc: 'Download in HD or 4K. Share anywhere instantly.' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]"
              >
                <span className="text-6xl font-bold text-white/[0.06] absolute top-6 right-6">
                  {item.step}
                </span>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-white/40 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <ErrorBoundaryWrapper fallback={<SectionLoader />}>
        <Suspense fallback={<SectionLoader />}>
          <FeaturesShowcase />
        </Suspense>
      </ErrorBoundaryWrapper>


      {/* Pricing CTA */}
      <section className="relative z-10 py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative group">
            {/* Animated glow background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            {/* Card */}
            <div 
              onClick={() => navigate('/pricing')}
              className="relative rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] p-12 md:p-16 cursor-pointer transition-all duration-500 overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/[0.02] to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/[0.03] to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center md:text-left">
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs text-white/50">Simple pricing</span>
                  </motion.div>
                  
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
              
              {/* Bottom stats */}
              <div className="relative mt-10 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-4">
                {[
                  { value: '$0.10', label: 'per credit' },
                  { value: '~10', label: 'credits/clip' },
                  { value: '∞', label: 'no expiry' },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl md:text-3xl font-semibold text-white">{stat.value}</div>
                    <div className="text-xs text-white/30 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
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
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-6">
              Ready to create?
            </h2>
            <p className="text-lg text-white/40 mb-10 max-w-md mx-auto">
              Join thousands of creators making videos with AI.
            </p>
            <Button
              onClick={() => navigate('/auth?mode=signup')}
              size="lg"
              className="h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Get Started Free
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
