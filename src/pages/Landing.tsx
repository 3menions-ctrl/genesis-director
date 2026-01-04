import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Play, Sparkles, Film, ArrowRight, 
  Video, Mic, Image, Star,
  Check, MousePointer2, Layers, Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CAPABILITIES = [
  { label: 'Text to Video', active: true },
  { label: 'Image to Video', active: false },
  { label: 'Script Generation', active: false },
  { label: 'Voice Synthesis', active: false },
  { label: 'Style Transfer', active: false },
];

const FEATURES = [
  {
    icon: Video,
    title: 'Gen-3 Video AI',
    description: 'State-of-the-art diffusion models generate cinematic footage from text descriptions.',
    tag: 'NEW',
  },
  {
    icon: Wand2,
    title: 'Intelligent Scripting',
    description: 'AI-powered narrative engine crafts compelling stories and professional screenplays.',
  },
  {
    icon: Mic,
    title: 'Neural Voice',
    description: 'Ultra-realistic voice synthesis with emotional range and perfect lip-sync.',
  },
  {
    icon: Image,
    title: 'Consistent Characters',
    description: 'Maintain visual consistency across scenes with our character lock technology.',
  },
  {
    icon: Layers,
    title: 'Multi-track Editor',
    description: 'Professional timeline with layers, transitions, and real-time preview.',
  },
  {
    icon: MousePointer2,
    title: 'Motion Brush',
    description: 'Direct control over motion paths and camera movements in generated video.',
    tag: 'BETA',
  },
];

const TESTIMONIALS = [
  {
    quote: "This completely changed how we approach video production. What took weeks now takes hours.",
    author: "Sarah Chen",
    role: "Creative Director, Vox Media",
    avatar: "/placeholder.svg",
  },
  {
    quote: "The quality rivals professional production studios. It's genuinely revolutionary technology.",
    author: "Marcus Johnson",
    role: "Independent Filmmaker",
    avatar: "/placeholder.svg",
  },
  {
    quote: "We've 10x'd our content output while maintaining quality. Our engagement has never been higher.",
    author: "Emily Rodriguez",
    role: "VP Marketing, Notion",
    avatar: "/placeholder.svg",
  },
];

