import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, ArrowRight, Sparkles, Shield, Clock, Zap, Crown, Building2,
  Star, Infinity as InfinityIcon, Film, Wand2, Gem,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

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
  /** % savings vs. base $0.10/credit, computed for display */
  savingsPct?: number;
}

const BASE_RATE = 0.10; // $ / credit

function buildPackages(): CreditPackage[] {
  const list: Omit<CreditPackage, 'savingsPct'>[] = [
    {
      name: 'Mini',
      icon: <Sparkles className="w-4 h-4" />,
      tagline: 'Quick top-up · ideal for one short story',
      price: 9,
      credits: 90,
      clips: '~9',
      features: ['1080p HD export', 'AI script generator', 'All cinematic engines', 'Email support'],
    },
    {
      name: 'Starter',
      icon: <Zap className="w-4 h-4" />,
      tagline: 'A weekend of cinematic experiments',
      price: 37,
      credits: 370,
      clips: '~37',
      features: ['1080p HD export', 'AI script generator', 'All cinematic engines', 'Standard support'],
    },
    {
      name: 'Growth',
      icon: <Crown className="w-4 h-4" />,
      tagline: 'Built for creators shipping every week',
      price: 99,
      credits: 1000,
      clips: '~100',
      features: [
        '4K Ultra HD (2160p)',
        'Priority render queue',
        'Seedance Pro engine',
        'Multi-character dialogue',
        'Priority support',
      ],
      popular: true,
    },
    {
      name: 'Agency',
      icon: <Building2 className="w-4 h-4" />,
      tagline: 'For studios and production teams',
      price: 249,
      credits: 2500,
      clips: '~250',
      features: [
        '4K HDR export',
        'Top-tier render queue',
        'API access',
        'White-glove onboarding',
        'Dedicated success manager',
      ],
    },
  ];
  return list.map((p) => {
    const baseline = p.credits * BASE_RATE;
    const savings = baseline > p.price ? Math.round(((baseline - p.price) / baseline) * 100) : 0;
    return { ...p, savingsPct: savings };
  });
}

const PACKAGES = buildPackages();

const TRUST_POINTS = [
  { icon: <Shield className="w-3.5 h-3.5" />, text: 'Secure via Stripe' },
  { icon: <InfinityIcon className="w-3.5 h-3.5" />, text: 'Credits never expire' },
  { icon: <Film className="w-3.5 h-3.5" />, text: 'Kling V3 + Seedance Pro' },
  { icon: <Star className="w-3.5 h-3.5" />, text: 'Zero-waste guarantee' },
];

/**
 * CreditDial — animated luminous ring showing credit volume.
 * Pro-Dark, blue accent, conic-gradient progress against deep glass core.
 */
