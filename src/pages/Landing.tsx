import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Play, Sparkles, Film, ArrowRight, 
  Video, Mic, Image, Star,
  Check, MousePointer2, Layers, Wand2,
  Zap, Globe, Shield, ChevronRight
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
    description: 'State-of-the-art diffusion models generate cinematic footage from simple text descriptions.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Wand2,
    title: 'Intelligent Scripting',
    description: 'AI-powered narrative engine crafts compelling stories and professional screenplays.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Mic,
    title: 'Neural Voice',
    description: 'Ultra-realistic voice synthesis with emotional range and perfect lip-sync.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Image,
    title: 'Character Consistency',
    description: 'Maintain visual consistency across scenes with our character lock technology.',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: Layers,
    title: 'Multi-track Editor',
    description: 'Professional timeline with layers, transitions, and real-time preview.',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: MousePointer2,
    title: 'Motion Brush',
    description: 'Direct control over motion paths and camera movements in generated video.',
    gradient: 'from-indigo-500 to-violet-500',
  },
];

const TESTIMONIALS = [
  {
    quote: "This completely changed how we approach video production. What took weeks now takes hours.",
    author: "Sarah Chen",
    role: "Creative Director, Vox Media",
    rating: 5,
  },
  {
    quote: "The quality rivals professional production studios. It's genuinely revolutionary technology.",
    author: "Marcus Johnson",
    role: "Independent Filmmaker",
    rating: 5,
  },
  {
    quote: "We've 10x'd our content output while maintaining quality. Our engagement has never been higher.",
    author: "Emily Rodriguez",
    role: "VP Marketing, Notion",
    rating: 5,
  },
];