const LOGOS = ['Netflix', 'Disney', 'Apple', 'Google', 'Meta', 'Adobe'];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCapability, setActiveCapability] = useState(0);

  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCapability((prev) => (prev + 1) % CAPABILITIES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white overflow-hidden">
      {/* Gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[400px] -left-[300px] w-[800px] h-[800px] bg-violet-600/20 rounded-full blur-[150px]" />
        <div className="absolute top-1/3 -right-[200px] w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[200px] left-1/3 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
        }}
      />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 lg:px-16 py-5">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
              <Film className="w-5 h-5 text-[#0A0A0B]" />
            </div>
            <span className="text-lg font-semibold tracking-tight">apex</span>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {['Product', 'Research', 'Pricing', 'Company'].map((item) => (
              <button 
                key={item}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
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
            className="text-zinc-400 hover:text-white hover:bg-white/5 h-9 px-4 text-sm"
          >
            Sign in
          </Button>
          <Button
            onClick={() => navigate('/auth')}
            className="h-9 px-5 text-sm bg-white text-black hover:bg-zinc-200 font-medium rounded-lg"
          >
            Try Apex
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-16 pt-24 lg:pt-32 pb-24">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-4xl">
            {/* Announcement */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-zinc-400">
                Gen-3 Alpha now available — <span className="text-white">Learn more</span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[80px] font-medium tracking-[-0.02em] leading-[0.95] mb-8">
              <span className="block text-white">The future of</span>
              <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                video creation
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg lg:text-xl text-zinc-400 max-w-xl mb-10 leading-relaxed">
              Transform ideas into cinematic videos with AI. No equipment, no expertise—just describe what you imagine.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap items-center gap-4 mb-16">
              <Button
                onClick={() => navigate('/auth')}
                size="lg"
                className="h-12 px-6 text-sm bg-white text-black hover:bg-zinc-200 font-medium rounded-lg"
              >
                Start creating for free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="h-12 px-6 text-sm text-white hover:bg-white/5 rounded-lg group"
              >
                <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Watch demo
              </Button>
            </div>

            {/* Capabilities ticker */}
            <div className="flex flex-wrap items-center gap-2">
              {CAPABILITIES.map((cap, i) => (
                <button
                  key={cap.label}
                  onClick={() => setActiveCapability(i)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm transition-all duration-300",
                    activeCapability === i 
                      ? "bg-white text-black font-medium" 
                      : "bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10"
                  )}
                >
                  {cap.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hero Visual */}
          <div className="mt-20 relative">
            <div className="absolute -inset-px bg-gradient-to-b from-white/10 via-transparent to-transparent rounded-2xl" />
            <div className="relative rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 overflow-hidden">
              {/* Editor chrome */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-white/10 hover:bg-red-500/80 transition-colors cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-white/10 hover:bg-yellow-500/80 transition-colors cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-white/10 hover:bg-green-500/80 transition-colors cursor-pointer" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Film className="w-3.5 h-3.5" />
                  untitled_project.apex
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    4K Ready
                  </div>
                </div>
              </div>
              
              {/* Video preview area */}
              <div className="aspect-[21/9] bg-black flex items-center justify-center relative group">
                {/* Animated grid */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `radial-gradient(circle at center, rgba(139,92,246,0.3) 0%, transparent 70%)`,
                  }}
                />
                
                {/* Center play button */}
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
                    <div className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-2xl shadow-white/25">
                      <Play className="w-8 h-8 text-black ml-1" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium mb-1">See it in action</p>
                    <p className="text-zinc-500 text-sm">2 min demo</p>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs text-white">Gen-3 Alpha</span>
                </div>
                
                <div className="absolute bottom-6 right-6 flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-white">00:00:00</span>
                  </div>
                </div>

                {/* Timeline hint */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent flex items-end pb-4 px-6">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="relative z-10 px-6 lg:px-16 py-16 border-y border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <p className="text-center text-xs text-zinc-500 uppercase tracking-widest mb-10">
            Trusted by creative teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
            {LOGOS.map((logo) => (
              <span key={logo} className="text-2xl font-semibold text-zinc-700 hover:text-zinc-500 transition-colors cursor-default">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 px-6 lg:px-16 py-32">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-4xl lg:text-5xl font-medium tracking-tight mb-6">
              Everything you need to create
            </h2>
            <p className="text-lg text-zinc-400">
              A complete toolkit for video creation, from concept to final cut.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
              >
                {feature.tag && (
                  <span className="absolute top-4 right-4 px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-300 uppercase tracking-wider">
                    {feature.tag}
                  </span>
                )}
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-5 group-hover:bg-white/10 transition-colors">
                  <feature.icon className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-white">{feature.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 px-6 lg:px-16 py-32">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-medium tracking-tight mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              Start free. Pay only for what you generate.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {/* Free */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-2">Free</h3>
                <p className="text-sm text-zinc-500">Get started with the basics</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-medium">$0</span>
                <span className="text-zinc-500 ml-2">/ month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['50 credits included', '720p exports', '8-second clips', 'Community support'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                variant="outline" 
                className="w-full h-10 border-white/10 text-white hover:bg-white/5 rounded-lg"
              >
                Get started
              </Button>
            </div>

            {/* Pro */}
            <div className="relative p-8 rounded-2xl bg-gradient-to-b from-violet-500/10 to-transparent border border-violet-500/20">
              <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium">Pro</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-300 uppercase">
                    Popular
                  </span>
                </div>
                <p className="text-sm text-zinc-500">For professional creators</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-medium">$29</span>
                <span className="text-zinc-500 ml-2">/ month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['500 credits / month', '4K exports', '60-second clips', 'Priority generation', 'Commercial license'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-violet-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full h-10 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium"
              >
                Start free trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-2">Enterprise</h3>
                <p className="text-sm text-zinc-500">Custom solutions for teams</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-medium">Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Unlimited credits', '8K exports', 'Unlimited duration', 'API access', 'Dedicated support', 'Custom model training'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-zinc-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                className="w-full h-10 border-white/10 text-white hover:bg-white/5 rounded-lg"
              >
                Contact sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-6 lg:px-16 py-32 border-t border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-medium tracking-tight mb-6">
              Loved by creators
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/5"
              >
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-300 mb-8 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600" />
                  <div>
                    <p className="font-medium text-white text-sm">{testimonial.author}</p>
                    <p className="text-xs text-zinc-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 lg:px-16 py-32">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl lg:text-6xl font-medium tracking-tight mb-6">
            Start creating today
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-lg mx-auto">
            Join thousands of creators pushing the boundaries of what's possible with AI video.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="h-12 px-8 text-sm bg-white text-black hover:bg-zinc-200 font-medium rounded-lg"
            >
              Get started for free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 px-8 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              Talk to sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-16 py-16 border-t border-white/5">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <Film className="w-4 h-4 text-[#0A0A0B]" />
              </div>
              <span className="text-base font-semibold tracking-tight">apex</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-8 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">Status</a>
            </div>

            <p className="text-sm text-zinc-600">
              © 2026 Apex Studio
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
