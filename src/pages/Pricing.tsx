import { lazy, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles, Shield, Clock, Zap, Crown, Building2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

interface CreditPackage {
  name: string;
  icon: React.ReactNode;
  tagline: string;
  price: number;
  credits: number;
  clips: string;
  features: string[];
  popular?: boolean;
  accent: string; // tailwind gradient classes
  glowColor: string;
}

const PACKAGES: CreditPackage[] = [
  {
    name: 'Mini',
    icon: <Sparkles className="w-5 h-5" />,
    tagline: 'Quick top-up to get started',
    price: 9,
    credits: 90,
    clips: '~9',
    features: ['HD export (1080p)', 'AI scripts', '~9 clips'],
    accent: 'from-white/[0.08] to-white/[0.02]',
    glowColor: 'rgba(255,255,255,0.04)',
  },
  {
    name: 'Starter',
    icon: <Zap className="w-5 h-5" />,
    tagline: 'Perfect for trying out the platform',
    price: 37,
    credits: 370,
    clips: '~37',
    features: ['HD export (1080p)', 'AI scripts', 'Standard support'],
    accent: 'from-white/[0.08] to-white/[0.02]',
    glowColor: 'rgba(255,255,255,0.04)',
  },
  {
    name: 'Growth',
    icon: <Crown className="w-5 h-5" />,
    tagline: 'For serious creators and small teams',
    price: 99,
    credits: 1000,
    clips: '~100',
    features: ['4K export (2160p)', 'Priority processing', 'Priority support'],
    popular: true,
    accent: 'from-violet-500/20 to-fuchsia-500/10',
    glowColor: 'rgba(124,58,237,0.12)',
  },
  {
    name: 'Agency',
    icon: <Building2 className="w-5 h-5" />,
    tagline: 'For studios and production teams',
    price: 249,
    credits: 2500,
    clips: '~250',
    features: ['4K HDR', 'API access', 'Dedicated support'],
    accent: 'from-white/[0.08] to-white/[0.02]',
    glowColor: 'rgba(255,255,255,0.04)',
  },
];

const TRUST_POINTS = [
  { icon: <Shield className="w-4 h-4" />, text: 'Secure via Stripe' },
  { icon: <Clock className="w-4 h-4" />, text: 'Credits never expire' },
  { icon: <Star className="w-4 h-4" />, text: 'Zero-waste guarantee' },
];

function CreditCircle({ credits, clips, popular }: { credits: number; clips: string; popular?: boolean }) {
  return (
    <div className="relative mx-auto w-[130px] h-[130px]">
      {/* Outer ring */}
      <div className={cn(
        "absolute inset-0 rounded-full border-2 transition-all duration-500",
        popular ? "border-violet-500/40" : "border-white/[0.08]"
      )} />
      {/* Inner glow */}
      {popular && (
        <div className="absolute inset-2 rounded-full bg-violet-500/[0.06] animate-pulse" />
      )}
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white font-['Sora'] tracking-tight">
          {credits >= 1000 ? `${(credits / 1000).toFixed(0)}k` : credits}
        </span>
        <span className="text-[10px] text-white/30 uppercase tracking-wider">credits</span>
        <div className="w-6 h-px bg-white/[0.08] my-1.5" />
        <span className="text-[10px] text-white/25">{clips} clips</span>
      </div>
    </div>
  );
}

function PricingCard({ pkg, index }: { pkg: CreditPackage; index: number }) {
  const { navigate } = useSafeNavigation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
      className="relative group"
    >
      {/* Popular badge */}
      {pkg.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="px-3 py-1 rounded-full bg-violet-500 text-white text-[10px] font-semibold uppercase tracking-wider shadow-[0_0_20px_rgba(124,58,237,0.4)]">
            Popular
          </div>
        </div>
      )}

      <div className={cn(
        "relative rounded-[28px] p-6 pt-8 overflow-hidden transition-all duration-500",
        "bg-gradient-to-b border",
        pkg.popular
          ? "border-violet-500/30 shadow-[0_0_40px_rgba(124,58,237,0.1)]"
          : "border-white/[0.06] hover:border-white/[0.12]",
        pkg.accent,
      )}>
        {/* Corner glow */}
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100"
          style={{ background: pkg.glowColor }}
        />

        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
          pkg.popular ? "bg-violet-500/15 text-violet-400" : "bg-white/[0.05] text-white/50"
        )}>
          {pkg.icon}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white font-['Sora'] mb-1">{pkg.name}</h3>
        <p className="text-[12px] text-white/30 mb-5 leading-relaxed min-h-[32px]">{pkg.tagline}</p>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-6">
          <span className="text-4xl font-bold text-white font-['Sora'] tracking-tight">${pkg.price}</span>
          <span className="text-[12px] text-white/25">one-time</span>
        </div>

        {/* Credit circle */}
        <div className="mb-6">
          <CreditCircle credits={pkg.credits} clips={pkg.clips} popular={pkg.popular} />
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-6">
          {pkg.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className={cn(
                "w-3.5 h-3.5 shrink-0",
                pkg.popular ? "text-violet-400" : "text-white/30"
              )} />
              <span className="text-[12px] text-white/40">{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          onClick={() => navigate('/auth?mode=signup')}
          className={cn(
            "w-full h-10 rounded-xl text-[13px] font-semibold transition-all duration-300 group/btn",
            pkg.popular
              ? "bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
              : "bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/[0.08]"
          )}
        >
          Get {pkg.credits >= 1000 ? `${(pkg.credits / 1000).toFixed(0)},000` : pkg.credits}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover/btn:translate-x-0.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function Pricing() {
  const { navigate } = useSafeNavigation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <div className="min-h-screen bg-[#030308] overflow-hidden relative">
      <Suspense fallback={<div className="fixed inset-0 bg-[#030308]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.02] rounded-full blur-[200px]" />
      </div>

      {/* Nav */}
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
      <section className="relative z-10 pt-20 pb-6 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[12px] text-white/50 font-medium">Production Credits</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-4 font-['Sora']">
              Power your creativity
            </h1>
            <p className="text-sm text-white/30 max-w-md mx-auto">
              1 credit = $0.10 · ~10 credits per clip
            </p>
          </motion.div>
        </div>
      </section>

      {/* Cards */}
      <section className="relative z-10 py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PACKAGES.map((pkg, i) => (
            <PricingCard key={pkg.name} pkg={pkg} index={i} />
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="relative z-10 py-10 px-6">
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {TRUST_POINTS.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-white/20">
              {p.icon}
              <span className="text-[12px] font-medium">{p.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-20 px-6">
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
