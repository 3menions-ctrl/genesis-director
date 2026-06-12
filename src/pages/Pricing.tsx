import { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ArrowRight, Sparkles, Shield, Zap, Crown, Building2,
  Star, Infinity as InfinityIcon, Film, Wand2, Gem, User, Briefcase,
  Repeat, Headphones, Lock, Users, Globe, Cpu, FileCheck2, Phone,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

import { usePageMeta } from '@/hooks/usePageMeta';
const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

type Segment = 'personal' | 'business' | 'enterprise' | 'subscription';

interface CreditPackage {
  name: string;
  icon: React.ReactNode;
  tagline: string;
  price: number;
  credits: number;
  clips: string;
  features: string[];
  popular?: boolean;
  /** Optional segment override (defaults to 'personal' when undefined) */
  segment?: Segment;
  /** Recurring interval for subscription tier (display only) */
  interval?: 'month' | 'year';
  /** Override CTA label */
  ctaLabel?: string;
  /** Treat CTA as contact-sales instead of credit purchase */
  contactSales?: boolean;
  /** % savings vs. base $0.10/credit, computed for display */
  savingsPct?: number;
}

const BASE_RATE = 0.10; // $ / credit

/** Personal — pay-as-you-go credit packs */
function buildPersonal(): CreditPackage[] {
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
    return { ...p, segment: 'personal', savingsPct: savings };
  });
}

/** Business — bigger packs, team features, account management */
function buildBusiness(): CreditPackage[] {
  const list: Omit<CreditPackage, 'savingsPct'>[] = [
    {
      name: 'Studio',
      icon: <Briefcase className="w-4 h-4" />,
      tagline: 'Small teams shipping campaigns',
      price: 499,
      credits: 5500,
      clips: '~550',
      features: [
        '4K HDR export',
        'Up to 5 seats',
        'Priority render queue',
        'Brand kit & presets',
        'Account manager',
      ],
    },
    {
      name: 'Brand',
      icon: <Crown className="w-4 h-4" />,
      tagline: 'In-house teams running content engines',
      price: 999,
      credits: 12000,
      clips: '~1.2k',
      features: [
        '4K HDR + ProRes export',
        'Up to 15 seats',
        'Top-tier render queue',
        'Multi-character dialogue',
        'API access · Webhooks',
        'Priority Slack support',
      ],
      popular: true,
    },
    {
      name: 'Agency+',
      icon: <Building2 className="w-4 h-4" />,
      tagline: 'Studios producing at scale',
      price: 2499,
      credits: 32000,
      clips: '~3.2k',
      features: [
        '4K HDR + ProRes export',
        'Unlimited seats',
        'Dedicated render lane',
        'White-glove onboarding',
        'Dedicated success manager',
        'SAML SSO available',
      ],
    },
  ];
  return list.map((p) => {
    const baseline = p.credits * BASE_RATE;
    const savings = baseline > p.price ? Math.round(((baseline - p.price) / baseline) * 100) : 0;
    return { ...p, segment: 'business', savingsPct: savings };
  });
}

/** Subscription — recurring monthly credit grants */
function buildSubscription(): CreditPackage[] {
  const list: Omit<CreditPackage, 'savingsPct'>[] = [
    {
      name: 'Indie',
      icon: <Repeat className="w-4 h-4" />,
      tagline: 'For solo creators with steady output',
      price: 19,
      credits: 220,
      clips: '~22 / mo',
      interval: 'month',
      features: [
        '1080p HD export',
        'All cinematic engines',
        'Credits roll over 1 month',
        'Email support',
      ],
    },
    {
      name: 'Pro',
      icon: <Crown className="w-4 h-4" />,
      tagline: 'Most loved by working creators',
      price: 49,
      credits: 600,
      clips: '~60 / mo',
      interval: 'month',
      features: [
        '4K Ultra HD (2160p)',
        'Priority render queue',
        'Multi-character dialogue',
        'Brand kit',
        'Priority support',
      ],
      popular: true,
    },
    {
      name: 'Studio',
      icon: <Building2 className="w-4 h-4" />,
      tagline: 'For teams that ship every week',
      price: 149,
      credits: 2000,
      clips: '~200 / mo',
      interval: 'month',
      features: [
        '4K HDR + ProRes export',
        'Up to 5 seats',
        'Top-tier render queue',
        'API access · Webhooks',
        'Account manager',
      ],
    },
  ];
  return list.map((p) => {
    const baseline = p.credits * BASE_RATE;
    const savings = baseline > p.price ? Math.round(((baseline - p.price) / baseline) * 100) : 0;
    return { ...p, segment: 'subscription', savingsPct: savings, ctaLabel: 'Start subscription' };
  });
}

