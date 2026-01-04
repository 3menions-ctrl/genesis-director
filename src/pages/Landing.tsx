import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Play, Sparkles, Film, ArrowRight, 
  Video, Mic, Image, Star,
  Check, MousePointer2, Layers, Wand2,
  Zap, ChevronRight, ArrowUpRight
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
    title: 'Gen-3 Video AI',
    description: 'State-of-the-art diffusion models generate cinematic footage from text.',
    color: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-500/10',
  },
  {
    icon: Wand2,
    title: 'Intelligent Scripting',
    description: 'AI narrative engine crafts compelling stories and screenplays.',
    color: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: Mic,
    title: 'Neural Voice',
    description: 'Ultra-realistic voice synthesis with emotional range.',
    color: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: Image,
    title: 'Character Lock',
    description: 'Maintain visual consistency across all your scenes.',
    color: 'from-orange-500 to-amber-500',
    iconBg: 'bg-orange-500/10',
  },
  {
    icon: Layers,
    title: 'Multi-track Editor',
    description: 'Professional timeline with layers and transitions.',
    color: 'from-pink-500 to-rose-500',
    iconBg: 'bg-pink-500/10',
  },
  {
    icon: MousePointer2,
    title: 'Motion Brush',
    description: 'Direct control over motion paths and camera.',
    color: 'from-indigo-500 to-violet-500',
    iconBg: 'bg-indigo-500/10',
  },
];

const TESTIMONIALS = [
  {
    quote: "This completely changed how we approach video production. What took weeks now takes hours.",
    author: "Sarah Chen",
    role: "Creative Director",
    company: "Vox Media",
  },
  {
    quote: "The quality rivals professional studios. It's genuinely revolutionary technology.",
    author: "Marcus Johnson", 
    role: "Independent Filmmaker",
    company: "Sundance Winner",
  },
  {
    quote: "We've 10x'd our content output. Our engagement has never been higher.",
    author: "Emily Rodriguez",
    role: "VP Marketing",
    company: "Notion",
  },
];

