import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Play, Sparkles, Zap, Film, Wand2, ArrowRight, 
  Video, Mic, Music, Image, ChevronRight, Star,
  Check, Users, Globe, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    icon: Video,
    title: 'AI Video Generation',
    description: 'Transform scripts into cinematic videos with state-of-the-art AI models.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Wand2,
    title: 'Script Assistant',
    description: 'Let AI help you write compelling narratives and screenplays.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Mic,
    title: 'AI Voice Synthesis',
    description: 'Generate natural voiceovers with expressive AI voices.',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: Image,
    title: 'Visual Consistency',
    description: 'Maintain character and scene consistency across your entire project.',
    gradient: 'from-amber-500 to-orange-500',
  },
];

const STATS = [
  { value: '10M+', label: 'Videos Created' },
  { value: '500K+', label: 'Creators' },
  { value: '4K', label: 'Resolution' },
  { value: '99.9%', label: 'Uptime' },
];

const TESTIMONIALS = [
  {
    quote: "This is the future of content creation. I've never been able to produce videos this fast.",
    author: "Sarah Chen",
    role: "Content Creator",
    avatar: "SC",
  },
  {
    quote: "The AI understands exactly what I want. It's like having a Hollywood studio in my browser.",
    author: "Marcus Johnson",
    role: "Filmmaker",
    avatar: "MJ",
  },
  {
    quote: "We've cut our video production time by 90%. The quality is incredible.",
    author: "Emily Rodriguez",
    role: "Marketing Director",
    avatar: "ER",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-slate-950 to-slate-950" />
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-violet-500/10 rounded-full blur-[120px] animate-pulse-soft" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-soft delay-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-conic from-violet-500/5 via-transparent to-violet-500/5 rounded-full animate-spin-slow" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 lg:px-12 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Film className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-display font-bold">
            Apex<span className="text-violet-400"> Studio</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
          <a href="#testimonials" className="text-sm text-slate-400 hover:text-white transition-colors">Testimonials</a>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/auth')}
            className="text-slate-300 hover:text-white hover:bg-white/5"
          >
            Sign In
          </Button>
          <Button
            onClick={() => navigate('/auth')}
            className="bg-white text-slate-900 hover:bg-slate-100 font-medium px-5"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-12 pt-20 lg:pt-32 pb-20">
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-violet-300">Powered by next-gen AI</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-6 animate-fade-in-up">
            <span className="block">Create cinematic</span>
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              videos with AI
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-fade-in-up delay-2">
            Transform your ideas into stunning videos in minutes. No camera, no crew, 
            no experience needed. Just pure creative freedom.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up delay-3">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="h-14 px-8 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-xl shadow-violet-500/25 border-0"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Creating — It's Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8 text-base border-slate-700 text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Hero Visual */}
          <div className="relative max-w-4xl mx-auto animate-fade-in-up delay-4">
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl">
              {/* Fake editor UI */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-900/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 text-xs text-slate-400">
                    <Film className="w-3 h-3" />
                    My Cinematic Project
                  </div>
                </div>
              </div>
              
              {/* Fake video preview */}
              <div className="aspect-video bg-gradient-to-br from-violet-900/50 via-slate-900 to-purple-900/50 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                <div className="relative flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/50 cursor-pointer hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Your next masterpiece</p>
                    <p className="text-slate-500 text-sm">Click to see the magic</p>
                  </div>
                </div>
                
                {/* Floating UI elements */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-white">4K Ultra HD</span>
                </div>
                
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-xs text-white">AI Enhanced</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 px-6 lg:px-12 py-16 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl lg:text-5xl font-display font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 lg:px-12 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-4">Features</p>
            <h2 className="text-4xl lg:text-5xl font-display font-bold mb-6">
              Everything you need to create
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Our AI-powered toolkit gives you complete creative control from script to screen.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-violet-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/5"
              >
                <div className={cn(
                  "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform",
                  feature.gradient
                )}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-display font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 px-6 lg:px-12 py-24 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-4">Pricing</p>
            <h2 className="text-4xl lg:text-5xl font-display font-bold mb-6">
              Simple, credit-based pricing
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Pay only for what you use. No subscriptions, no hidden fees. Start with 50 free credits.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-white/10">
              <h3 className="text-xl font-display font-bold mb-2">Starter</h3>
              <p className="text-slate-400 text-sm mb-6">Perfect to try things out</p>
              <p className="text-4xl font-display font-bold mb-6">
                Free
                <span className="text-sm font-normal text-slate-500 ml-2">forever</span>
              </p>
              <ul className="space-y-3 mb-8">
                {['50 free credits', '8-second clips', 'HD quality', 'Basic support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                variant="outline" 
                className="w-full border-slate-700 text-slate-300 hover:bg-white/5"
              >
                Get Started
              </Button>
            </div>

            {/* Pro Tier */}
            <div className="relative p-8 rounded-2xl bg-gradient-to-b from-violet-900/50 to-slate-900/50 border border-violet-500/30 shadow-xl shadow-violet-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-xs font-medium">
                Most Popular
              </div>
              <h3 className="text-xl font-display font-bold mb-2">Creator</h3>
              <p className="text-slate-400 text-sm mb-6">For serious creators</p>
              <p className="text-4xl font-display font-bold mb-6">
                $12.99
                <span className="text-sm font-normal text-slate-500 ml-2">150 credits</span>
              </p>
              <ul className="space-y-3 mb-8">
                {['150 credits', 'Up to 1-min clips', '4K quality', 'Priority support', 'Commercial license'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0"
              >
                Get Started
              </Button>
            </div>

            {/* Studio Tier */}
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-white/10">
              <h3 className="text-xl font-display font-bold mb-2">Studio</h3>
              <p className="text-slate-400 text-sm mb-6">For teams & agencies</p>
              <p className="text-4xl font-display font-bold mb-6">
                $49.99
                <span className="text-sm font-normal text-slate-500 ml-2">750 credits</span>
              </p>
              <ul className="space-y-3 mb-8">
                {['750 credits', 'Unlimited duration', '4K + HDR', 'Dedicated support', 'API access'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => navigate('/auth')}
                variant="outline" 
                className="w-full border-slate-700 text-slate-300 hover:bg-white/5"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 px-6 lg:px-12 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-4">Testimonials</p>
            <h2 className="text-4xl lg:text-5xl font-display font-bold mb-6">
              Loved by creators worldwide
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-slate-900/50 border border-white/5"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-white">{testimonial.author}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 lg:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 rounded-3xl bg-gradient-to-br from-violet-900/50 via-slate-900 to-purple-900/50 border border-violet-500/20 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
            <div className="relative">
              <h2 className="text-4xl lg:text-5xl font-display font-bold mb-6">
                Ready to create?
              </h2>
              <p className="text-lg text-slate-400 mb-8 max-w-lg mx-auto">
                Join thousands of creators using AI to bring their visions to life. 
                Start with 50 free credits today.
              </p>
              <Button
                onClick={() => navigate('/auth')}
                size="lg"
                className="h-14 px-10 text-base bg-white text-slate-900 hover:bg-slate-100 font-medium"
              >
                Start Creating for Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-12 py-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold">Apex Studio</span>
            </div>
            
            <div className="flex items-center gap-8 text-sm text-slate-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>

            <p className="text-sm text-slate-500">
              © 2026 Apex Studio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