/** Enterprise — single tier + custom contracts */
function buildEnterprise(): CreditPackage[] {
  return [
    {
      name: 'Scale',
      icon: <Users className="w-4 h-4" />,
      tagline: 'Volume contracts for content teams',
      price: 4999,
      credits: 75000,
      clips: '~7.5k',
      features: [
        'Custom credit volume',
        'Unlimited seats · SAML SSO',
        'Dedicated infra & render lanes',
        'Custom data retention',
        'Uptime SLA on request',
        'Named CSM · 24/7 priority',
      ],
      segment: 'enterprise',
      contactSales: true,
      ctaLabel: 'Talk to sales',
    },
    {
      name: 'Custom',
      icon: <Cpu className="w-4 h-4" />,
      tagline: 'Bespoke pipelines & private models',
      price: 0,
      credits: 0,
      clips: 'Unlimited',
      features: [
        'Private model fine-tuning',
        'On-prem / VPC deployment',
        'Bespoke production pipelines',
        'MSA · DPA · custom SLAs',
        'Solutions architect included',
        'Quarterly business reviews',
      ],
      segment: 'enterprise',
      contactSales: true,
      popular: true,
      ctaLabel: 'Request a quote',
    },
    {
      name: 'Government',
      icon: <Lock className="w-4 h-4" />,
      tagline: 'Compliance-grade deployments',
      price: 0,
      credits: 0,
      clips: 'On request',
      features: [
        'Region-locked data residency',
        'SOC 2 · ISO 27001 evidence',
        'PII redaction & audit logs',
        'Air-gapped deployments',
        'Dedicated security review',
      ],
      segment: 'enterprise',
      contactSales: true,
      ctaLabel: 'Contact us',
    },
  ];
}

const SEGMENT_PACKAGES: Record<Segment, CreditPackage[]> = {
  personal: buildPersonal(),
  business: buildBusiness(),
  subscription: buildSubscription(),
  enterprise: buildEnterprise(),
};

const TRUST_POINTS = [
  { icon: <Shield className="w-3.5 h-3.5" />, text: 'Secure via Stripe' },
  { icon: <InfinityIcon className="w-3.5 h-3.5" />, text: 'Credits never expire' },
  { icon: <Film className="w-3.5 h-3.5" />, text: 'Kling V3 + Seedance Pro' },
  { icon: <Star className="w-3.5 h-3.5" />, text: 'Zero-waste guarantee' },
];