function CreditDial({ credits, clips, popular }: { credits: number; clips: string; popular?: boolean }) {
  // Map credits (90..2500) onto a 0..1 fill ratio (logarithmic for elegance)
  const min = Math.log(90), max = Math.log(2500);
  const ratio = Math.min(1, Math.max(0.18, (Math.log(credits) - min) / (max - min)));
  const deg = Math.round(ratio * 360);

  return (
    <div className="relative mx-auto w-[150px] h-[150px]">
      {/* Outer luminous halo */}
      <div
        aria-hidden
        className={cn(
          'absolute -inset-3 rounded-full blur-2xl transition-opacity duration-700',
          popular ? 'opacity-90' : 'opacity-40 group-hover:opacity-80',
        )}
        style={{
          background: popular
            ? 'radial-gradient(closest-side, hsl(var(--primary) / 0.55), transparent 70%)'
            : 'radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)',
        }}
      />

      {/* Conic-gradient ring (the "fill") */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from -90deg,
            hsl(var(--primary)) 0deg,
            hsl(var(--primary) / 0.85) ${deg * 0.5}deg,
            hsl(var(--primary) / 0.55) ${deg}deg,
            hsl(0 0% 100% / 0.04) ${deg}deg 360deg)`,
          padding: '2px',
          WebkitMask: 'radial-gradient(circle, transparent 64%, #000 65%)',
          mask: 'radial-gradient(circle, transparent 64%, #000 65%)',
        }}
      />

      {/* Inner glass core */}
      <div className="absolute inset-[6px] rounded-full bg-[radial-gradient(closest-side,hsl(220_14%_5%/0.95),hsl(220_14%_2%/0.85))] border border-white/[0.06] backdrop-blur-xl" />

      {/* Subtle inner reflection */}
      <div
        aria-hidden
        className="absolute inset-[6px] rounded-full pointer-events-none opacity-60"
        style={{
          background: 'linear-gradient(160deg, hsl(0 0% 100% / 0.06) 0%, transparent 38%)',
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold text-white text-[28px] tabular-nums tracking-tight leading-none">
          {credits >= 1000 ? `${(credits / 1000).toFixed(credits % 1000 === 0 ? 0 : 1)}k` : credits}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/40 font-medium">credits</span>
        <div className="w-7 h-px bg-white/[0.08] my-2" />
        <span className="text-[10px] text-white/45 tabular-nums">{clips} clips</span>
      </div>
    </div>
  );
}

function PricingCard({
  pkg,
  index,
  onPurchase,
}: {
  pkg: CreditPackage;
  index: number;
  onPurchase: (pkg: CreditPackage) => void;
}) {
  const { navigate } = useSafeNavigation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={cn('relative group', pkg.popular && 'lg:-mt-3')}
    >
      {/* Popular badge */}
      {pkg.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-md opacity-90"
                 style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.7), transparent 70%)' }} />
            <div className="relative px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] inline-flex items-center gap-1.5 text-primary-foreground border border-[hsl(var(--primary)/0.5)] bg-gradient-to-b from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.7)]">
              <Gem className="w-3 h-3" />
              Most loved
            </div>
          </div>
        </div>
      )}

      {/* Animated conic border (popular only) */}
      {pkg.popular && (
        <div
          aria-hidden
          className="absolute -inset-px rounded-[30px] pointer-events-none opacity-90"
          style={{
            background:
              'conic-gradient(from var(--angle, 0deg), hsl(var(--primary) / 0.0) 0%, hsl(var(--primary) / 0.55) 25%, hsl(var(--primary) / 0.0) 50%, hsl(var(--primary) / 0.45) 75%, hsl(var(--primary) / 0.0) 100%)',
            WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            animation: 'spin 8s linear infinite',
          }}
        />
      )}

      <div
        className={cn(
          'relative rounded-[28px] p-7 pt-9 overflow-hidden transition-all duration-500',
          'border backdrop-blur-2xl',
          pkg.popular
            ? 'border-[hsl(var(--primary)/0.28)] bg-gradient-to-b from-[hsl(220_14%_5%/0.85)] to-[hsl(220_14%_2%/0.95)] shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.06)]'
            : 'border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-white/[0.14] shadow-[0_20px_60px_-30px_hsl(0_0%_0%/0.8)]',
        )}
      >
        {/* Top-edge specular highlight */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)',
          }}
        />

        {/* Corner aurora glow */}
        <div
          aria-hidden
          className={cn(
            'absolute -top-24 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-opacity duration-700',
            pkg.popular ? 'opacity-80' : 'opacity-0 group-hover:opacity-50',
          )}
          style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.32), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-700"
          style={{ background: 'radial-gradient(closest-side, hsl(var(--accent) / 0.18), transparent 70%)' }}
        />

        {/* Header row: icon + savings */}
        <div className="relative flex items-center justify-between mb-5">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border',
              pkg.popular
                ? 'bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.35)] text-[hsl(var(--primary))]'
                : 'bg-white/[0.04] border-white/[0.08] text-white/65',
            )}
          >
            {pkg.icon}
          </div>
          {pkg.savingsPct && pkg.savingsPct > 0 ? (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--success))] inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)]">
              Save {pkg.savingsPct}%
            </div>
          ) : (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35 inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">
              Pay-as-you-go
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-semibold text-white text-[22px] tracking-tight leading-none mb-2">
          {pkg.name}
        </h3>
        <p className="text-[12.5px] text-white/40 leading-relaxed min-h-[34px] mb-6 max-w-[24ch]">
          {pkg.tagline}
        </p>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-7">
          <span className="text-[11px] text-white/35 font-medium">$</span>
          <span className="font-display font-semibold text-white text-[52px] leading-none tabular-nums tracking-[-0.03em]">
            {pkg.price}
          </span>
          <span className="text-[11px] text-white/30 ml-1">one-time</span>
        </div>

        {/* Credit Dial */}
        <div className="mb-7">
          <CreditDial credits={pkg.credits} clips={pkg.clips} popular={pkg.popular} />
        </div>

        {/* Per-credit micro-rate */}
        <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] text-white/35">
          <Wand2 className="w-3 h-3" />
          <span className="tabular-nums">${(pkg.price / pkg.credits).toFixed(3)}</span>
          <span>/ credit</span>
        </div>

        {/* Hairline divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-5" />

        {/* Features */}
        <ul className="space-y-2.5 mb-7">
          {pkg.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 border',
                  pkg.popular
                    ? 'bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.35)] text-[hsl(var(--primary))]'
                    : 'bg-white/[0.04] border-white/[0.06] text-white/60',
                )}
              >
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
              </span>
              <span className="text-[12.5px] text-white/65 leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          onClick={() => onPurchase(pkg)}
          className={cn(
            'w-full h-11 rounded-2xl text-[13px] font-semibold transition-all duration-300 group/btn relative overflow-hidden',
            pkg.popular
              ? 'text-black border border-white/20 bg-white hover:bg-white/90 shadow-[0_12px_40px_-12px_hsla(0,0%,100%,0.35),inset_0_1px_0_hsla(0,0%,100%,0.6)]'
              : 'bg-white/[0.05] hover:bg-white/[0.09] text-white/85 border border-white/[0.08] hover:border-white/[0.16]',
          )}
        >
          {/* Shimmer */}
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
            style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)' }}
          />
          <span className="relative inline-flex items-center justify-center gap-1.5">
            Get {pkg.credits >= 1000 ? `${pkg.credits.toLocaleString()}` : pkg.credits} credits
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </span>
        </Button>
      </div>
    </motion.div>
  );
}

export default function Pricing() {
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const [showBuyModal, setShowBuyModal] = useState(false);

  const handlePurchase = (pkg: CreditPackage) => {
    const slug = (pkg.name || '').toLowerCase();
    if (user) {
      // Authed: open the in-page checkout modal directly.
      setShowBuyModal(true);
    } else {
      // Guest: send to signup, then auto-open the buy modal on /profile.
      navigate(`/auth?mode=signup&next=${encodeURIComponent('/profile?buy=' + slug)}`);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(220_14%_2%)] overflow-hidden relative font-body">
      <Suspense fallback={<div className="fixed inset-0 bg-[#030308]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Cinematic conic aurora — matches loader signature */}
      <style>{`
        @keyframes pricingAurora { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes pricingTick { 0%,100%{opacity:.35} 50%{opacity:1} }
      `}</style>
      <div aria-hidden className="fixed inset-0 pointer-events-none z-[1]">
        <div
          className="absolute -inset-[20%] opacity-[0.16]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.2) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
            filter: 'blur(80px)',
            animation: 'pricingAurora 60s linear infinite',
          }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsl(220 14% 1%) 100%)' }} />
      </div>

      {/* Ambient hero glow stack */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div
          className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[1100px] h-[520px] rounded-full blur-[180px] opacity-70"
          style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)' }}
        />
        <div
          className="absolute top-[40%] -left-40 w-[600px] h-[600px] rounded-full blur-[160px] opacity-40"
          style={{ background: 'radial-gradient(closest-side, hsl(var(--accent) / 0.14), transparent 70%)' }}
        />
        {/* Subtle film-grain noise via SVG */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-lg text-white tracking-tight">
            APEX-STUDIO
          </Link>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.09] text-white/80 text-[13px] border border-white/[0.08] backdrop-blur-md"
          >
            Sign Up
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-2 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {/* Status pill */}
            <div className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full border border-white/[0.07] bg-white/[0.03] backdrop-blur-md mb-7">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-70 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-medium">
                Pricing · Live
              </span>
            </div>

            <h1 className="font-display font-semibold tracking-[-0.03em] text-[44px] sm:text-[64px] leading-[1.02] text-white">
              Pricing as{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(110deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 55%, hsl(var(--foreground)) 100%)',
                }}
              >
                cinematic
              </span>{' '}
              as your stories.
            </h1>
            <p className="text-[15px] text-white/45 mt-5 max-w-lg mx-auto leading-relaxed">
              Pay only for what you create. <span className="text-white/70 tabular-nums">1 credit = $0.10</span> · roughly 10 credits per finished clip. Buy more, save more — no subscriptions, no expirations.
            </p>

            {/* Diagnostic ticker — signature */}
            <div className="mt-8 inline-flex items-center gap-5 text-[10px] uppercase tracking-[0.32em] text-white/40 font-medium">
              {['Engine', 'Render', 'Stream'].map((t, i) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-1 h-1 rounded-full bg-[hsl(var(--primary))]"
                    style={{ animation: `pricingTick 2.4s ease-in-out ${i * 0.4}s infinite` }}
                  />
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Cards */}
      <section className="relative z-10 pt-14 pb-10 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {PACKAGES.map((pkg, i) => (
            <PricingCard key={pkg.name} pkg={pkg} index={i} onPurchase={handlePurchase} />
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="relative z-10 py-10 px-6">
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-md px-6 py-5">
          <div className="flex items-center justify-center gap-x-8 gap-y-3 flex-wrap">
            {TRUST_POINTS.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-white/55">
                <span className="text-[hsl(var(--primary))]">{p.icon}</span>
                <span className="text-[12px] font-medium">{p.text}</span>
              </div>
            ))}
          </div>
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
          <h2 className="font-display font-semibold tracking-[-0.03em] text-[32px] md:text-[42px] leading-tight text-white mb-4">
            Start creating today.
          </h2>
          <p className="text-white/45 mb-8 text-[14px]">
            Join thousands of creators making cinematic AI videos.
          </p>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="h-12 px-8 text-[13px] font-semibold rounded-full text-black border border-white/20 bg-white hover:bg-white/90 shadow-[0_12px_40px_-12px_hsla(0,0%,100%,0.35),inset_0_1px_0_hsla(0,0%,100%,0.6)]"
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

      {/* In-page checkout for authed users */}
      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
}
