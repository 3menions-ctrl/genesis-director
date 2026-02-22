import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

// Pricing constants
const CREDIT_PRICE = 0.10; // $ per credit
const CREDITS_PER_CLIP_MIN = 10;
const CREDITS_PER_CLIP_MAX = 15;

// Slider snap points
const CREDIT_STOPS = [50, 100, 200, 370, 500, 1000, 2000, 2500];

// Features unlocked by credit amount
const getFeatures = (credits: number) => {
  const base = [
    'HD video export (1080p)',
    'AI-powered script generation',
    'Text-to-video creation',
    'Image-to-video animation',
    'Email support',
  ];
  if (credits >= 200) base.push('Basic character consistency');
  if (credits >= 500) {
    base.push('4K video export (2160p)', 'Priority processing queue', 'AI voiceover generation');
  }
  if (credits >= 1000) {
    base.push('Advanced character lock', 'Style transfer (20+ presets)', 'Priority support');
  }
  if (credits >= 2000) {
    base.push('API access', 'White-label exports', 'Team collaboration', 'Dedicated account manager');
  }
  return base;
};

const TRUST_POINTS = [
  { icon: <Shield className="w-4 h-4" />, text: 'Secure payments' },
  { icon: <Clock className="w-4 h-4" />, text: 'Credits never expire' },
  { icon: <Sparkles className="w-4 h-4" />, text: 'No subscriptions' },
];

export default function Pricing() {
  const { navigate } = useSafeNavigation();
  const [credits, setCredits] = useState(370);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const price = Math.round(credits * CREDIT_PRICE);
  const clipsMin = Math.floor(credits / CREDITS_PER_CLIP_MAX);
  const clipsMax = Math.floor(credits / CREDITS_PER_CLIP_MIN);
  const features = getFeatures(credits);

  // Snap to nearest stop
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const nearest = CREDIT_STOPS.reduce((prev, curr) =>
      Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
    );
    setCredits(nearest);
  }, []);

  const sliderPercent = ((credits - CREDIT_STOPS[0]) / (CREDIT_STOPS[CREDIT_STOPS.length - 1] - CREDIT_STOPS[0])) * 100;

  return (
    <div className="min-h-screen bg-[#030308] overflow-hidden relative">
      <Suspense fallback={<div className="fixed inset-0 bg-[#030308]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Ambient glow — subtle, Apple-like */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.02] rounded-full blur-[200px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-white tracking-tight font-['Sora']">
            APEX-STUDIO
          </Link>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="h-8 rounded-lg bg-white/[0.06] hover:bg-white/10 text-white/70 text-[13px] border border-white/[0.08]"
          >
            Sign Up
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-8 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-5 font-['Sora']">
              <span className="block">Choose your</span>
              <span className="block text-white/50">creative fuel.</span>
            </h1>
            <p className="text-base text-white/30 max-w-md mx-auto">
              No subscriptions. Credits never expire. Pay once, create forever.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Interactive Calculator Card */}
      <section className="relative z-10 py-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative rounded-3xl bg-white/[0.02] border border-white/[0.06] p-10 md:p-14 overflow-hidden">
            {/* Subtle corner glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.015] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            {/* Price display */}
            <div className="text-center mb-10">
              <div className="text-[72px] md:text-[96px] font-bold tracking-tighter text-white leading-none font-['Sora']">
                ${price}
              </div>
              <div className="mt-2 text-sm text-white/25">
                {credits.toLocaleString()} credits · {clipsMin}–{clipsMax} clips
              </div>
            </div>

            {/* Slider */}
            <div className="mb-10">
              <div className="relative">
                {/* Track background */}
                <div className="h-1 rounded-full bg-white/[0.06] relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                    style={{ width: `${sliderPercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={CREDIT_STOPS[0]}
                  max={CREDIT_STOPS[CREDIT_STOPS.length - 1]}
                  value={credits}
                  onChange={handleSliderChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {/* Thumb indicator */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.2)] pointer-events-none transition-all duration-150"
                  style={{ left: `calc(${sliderPercent}% - 8px)` }}
                />
              </div>

              {/* Snap labels */}
              <div className="flex justify-between mt-4 px-1">
                {CREDIT_STOPS.filter((_, i) => i % 2 === 0 || CREDIT_STOPS.length <= 6).map(stop => (
                  <button
                    key={stop}
                    onClick={() => setCredits(stop)}
                    className={cn(
                      "text-[10px] font-mono transition-all duration-150",
                      credits === stop ? "text-white/70" : "text-white/15 hover:text-white/30"
                    )}
                  >
                    {stop >= 1000 ? `${stop / 1000}k` : stop}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-credit cost */}
            <div className="flex items-center justify-center gap-6 mb-10 py-4 border-t border-b border-white/[0.04]">
              <div className="text-center">
                <div className="text-lg font-semibold text-white font-['Sora']">$0.10</div>
                <div className="text-[10px] text-white/20 uppercase tracking-wider mt-0.5">per credit</div>
              </div>
              <div className="w-px h-8 bg-white/[0.06]" />
              <div className="text-center">
                <div className="text-lg font-semibold text-white font-['Sora']">${(price / clipsMax).toFixed(2)}–${(price / clipsMin).toFixed(2)}</div>
                <div className="text-[10px] text-white/20 uppercase tracking-wider mt-0.5">per clip</div>
              </div>
              <div className="w-px h-8 bg-white/[0.06]" />
              <div className="text-center">
                <div className="text-lg font-semibold text-white font-['Sora']">∞</div>
                <div className="text-[10px] text-white/20 uppercase tracking-wider mt-0.5">no expiry</div>
              </div>
            </div>

            {/* Features */}
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-10">
              {features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2.5 py-1">
                  <div className="w-4 h-4 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-white/40" />
                  </div>
                  <span className="text-[13px] text-white/40">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              onClick={() => navigate('/auth?mode=signup')}
              className="w-full h-12 rounded-xl font-semibold text-sm bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.06)] transition-all duration-300 group"
            >
              Get {credits.toLocaleString()} Credits for ${price}
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Trust */}
      <section className="relative z-10 py-10 px-6">
        <div className="flex items-center justify-center gap-8">
          {TRUST_POINTS.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-white/20">
              {p.icon}
              <span className="text-[12px] font-medium">{p.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-['Sora']">
            Start creating today.
          </h2>
          <p className="text-white/30 mb-8">
            Join thousands of creators making cinematic AI videos.
          </p>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="h-11 px-8 text-sm font-semibold rounded-xl bg-white text-black hover:bg-white/90"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Get Started Free
          </Button>
        </motion.div>
      </section>

      <div className="relative z-10 pb-12 text-center">
        <Link to="/" className="text-[12px] text-white/20 hover:text-white/40 transition-colors">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
