import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Play, Film, ArrowRight, 
  Video, Mic, Image,
  Check, Layers, Wand2,
  ChevronRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CAPABILITIES = [
  'Text to Video',
  'Image to Video', 
  'Script Generation',
  'Voice Synthesis',
  'Style Transfer',
];

const FEATURES = [
  {
    icon: Video,
    title: 'AI Video Generation',
    description: 'State-of-the-art models generate cinematic footage from text.',
  },
  {
    icon: Wand2,
    title: 'Intelligent Scripting',
    description: 'AI narrative engine crafts compelling stories and screenplays.',
  },
  {
    icon: Mic,
    title: 'Neural Voice',
    description: 'Ultra-realistic voice synthesis with emotional range.',
  },
  {
    icon: Image,
    title: 'Character Lock',
    description: 'Maintain visual consistency across all your scenes.',
  },
  {
    icon: Layers,
    title: 'Multi-track Editor',
    description: 'Professional timeline with layers and transitions.',
  },
];

const STATS = [
  { value: '10M+', label: 'Videos Created' },
  { value: '500K+', label: 'Active Creators' },
  { value: '4.9', label: 'User Rating' },
  { value: '<2m', label: 'Avg Generation' },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCapability, setActiveCapability] = useState(0);
  const [demoLoading, setDemoLoading] = useState(false);

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
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/30" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-foreground/[0.02] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-foreground/[0.015] rounded-full blur-3xl" />
      </div>

      {/* Dot pattern */}
      <div className="fixed inset-0 pointer-events-none dot-pattern opacity-40" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-6 py-3 rounded-2xl glass-card">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="relative w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shadow-lg">
                    <Film className="w-5 h-5 text-background" />
                  </div>
                </div>
                <span className="text-xl font-bold text-foreground">apex</span>
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
                className="h-10 px-6 text-sm font-semibold rounded-xl"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-4 lg:px-8 pt-32 lg:pt-40 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-full glass-card">
              <span className="flex h-2 w-2 rounded-full bg-foreground animate-pulse-soft" />
              <span className="text-sm font-medium text-foreground">Gen-3 Alpha now available</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Main headline */}
          <div className="text-center max-w-5xl mx-auto mb-8">
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
              <span className="text-foreground">Create videos that</span>
              <br />
              <span className="text-shine">captivate the world</span>
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              Transform imagination into cinema. No equipment, no expertise—just describe and watch AI bring it to life.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="group h-14 px-8 text-base font-semibold rounded-2xl"
            >
              Start creating for free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8 text-base font-semibold rounded-2xl"
            >
              <Play className="w-5 h-5 mr-2" />
              Watch demo
            </Button>
          </div>

          {/* Capabilities */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-20">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap}
                className={cn(
                  "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500 cursor-pointer",
                  activeCapability === i 
                    ? "bg-foreground text-background shadow-lg" 
                    : "glass-card text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveCapability(i)}
              >
                {cap}
              </div>
            ))}
          </div>

          {/* Hero Visual */}
          <div className="relative max-w-6xl mx-auto">
            {/* Glow effect */}
            <div className="absolute -inset-8 bg-foreground/[0.03] rounded-[3rem] blur-3xl" />
            
            {/* Main container */}
            <div className="relative rounded-3xl glass-card overflow-hidden border-foreground/5">
              {/* Editor header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-foreground/20" />
                    <div className="w-3 h-3 rounded-full bg-foreground/15" />
                    <div className="w-3 h-3 rounded-full bg-foreground/10" />
                  </div>
                  <div className="h-5 w-px bg-border" />
                  <span className="text-sm text-muted-foreground font-medium font-mono">my_first_film.apex</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                    4K Ready
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold">
                    Gen-3 Alpha
                  </div>
                </div>
              </div>
              
              {/* Video preview */}
              <div className="aspect-video bg-foreground/[0.03] flex items-center justify-center relative overflow-hidden">
                {/* Grid overlay */}
                <div className="absolute inset-0 grid-pattern opacity-50" />
                
                {/* Center play button */}
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 rounded-full bg-foreground/10 animate-pulse-ring" />
                    <div className="relative w-24 h-24 rounded-full bg-foreground flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <Play className="w-10 h-10 text-background ml-1" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground font-semibold text-lg mb-1">See the magic</p>
                    <p className="text-muted-foreground text-sm">2 minute demo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-20 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <div 
                key={i}
                className="glass-card p-8 text-center animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-4xl lg:text-5xl font-bold text-foreground mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-24 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional-grade tools that make video creation effortless.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div 
                key={i}
                className="glass-card p-8 hover-lift animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="icon-container w-12 h-12 mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="card-obsidian p-12 lg:p-16 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to create?
            </h2>
            <p className="text-lg text-white/70 mb-8 max-w-xl mx-auto">
              Join thousands of creators already making amazing videos with AI.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                onClick={() => navigate('/auth')}
                size="lg"
                className="h-14 px-8 text-base font-semibold rounded-2xl bg-white text-foreground hover:bg-white/90"
              >
                Start for free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/60">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Free forever plan
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 lg:px-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <Film className="w-4 h-4 text-background" />
              </div>
              <span className="font-semibold text-foreground">apex</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Apex. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