const SEGMENT_META: Record<Segment, {
  label: string;
  icon: React.ReactNode;
  kicker: string;
  headline: string;
  highlight: string;
  blurb: string;
}> = {
  personal: {
    label: 'Personal',
    icon: <User className="w-3.5 h-3.5" />,
    kicker: 'For Creators',
    headline: 'Pay only for',
    highlight: 'what you ship.',
    blurb: 'Top up credits when you need them. No subscriptions, no expirations, no waste.',
  },
  business: {
    label: 'Business',
    icon: <Briefcase className="w-3.5 h-3.5" />,
    kicker: 'For Teams',
    headline: 'A studio that scales',
    highlight: 'with your roadmap.',
    blurb: 'Seats, brand controls, and account management for content teams shipping every week.',
  },
  subscription: {
    label: 'Subscription',
    icon: <Repeat className="w-3.5 h-3.5" />,
    kicker: 'Predictable billing',
    headline: 'Steady credits,',
    highlight: 'every month.',
    blurb: 'Lock in monthly volume and save versus pay-as-you-go. Cancel or change tier anytime.',
  },
  enterprise: {
    label: 'Enterprise',
    icon: <Building2 className="w-3.5 h-3.5" />,
    kicker: 'For Organizations',
    headline: 'Built for security,',
    highlight: 'scale, and SLAs.',
    blurb: 'Custom contracts, SSO, dedicated infrastructure and white-glove onboarding for global teams.',
  },
};

/** Feature matrix — what's included across the four tracks */
const MATRIX_ROWS: { label: string; values: Record<Segment, string | boolean> }[] = [
  { label: 'Pricing model', values: { personal: 'Pay-as-you-go', business: 'Volume packs', subscription: 'Monthly billing', enterprise: 'Custom contract' } },
  { label: 'Resolution', values: { personal: 'Up to 4K', business: 'Up to 4K HDR + ProRes', subscription: 'Up to 4K', enterprise: 'Custom · Master files' } },
  { label: 'Render priority', values: { personal: 'Standard', business: 'Top-tier', subscription: 'Priority', enterprise: 'Dedicated lane' } },
  { label: 'Seats', values: { personal: '1', business: 'Up to unlimited', subscription: 'Up to 5', enterprise: 'Unlimited + SSO' } },
  { label: 'API access', values: { personal: false, business: true, subscription: true, enterprise: true } },
  { label: 'Brand kit', values: { personal: false, business: true, subscription: true, enterprise: true } },
  { label: 'SAML SSO', values: { personal: false, business: 'Optional', subscription: false, enterprise: true } },
  { label: 'SOC 2 evidence', values: { personal: false, business: 'On request', subscription: false, enterprise: true } },
  { label: 'Account manager', values: { personal: false, business: true, subscription: 'Pro & up', enterprise: 'Named CSM' } },
  { label: 'Support SLA', values: { personal: 'Email', business: 'Priority Slack', subscription: 'Priority email', enterprise: '24/7 · 99.9%' } },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do credits work?',
    a: '1 credit = $0.10. Most finished clips cost ~10 credits depending on duration, resolution and engine. Personal credits never expire.',
  },
  {
    q: 'Can I switch between subscription and pay-as-you-go?',
    a: 'Yes. You can run both at once — your subscription tops up monthly, and one-time packs stack on top whenever you need a burst of capacity.',
  },
  {
    q: 'What happens to unused subscription credits?',
    a: 'Subscription credits roll over for one billing cycle. One-time credit packs (Personal & Business) never expire.',
  },
  {
    q: 'Do you offer team seats?',
    a: 'Business plans include 5–unlimited seats with brand kits and shared assets. Enterprise adds SAML SSO and granular role management.',
  },
  {
    q: 'How does Enterprise pricing work?',
    a: 'Enterprise contracts are custom — talk to sales for volume discounts, dedicated infrastructure, on-prem / VPC deployment, and bespoke SLAs.',
  },
  {
    q: 'Is my payment secure?',
    a: 'All payments are processed by Stripe. We never see or store card numbers. Refund disputes are handled per Stripe policy.',
  },
];

/**
 * CreditDial — animated luminous ring showing credit volume.
 * Pro-Dark, blue accent, conic-gradient progress against deep glass core.
 */
