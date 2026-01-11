import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowRight, 
  Video, Mic, Image,
  Check, 
  ChevronRight, Loader2, Zap, 
  Brain, Layers, Eye, Stars
} from 'lucide-react';
import apexLogo from '@/assets/apex-logo.png';
import { cn } from '@/lib/utils';
import ExamplesGallery from '@/components/landing/ExamplesGallery';
import HeroVideoBackground from '@/components/landing/HeroVideoBackground';
import CreatorShowcase from '@/components/landing/CreatorShowcase';
import PricingSection from '@/components/landing/PricingSection';

const CAPABILITIES = [
  'Text to Video',
  'Image to Video', 
  'AI Script Writer',
  'Voice Synthesis',
  'Character Lock',
];

const FEATURES = [
  {
    icon: Video,
    title: 'Text-to-Video',
    description: 'Transform any description into cinematic footage with state-of-the-art AI models.',
    highlight: true,
  },
  {
    icon: Image,
    title: 'Image-to-Video',
    description: 'Animate your reference images into dynamic video scenes with perfect consistency.',
    highlight: true,
  },
  {
    icon: Brain,
    title: 'AI Script Generation',
    description: 'Let AI craft compelling narratives, screenplays, and shot breakdowns automatically.',
    highlight: true,
  },
  {
    icon: Eye,
    title: 'Character Lock',
    description: 'Maintain visual identity across all scenes with advanced facial recognition.',
  },
  {
    icon: Mic,
    title: 'Neural Voice',
    description: 'Ultra-realistic voice synthesis with emotional range and perfect timing.',
  },
  {
    icon: Layers,
    title: 'Smart Production',
    description: 'Automated shot planning, scene breakdown, and cinematic orchestration.',
  },
];