const STATS = [
  { value: '10M+', label: 'Videos Created', icon: Video },
  { value: '500K+', label: 'Active Creators', icon: Sparkles },
  { value: '4.9', label: 'User Rating', icon: Star },
  { value: '<2m', label: 'Avg Generation', icon: Zap },
];

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
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] bg-gradient-to-br from-violet-200/50 via-purple-200/30 to-transparent rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute top-[20%] -left-[30%] w-[60%] h-[60%] bg-gradient-to-tr from-blue-200/40 via-cyan-200/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] right-[10%] w-[50%] h-[50%] bg-gradient-to-tl from-pink-200/30 via-rose-200/20 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Mesh gradient overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            radial-gradient(at 40% 20%, hsla(262, 83%, 70%, 0.15) 0px, transparent 50%),
            radial-gradient(at 80% 0%, hsla(225, 90%, 70%, 0.1) 0px, transparent 50%),
            radial-gradient(at 0% 50%, hsla(280, 80%, 70%, 0.1) 0px, transparent 50%),
            radial-gradient(at 80% 50%, hsla(200, 80%, 70%, 0.1) 0px, transparent 50%),
            radial-gradient(at 0% 100%, hsla(262, 80%, 70%, 0.1) 0px, transparent 50%)
          `,
        }}
      />

      {/* Dot pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Glass Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-6 py-3 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg shadow-slate-200/50">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl blur-md opacity-50" />
                  <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">apex</span>
              </div>

              <div className="hidden lg:flex items-center">
                {['Product', 'Features', 'Pricing', 'Company'].map((item) => (
                  <button 
                    key={item}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-all rounded-xl hover:bg-slate-100/50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/auth')}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 h-10 px-5 text-sm font-medium rounded-xl"
              >
                Sign in
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                className="relative h-10 px-6 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 transition-all overflow-hidden group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-4 lg:px-8 pt-32 lg:pt-40 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Floating badge */}
          <div className="flex justify-center mb-8">
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-50 transition" />
              <div className="relative flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow-xl shadow-slate-200/50">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                <span className="text-sm font-semibold text-slate-700">Gen-3 Alpha now available</span>
                <ChevronRight className="w-4 h-4 text-violet-600" />
              </div>
            </div>
          </div>

          {/* Main headline */}
          <div className="text-center max-w-5xl mx-auto mb-8">
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
              <span className="text-slate-900">Create videos that</span>
              <br />
              <span className="relative">
                <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  captivate the world
                </span>
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-violet-300/50" viewBox="0 0 200 8" preserveAspectRatio="none">
                  <path d="M0,5 Q50,0 100,5 T200,5" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-light">
              Transform imagination into cinema. No equipment, no expertise—just describe and watch AI bring it to life.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="group relative h-14 px-8 text-base font-semibold rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:-translate-y-1 transition-all overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start creating for free
                <Sparkles className="w-5 h-5" />
              </span>
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-14 px-8 text-base font-semibold rounded-2xl bg-white/60 backdrop-blur-sm border border-white/60 text-slate-700 hover:bg-white/80 shadow-lg shadow-slate-200/30 hover:-translate-y-0.5 transition-all"
            >
              <Play className="w-5 h-5 mr-2 text-violet-600" />
              Watch demo
            </Button>
          </div>

          {/* Animated capabilities */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-20">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap}
                className={cn(
                  "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500 cursor-pointer",
                  activeCapability === i 
                    ? "text-white shadow-xl shadow-violet-500/30 scale-105" 
                    : "bg-white/60 backdrop-blur-sm text-slate-500 border border-white/60 hover:border-violet-200 hover:bg-white/80"
                )}
                onClick={() => setActiveCapability(i)}
              >
                {activeCapability === i && (
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full" />
                )}
                <span className="relative z-10">{cap}</span>
              </div>
            ))}
          </div>

          {/* Hero Visual - Glassmorphic Editor */}
          <div className="relative max-w-6xl mx-auto">
            {/* Multi-layer glow */}
            <div className="absolute -inset-8 bg-gradient-to-r from-violet-400/30 via-purple-400/20 to-blue-400/30 rounded-[3rem] blur-3xl" />
            <div className="absolute -inset-4 bg-gradient-to-b from-white/50 to-transparent rounded-[2.5rem] blur-xl" />
            
            {/* Main glass container */}
            <div className="relative rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/60 shadow-2xl shadow-slate-300/50 overflow-hidden">
              {/* Glossy top edge */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
              
              {/* Editor header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50/80 to-white/80 border-b border-slate-100/80">
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-red-400 to-red-500 shadow-sm shadow-red-500/30" />
                    <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm shadow-amber-500/30" />
                    <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm shadow-emerald-500/30" />
                  </div>
                  <div className="h-5 w-px bg-slate-200" />
                  <span className="text-sm text-slate-500 font-medium">my_first_film.apex</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 text-emerald-700 text-xs font-semibold">
                    ✨ 4K Ready
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50 text-violet-700 text-xs font-semibold">
                    Gen-3 Alpha
                  </div>
                </div>
              </div>
              
              {/* Video preview */}
              <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
                {/* Animated mesh gradient */}
                <div 
                  className="absolute inset-0 opacity-50"
                  style={{
                    background: `
                      radial-gradient(ellipse at 30% 20%, hsla(262, 83%, 58%, 0.3) 0%, transparent 50%),
                      radial-gradient(ellipse at 70% 80%, hsla(200, 80%, 50%, 0.2) 0%, transparent 50%)
                    `,
                  }}
                />
                
                {/* Grid overlay */}
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                  }}
                />
                
                {/* Center play button */}
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="relative group cursor-pointer">
                    {/* Ripple effects */}
                    <div className="absolute inset-0 rounded-full bg-white/20 scale-100 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-0 rounded-full bg-white/10 scale-125 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                    
                    {/* Button glow */}
                    <div className="absolute -inset-4 rounded-full bg-white/20 blur-xl" />
                    
                    {/* Main button */}
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-white to-slate-100 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-white to-slate-50" />
                      <Play className="relative w-10 h-10 text-slate-900 ml-1.5" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-lg mb-1">See the magic</p>
                    <p className="text-slate-400 text-sm">2 minute demo</p>
                  </div>
                </div>

                {/* Floating glass cards */}
                <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-sm text-white font-medium">AI Generating...</span>
                </div>
                
                <div className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-white font-medium">Premium Quality</span>
                </div>
                
                <div className="absolute bottom-6 right-6 flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-white text-sm font-mono">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                    00:00:12:24
                  </div>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 backdrop-blur-sm">
                  <div className="h-full w-[35%] bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-r-full shadow-lg shadow-violet-500/50" />
                  <div className="absolute top-1/2 -translate-y-1/2 left-[35%] -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Glass cards */}
      <section className="relative z-10 px-4 lg:px-8 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <div 
                key={i} 
                className="group relative p-6 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/30 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
                    <stat.icon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-4 lg:px-8 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-100/80 to-purple-100/80 backdrop-blur-sm border border-violet-200/50 text-violet-700 text-sm font-semibold mb-6 shadow-lg shadow-violet-200/30">
              <Zap className="w-4 h-4" />
              Powerful Features
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Everything you need
            </h2>
            <p className="text-xl text-slate-500 font-light">
              A complete toolkit for video creation, from concept to final cut.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/30 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.03] transition-opacity",
                  feature.color
                )} />
                
                {/* Top shine */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
                
                <div className="relative">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg",
                    feature.iconBg
                  )}>
                    <div className={cn("w-full h-full rounded-2xl bg-gradient-to-br flex items-center justify-center", feature.color)}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 px-4 lg:px-8 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-100/80 to-teal-100/80 backdrop-blur-sm border border-emerald-200/50 text-emerald-700 text-sm font-semibold mb-6 shadow-lg shadow-emerald-200/30">
              <Sparkles className="w-4 h-4" />
              Simple Pricing
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Start free, scale up
            </h2>
            <p className="text-xl text-slate-500 max-w-xl mx-auto font-light">
              No hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {/* Free */}
            <div className="relative p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/30 hover:shadow-xl transition-all">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Free</h3>
                <p className="text-slate-500">Get started with the basics</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500 ml-2 text-lg">/ month</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['50 credits included', '720p exports', '8-second clips', 'Community support'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                variant="outline" 
                className="w-full h-12 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Get started
              </Button>
            </div>

            {/* Pro - Featured */}
            <div className="relative lg:-mt-4">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-[2rem] blur-lg opacity-30" />
              
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 shadow-2xl shadow-violet-500/40 overflow-hidden">
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent" />
                <div className="absolute top-0 left-0 right-0 h-px bg-white/40" />
                
                {/* Popular badge */}
                <div className="absolute -top-px left-1/2 -translate-x-1/2 px-6 py-1.5 rounded-b-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-bold shadow-lg">
                  Most Popular
                </div>
                
                <div className="relative pt-4">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                    <p className="text-violet-200">For professional creators</p>
                  </div>
                  <div className="mb-8">
                    <span className="text-5xl font-bold text-white">$29</span>
                    <span className="text-violet-200 ml-2 text-lg">/ month</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {['500 credits / month', '4K exports', '60-second clips', 'Priority generation', 'Commercial license'].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-white">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => navigate('/auth')}
                    className="w-full h-12 rounded-xl bg-white text-violet-700 hover:bg-violet-50 font-bold shadow-xl"
                  >
                    Start free trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Enterprise */}
            <div className="relative p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/30 hover:shadow-xl transition-all">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Enterprise</h3>
                <p className="text-slate-500">Custom solutions at scale</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-bold text-slate-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Unlimited credits', '8K exports', 'Custom integrations', 'Dedicated support', 'Model training'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Contact sales
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-4 lg:px-8 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100/80 to-orange-100/80 backdrop-blur-sm border border-amber-200/50 text-amber-700 text-sm font-semibold mb-6 shadow-lg shadow-amber-200/30">
              <Star className="w-4 h-4 fill-current" />
              Testimonials
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Loved by creators
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/30 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
                
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 text-lg leading-relaxed mb-8">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full blur-sm opacity-50" />
                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {testimonial.author.split(' ').map(n => n[0]).join('')}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{testimonial.author}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-4 lg:px-8 py-28">
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Glow effects */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-400/40 via-purple-400/30 to-blue-400/40 rounded-[3rem] blur-3xl" />
            
            <div className="relative rounded-[2.5rem] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-12 lg:p-20 overflow-hidden shadow-2xl shadow-violet-500/40">
              {/* Glossy effects */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-transparent" />
              <div className="absolute top-0 left-0 right-0 h-px bg-white/50" />
              
              {/* Decorative elements */}
              <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-10 left-10 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl" />
              
              <div className="relative text-center">
                <h2 className="text-4xl lg:text-6xl font-bold text-white mb-6">
                  Ready to create magic?
                </h2>
                <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto font-light">
                  Join 500,000+ creators already using Apex. Start free today.
                </p>
                <Button
                  onClick={() => navigate('/auth')}
                  size="lg"
                  className="group relative h-16 px-10 text-lg bg-white text-violet-700 hover:bg-violet-50 font-bold rounded-2xl shadow-2xl hover:-translate-y-1 transition-all overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start creating for free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-violet-200/50 to-transparent" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-4 lg:px-8 py-16 bg-gradient-to-b from-transparent to-slate-50/80">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 p-8 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">apex</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {['Product', 'Features', 'Pricing', 'About', 'Blog', 'Careers'].map((item) => (
                <a key={item} href="#" className="text-sm text-slate-600 hover:text-violet-600 transition-colors font-medium">
                  {item}
                </a>
              ))}
            </div>
            <div className="text-sm text-slate-500">
              © 2024 Apex. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