const STATS = [
  { value: '10M+', label: 'Videos Created' },
  { value: '500K+', label: 'Active Creators' },
  { value: '4.9/5', label: 'User Rating' },
  { value: '<2min', label: 'Avg. Generation' },
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
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-50/80 via-white to-blue-50/50" />
        <div className="absolute -top-[500px] -right-[400px] w-[1000px] h-[1000px] bg-gradient-to-br from-violet-200/30 to-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-[300px] -left-[200px] w-[700px] h-[700px] bg-gradient-to-tr from-blue-200/25 to-cyan-200/15 rounded-full blur-3xl" />
      </div>

      {/* Dot pattern overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(260 30% 80%) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 lg:px-20 py-5 bg-white/70 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Film className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-slate-900">apex</span>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {['Product', 'Features', 'Pricing', 'Company'].map((item) => (
              <button 
                key={item}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-50"
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
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 h-10 px-5 text-sm font-medium"
          >
            Sign in
          </Button>
          <Button
            onClick={() => navigate('/auth')}
            className="h-10 px-6 text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-20 pt-20 lg:pt-28 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Announcement badge */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-700">
                Gen-3 Alpha now available
              </span>
              <ChevronRight className="w-4 h-4 text-violet-500" />
            </div>
          </div>

          {/* Main headline */}
          <div className="text-center max-w-4xl mx-auto mb-10">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8">
              <span className="text-slate-900">Create stunning videos</span>
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                with the power of AI
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Transform your ideas into cinematic masterpieces. No equipment, no expertise—just describe what you imagine and watch it come to life.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="h-14 px-8 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-xl shadow-violet-500/30 hover:shadow-violet-500/40 transition-all hover:-translate-y-0.5"
            >
              Start creating for free
              <Sparkles className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8 text-base border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl group font-medium"
            >
              <Play className="w-5 h-5 mr-2 text-violet-600" />
              Watch demo
            </Button>
          </div>

          {/* Capabilities pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-20">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap}
                className={cn(
                  "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500",
                  activeCapability === i 
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 scale-105" 
                    : "bg-white text-slate-500 border border-slate-200 shadow-sm"
                )}
              >
                {cap}
              </div>
            ))}
          </div>

          {/* Hero Visual - Video Editor Mockup */}
          <div className="relative max-w-5xl mx-auto">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-400/20 via-purple-400/20 to-blue-400/20 rounded-3xl blur-2xl" />
            
            {/* Main container */}
            <div className="relative rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-slate-200/60 overflow-hidden">
              {/* Editor chrome */}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 hover:bg-amber-500 transition-colors" />
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 hover:bg-emerald-500 transition-colors" />
                  </div>
                  <div className="h-5 w-px bg-slate-200" />
                  <span className="text-sm text-slate-500 font-medium">untitled_project.apex</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                    4K Ready
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-200">
                    Gen-3 Alpha
                  </div>
                </div>
              </div>
              
              {/* Video preview area */}
              <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative">
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-blue-600/20 opacity-60" />
                
                {/* Grid pattern */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px',
                  }}
                />
                
                {/* Center play button */}
                <div className="relative z-10 flex flex-col items-center gap-5">
                  <div className="relative group cursor-pointer">
                    <div className="absolute -inset-4 rounded-full bg-white/10 blur-xl animate-pulse" />
                    <div className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-slate-900 ml-1" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">See it in action</p>
                    <p className="text-slate-400 text-sm">2 minute demo</p>
                  </div>
                </div>

                {/* Floating elements */}
                <div className="absolute top-5 left-5 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    AI Generating...
                  </span>
                </div>
                
                <div className="absolute bottom-5 right-5 flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-sm text-white text-sm font-mono">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    00:00:12
                  </div>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                  <div className="h-full w-2/5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-r-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 px-6 lg:px-20 py-16 bg-gradient-to-r from-slate-50 to-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 lg:px-20 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Powerful Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Everything you need to create
            </h2>
            <p className="text-lg text-slate-600">
              A complete toolkit for video creation, from concept to final cut.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="group relative p-7 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-5 shadow-lg",
                  feature.gradient
                )}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 px-6 lg:px-20 py-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Simple Pricing
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Start free, scale as you grow
            </h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              No hidden fees. Cancel anytime. Pay only for what you generate.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <div className="relative p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Free</h3>
                <p className="text-slate-500">Get started with the basics</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500 ml-2">/ month</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['50 credits included', '720p exports', '8-second clips', 'Community support'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-slate-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                variant="outline" 
                className="w-full h-12 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold"
              >
                Get started
              </Button>
            </div>

            {/* Pro - Featured */}
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-2xl shadow-violet-500/30 scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-semibold shadow-lg">
                Most Popular
              </div>
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-2">Pro</h3>
                <p className="text-violet-200">For professional creators</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-bold text-white">$29</span>
                <span className="text-violet-200 ml-2">/ month</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['500 credits / month', '4K exports', '60-second clips', 'Priority generation', 'Commercial license'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full h-12 bg-white text-violet-700 hover:bg-violet-50 rounded-xl font-semibold shadow-lg"
              >
                Start free trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="relative p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Enterprise</h3>
                <p className="text-slate-500">Custom solutions at scale</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-bold text-slate-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Unlimited credits', '8K exports', 'Custom integrations', 'Dedicated support', 'Custom model training'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-violet-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                className="w-full h-12 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold"
              >
                Contact sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative z-10 px-6 lg:px-20 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium mb-6">
              <Star className="w-4 h-4 fill-current" />
              Loved by Creators
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              What creators are saying
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 text-lg leading-relaxed mb-6">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{testimonial.author}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 px-6 lg:px-20 py-28">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 p-12 lg:p-16 overflow-hidden shadow-2xl shadow-violet-500/30">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl" />
            
            <div className="relative text-center">
              <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
                Ready to start creating?
              </h2>
              <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
                Join 500,000+ creators already using Apex to bring their ideas to life. Start free today.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  onClick={() => navigate('/auth')}
                  size="lg"
                  className="h-14 px-8 text-base bg-white text-violet-700 hover:bg-violet-50 font-semibold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Start creating for free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-20 py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-slate-900">apex</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {['Product', 'Features', 'Pricing', 'About', 'Blog', 'Careers'].map((item) => (
                <a key={item} href="#" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">
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