const STATS = [
  { value: '847K', label: 'Videos Generated' },
  { value: '23K', label: 'Active Creators' },
  { value: '4.7', label: 'User Rating' },
  { value: '45s', label: 'Avg Generation' },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCapability, setActiveCapability] = useState(0);
  const [demoLoading, setDemoLoading] = useState(false);
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

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@aifilmstudio.com',
        password: 'demo123456'
      });
      if (error) {
        toast.error('Demo login failed. Please try again.');
        console.error('Demo login error:', error);
      } else {
        toast.success('Welcome to the demo!');
      }
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Premium Video Background */}
      <HeroVideoBackground className="fixed inset-0 z-0" overlayOpacity={0.75} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-6 py-3 rounded-2xl nav-glass">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-foreground/20 blur-lg" />
                  <div className="relative w-10 h-10 rounded-xl bg-glossy-black flex items-center justify-center shadow-obsidian overflow-hidden">
                    <img src={apexLogo} alt="Apex Studio" className="w-8 h-8 object-contain" />
                  </div>
                </div>
                <span className="text-xl font-bold text-foreground">Apex Studio</span>
              </div>

              <div className="hidden lg:flex items-center">
                {['Product', 'Features', 'Pricing', 'Company'].map((item) => (
                  <button 
                    key={item}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDemoLogin}
                disabled={demoLoading}
                className="h-10 px-5 text-sm font-medium rounded-xl"
              >
                {demoLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Demo Login'
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                className="h-10 px-5 text-sm font-medium rounded-xl"
              >
                Sign in
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="h-10 px-6 text-sm font-semibold rounded-xl shadow-obsidian"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-4 lg:px-8 pt-32 lg:pt-48 pb-32">
        <div className="max-w-7xl mx-auto">

          {/* Main headline */}
          <div className="text-center max-w-5xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-5xl sm:text-7xl lg:text-[6.5rem] font-bold tracking-tighter leading-[0.95] mb-8">
              <span className="block text-foreground">Create videos that</span>
              <span className="block mt-2 bg-gradient-to-r from-foreground via-foreground/80 to-foreground bg-clip-text text-transparent animate-gradient-shift">
                captivate the world
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              Transform text or images into cinema. AI writes your script, generates scenes, and produces professional videos.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="group h-14 px-10 text-base font-semibold rounded-2xl shadow-obsidian hover:shadow-obsidian-lg transition-all hover:-translate-y-0.5"
            >
              Start creating for free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowExamples(true)}
              className="h-14 px-10 text-base font-semibold rounded-2xl hover:-translate-y-0.5 transition-all"
            >
              <Stars className="w-5 h-5 mr-2" />
              See examples
            </Button>
          </div>

          {/* Examples Gallery Modal */}
          <ExamplesGallery open={showExamples} onOpenChange={setShowExamples} />

          {/* Capabilities with refined styling */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-24 animate-fade-in" style={{ animationDelay: '300ms' }}>
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap}
                className={cn(
                  "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500 cursor-pointer",
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

          {/* Floating Feature Cards - Replacing Video */}
          <div className="relative max-w-6xl mx-auto animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            {/* Central glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.02] to-transparent blur-[60px]" />
            
            {/* Bento-style feature showcase */}
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Main feature - Text to Video */}
              <div className="md:col-span-2 group relative p-8 lg:p-10 rounded-3xl bg-black/60 backdrop-blur-xl text-white shadow-obsidian-xl hover:shadow-obsidian-xl transition-all hover:-translate-y-1 overflow-hidden border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/[0.05] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative">
                  <div className="w-14 h-14 mb-6 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Video className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold mb-3">Text-to-Video</h3>
                  <p className="text-lg text-white/60 max-w-md leading-relaxed">
                    Describe any scene and watch AI bring it to life with stunning cinematic quality.
                  </p>
                  
                  {/* Animated typing indicator */}
                  <div className="mt-8 flex items-center gap-3 text-white/40">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse-soft" />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse-soft" style={{ animationDelay: '200ms' }} />
                      <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse-soft" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-sm font-medium">Generating your vision...</span>
                  </div>
                </div>
              </div>

              {/* Side features */}
              <div className="flex flex-col gap-4">
                {/* Image to Video */}
                <div className="group relative flex-1 p-6 rounded-2xl glass-card hover:border-foreground/10 transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-12 h-12 mb-4 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Image className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">Image-to-Video</h4>
                    <p className="text-sm text-muted-foreground">Animate any image into dynamic video</p>
                  </div>
                </div>

                {/* AI Script */}
                <div className="group relative flex-1 p-6 rounded-2xl glass-card hover:border-foreground/10 transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="w-12 h-12 mb-4 rounded-xl bg-foreground text-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Brain className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">AI Script Writer</h4>
                    <p className="text-sm text-muted-foreground">Generate compelling narratives</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section with enhanced cards */}
      <section className="relative z-10 py-20 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <div 
                key={i}
                className="group relative p-8 text-center animate-fade-in rounded-2xl glass-card hover:border-foreground/10 transition-all"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="absolute inset-0 rounded-2xl bg-foreground/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="text-4xl lg:text-5xl font-bold text-foreground mb-2">{stat.value}</div>
                  <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Modern Bento Grid */}
      <section className="relative z-10 py-24 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
              <Zap className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium text-foreground">Powerful Features</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional-grade AI tools that make video creation effortless.
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, i) => (
              <div 
                key={i}
                className={cn(
                  "group relative p-8 animate-fade-in rounded-2xl transition-all duration-300",
                  feature.highlight 
                    ? "bg-glossy-black text-white shadow-obsidian hover:shadow-obsidian-lg hover:-translate-y-1" 
                    : "glass-card hover:border-foreground/10 hover:-translate-y-1"
                )}
                style={{ animationDelay: `${i * 75}ms` }}
              >
                {feature.highlight && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none" />
                )}
                <div className={cn(
                  "w-12 h-12 mb-6 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                  feature.highlight 
                    ? "bg-white/10 backdrop-blur-sm" 
                    : "bg-foreground text-background shadow-lg"
                )}>
                  <feature.icon className={cn("w-6 h-6", feature.highlight ? "text-white" : "")} />
                </div>
                <h3 className={cn(
                  "text-xl font-semibold mb-3",
                  feature.highlight ? "text-white" : "text-foreground"
                )}>
                  {feature.title}
                </h3>
                <p className={cn(
                  "leading-relaxed",
                  feature.highlight ? "text-white/70" : "text-muted-foreground"
                )}>
                  {feature.description}
                </p>
                {feature.highlight && (
                  <div className="mt-6 flex items-center gap-2 text-white/60 text-sm font-medium group-hover:text-white/80 transition-colors">
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creator Showcase - Real Videos */}
      <CreatorShowcase />

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section with glossy black */}
      <section className="relative z-10 py-24 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-12 lg:p-16 text-center rounded-3xl bg-glossy-black shadow-obsidian-xl overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                Ready to create?
              </h2>
              <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
                Join thousands of creators already making amazing videos with AI.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  onClick={() => navigate('/auth')}
                  size="lg"
                  className="h-14 px-8 text-base font-semibold rounded-2xl bg-white text-foreground hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all"
                >
                  Start for free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/50">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  50 free credits included
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  No credit card required
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with refined styling */}
      <footer className="relative z-10 py-12 px-4 lg:px-8 border-t border-border/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-glossy-black flex items-center justify-center shadow-obsidian overflow-hidden">
                <img src={apexLogo} alt="Apex Studio" className="w-6 h-6 object-contain" />
              </div>
              <span className="font-semibold text-foreground">Apex Studio</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
              <a href="/contact" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Apex Studio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