function CreditDial({ credits, clips, popular }: { credits: number; clips: string; popular?: boolean }) {
  // Map credits (90..75000) onto a 0..1 fill ratio (logarithmic for elegance)
  const min = Math.log(90), max = Math.log(75000);
  const safe = Math.max(credits, 90);
  const ratio = Math.min(1, Math.max(0.18, (Math.log(safe) - min) / (max - min)));
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
        <span className="font-display font-semibold text-foreground text-[28px] tabular-nums tracking-tight leading-none">
          {credits === 0 ? '∞' : credits >= 1000 ? `${(credits / 1000).toFixed(credits % 1000 === 0 ? 0 : 1)}k` : credits}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.28em] text-foreground/80 font-medium">credits</span>
        <div className="w-7 h-px bg-glass-active my-2" />
        <span className="text-[10px] text-muted-foreground tabular-nums">{clips} clips</span>
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
  const isContact = !!pkg.contactSales;
  const isCustom = pkg.price === 0;

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
                : 'bg-glass-hover border-white/[0.08] text-muted-foreground',
            )}
          >
            {pkg.icon}
          </div>
          {isContact ? (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/[0.10] bg-glass-hover">
              Custom contract
            </div>
          ) : pkg.interval ? (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--primary))] inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)]">
              Monthly
            </div>
          ) : pkg.savingsPct && pkg.savingsPct > 0 ? (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--success))] inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)]">
              Save {pkg.savingsPct}%
            </div>
          ) : (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/[0.06] bg-glass">
              Pay-as-you-go
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-semibold text-foreground text-[22px] tracking-tight leading-none mb-2">
          {pkg.name}
        </h3>
        <p className="text-[12px] text-muted-foreground mb-6 leading-relaxed">{pkg.tagline}</p>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-7">
          {isCustom ? (
            <span className="font-display font-semibold text-foreground text-[42px] leading-none tracking-[-0.03em]">
              Custom
            </span>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground font-medium">$</span>
              <span className="font-display font-semibold text-foreground text-[52px] leading-none tabular-nums tracking-[-0.03em]">
                {pkg.price.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">
                {pkg.interval ? `/ ${pkg.interval}` : 'one-time'}
              </span>
            </>
          )}
        </div>

        {/* Credit Dial */}
        {!isCustom && (
          <div className="mb-7">
            <CreditDial credits={pkg.credits} clips={pkg.clips} popular={pkg.popular} />
          </div>
        )}

        {/* Per-credit micro-rate */}
        {!isCustom && pkg.credits > 0 && (
          <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <Wand2 className="w-3 h-3" />
            <span className="tabular-nums">${(pkg.price / pkg.credits).toFixed(3)}</span>
            <span>/ credit{pkg.interval ? ` · ${pkg.clips}` : ''}</span>
          </div>
        )}

        {/* Hairline divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-7" />

        {/* Feature list */}
        <ul className="space-y-2.5 mb-7 min-h-[148px]">
          {pkg.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[12.5px] text-muted-foreground leading-snug">
              <Check className={cn('w-3.5 h-3.5 mt-[3px] shrink-0', pkg.popular ? 'text-[hsl(var(--primary))]' : 'text-muted-foreground')} />
              <span>{f}</span>
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
              : 'bg-glass-hover hover:bg-white/[0.09] text-foreground/90 border border-white/[0.08] hover:border-white/[0.16]',
          )}
        >
          {/* Shimmer */}
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
            style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)' }}
          />
          <span className="relative inline-flex items-center justify-center gap-1.5">
            {pkg.ctaLabel ?? `Get ${pkg.credits >= 1000 ? pkg.credits.toLocaleString() : pkg.credits} credits`}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </span>
        </Button>
      </div>
    </motion.div>
  );
}

function MatrixCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-4 h-4 text-[hsl(var(--primary))] mx-auto" />;
  if (value === false) return <span className="text-muted-foreground">—</span>;
  return <span className="text-[12px] text-muted-foreground">{value}</span>;
}

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-2xl border border-white/[0.06] bg-glass hover:bg-glass-hover hover:border-white/[0.12] transition-all px-5 py-4"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] font-medium text-foreground/90">{q}</span>
        <ChevronDown
          className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')}
        />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-[13px] text-muted-foreground leading-relaxed overflow-hidden"
          >
            {a}
          </motion.p>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function Pricing() {
  usePageMeta({ title: "Pricing — Small Bridges", description: "Pay-as-you-go credits at $0.10 each. No subscriptions, no expirations. Generate cinematic video on demand." });

  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [segment, setSegment] = useState<Segment>('personal');

  const meta = SEGMENT_META[segment];
  const packages = useMemo(() => SEGMENT_PACKAGES[segment], [segment]);

  const handlePurchase = (pkg: CreditPackage) => {
    const slug = (pkg.name || '').toLowerCase();
    if (pkg.contactSales) {
      navigate(`/contact?topic=sales&plan=${slug}`);
      return;
    }
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
          <Link to="/" className="font-display font-semibold text-lg text-foreground tracking-tight">
            Small Bridges
          </Link>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="h-9 rounded-full bg-glass-hover hover:bg-white/[0.09] text-foreground/85 text-[13px] border border-white/[0.08] backdrop-blur-md"
          >
            Sign Up
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-2 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div key={segment} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {/* Status pill */}
            <div className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full border border-white/[0.07] bg-glass backdrop-blur-md mb-7">
              <span className="text-[hsl(var(--primary))]">{meta.icon}</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                {meta.kicker}
              </span>
            </div>

            <h1 className="font-display font-semibold tracking-[-0.03em] text-[44px] sm:text-[64px] leading-[1.02] text-foreground">
              {meta.headline}{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(110deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 55%, hsl(var(--foreground)) 100%)',
                }}
              >
                {meta.highlight}
              </span>
            </h1>
            <p className="text-[15px] text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
              {meta.blurb} <span className="text-muted-foreground tabular-nums">1 credit = $0.10</span>.
            </p>

            {/* Diagnostic ticker — signature */}
            <div className="mt-8 inline-flex items-center gap-5 text-[10px] uppercase tracking-[0.32em] text-foreground/80 font-medium">
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

          {/* Segment switcher */}
          <div className="mt-10 flex justify-center">
            <div
              role="tablist"
              aria-label="Pricing audience"
              className="inline-flex items-center gap-1 p-1 rounded-full border border-white/[0.07] bg-glass backdrop-blur-xl"
            >
              {(Object.keys(SEGMENT_META) as Segment[]).map((seg) => {
                const m = SEGMENT_META[seg];
                const active = segment === seg;
                return (
                  <button
                    key={seg}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSegment(seg)}
                    className={cn(
                      'relative h-9 px-4 sm:px-5 inline-flex items-center gap-2 rounded-full text-[12px] font-medium tracking-tight transition-all',
                      active
                        ? 'text-black bg-white shadow-[0_8px_24px_-8px_hsla(0,0%,100%,0.35),inset_0_1px_0_hsla(0,0%,100%,0.6)]'
                        : 'text-muted-foreground hover:text-foreground/90',
                    )}
                  >
                    <span className={cn(active ? 'text-black/70' : 'text-[hsl(var(--primary))]')}>
                      {m.icon}
                    </span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="relative z-10 pt-14 pb-10 px-6">
        <div
          className={cn(
            'max-w-6xl mx-auto grid grid-cols-1 gap-6 items-start',
            packages.length === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
            packages.length === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
          )}
        >
          <AnimatePresence mode="wait">
            {packages.map((pkg, i) => (
              <PricingCard key={`${segment}-${pkg.name}`} pkg={pkg} index={i} onPurchase={handlePurchase} />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Trust */}
      <section className="relative z-10 py-10 px-6">
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-md px-6 py-5">
          <div className="flex items-center justify-center gap-x-8 gap-y-3 flex-wrap">
            {TRUST_POINTS.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <span className="text-[hsl(var(--primary))]">{p.icon}</span>
                <span className="text-[12px] font-medium">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison matrix */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/[0.07] bg-glass backdrop-blur-md mb-5">
              <FileCheck2 className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Compare</span>
            </div>
            <h2 className="font-display font-semibold tracking-[-0.03em] text-[32px] md:text-[44px] leading-tight text-foreground">
              Every tier, side by side.
            </h2>
            <p className="text-muted-foreground mt-3 text-[14px]">Find the track that fits — switch anytime.</p>
          </div>

          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-md overflow-hidden">
            <div className="grid grid-cols-5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground px-5 py-4 border-b border-white/[0.06] bg-glass">
              <div className="font-medium">Feature</div>
              {(Object.keys(SEGMENT_META) as Segment[]).map((seg) => (
                <div key={seg} className="text-center font-medium text-muted-foreground">
                  {SEGMENT_META[seg].label}
                </div>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {MATRIX_ROWS.map((row) => (
                <div key={row.label} className="grid grid-cols-5 items-center px-5 py-3.5 hover:bg-glass transition-colors">
                  <div className="text-[13px] text-muted-foreground font-medium">{row.label}</div>
                  {(Object.keys(SEGMENT_META) as Segment[]).map((seg) => (
                    <div key={seg} className="text-center">
                      <MatrixCell value={row.values[seg]} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise contact strip */}
      <section className="relative z-10 py-14 px-6">
        <div className="max-w-5xl mx-auto rounded-3xl border border-[hsl(var(--primary)/0.18)] bg-gradient-to-br from-[hsl(220_14%_5%/0.85)] to-[hsl(220_14%_2%/0.95)] backdrop-blur-2xl px-8 md:px-12 py-10 md:py-12 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-32 -right-24 w-96 h-96 rounded-full blur-3xl opacity-60"
            style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.28), transparent 70%)' }}
          />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/[0.08] bg-glass-hover mb-4">
                <Globe className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">Enterprise</span>
              </div>
              <h3 className="font-display font-semibold text-foreground text-[26px] md:text-[34px] tracking-[-0.025em] leading-tight">
                Need volume, SSO and a contract?
              </h3>
              <p className="text-muted-foreground mt-3 text-[14px] leading-relaxed">
                Talk to sales for custom credit volumes, dedicated infrastructure, security review, MSAs and DPAs — typically priced from $50k/year.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-3 shrink-0">
              <Button
                onClick={() => navigate('/contact?topic=sales')}
                className="h-12 px-6 rounded-full text-[13px] font-semibold text-black bg-white hover:bg-white/90 shadow-[0_12px_40px_-12px_hsla(0,0%,100%,0.35),inset_0_1px_0_hsla(0,0%,100%,0.6)]"
              >
                <Phone className="w-4 h-4 mr-2" />
                Talk to sales
              </Button>
              <Button
                onClick={() => setSegment('enterprise')}
                className="h-12 px-6 rounded-full text-[13px] font-medium text-foreground/90 bg-glass-hover hover:bg-white/[0.09] border border-white/[0.10]"
              >
                See enterprise tiers
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/[0.07] bg-glass backdrop-blur-md mb-5">
              <Headphones className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">FAQ</span>
            </div>
            <h2 className="font-display font-semibold tracking-[-0.03em] text-[32px] md:text-[44px] leading-tight text-foreground">
              Questions, answered.
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
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
          <h2 className="font-display font-semibold tracking-[-0.03em] text-[32px] md:text-[42px] leading-tight text-foreground mb-4">
            Pick a pack. Start rendering.
          </h2>
          <p className="text-muted-foreground mb-8 text-[14px]">
            Credits don't expire. Pay only for what you generate.
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
        <Link to="/" className="text-[12px] text-muted-foreground hover:text-foreground/80 transition-colors">
          ← Back to home
        </Link>
      </div>

      {/* In-page checkout for authed users */}
      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
}
