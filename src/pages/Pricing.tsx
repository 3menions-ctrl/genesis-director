/**
 * Pricing — /pricing
 *
 * Restyled to the cinema aesthetic (deep gradient + light-ray backdrop, single
 * blue accent, Fraunces serif, glass surfaces, white CTAs, unified footer) to
 * match the landing, Enter Studio page and footer. All plan data, prices,
 * credit math, the segment switcher, Stripe subscription checkout, contact-sales
 * routing and the credit-buy modal are preserved exactly from the original page.
 */
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Check, ArrowRight, Sparkles, Shield, Zap, Crown, Building2,
  Star, Infinity as InfinityIcon, Film, Wand2, Gem, User, Briefcase,
  Repeat, Headphones, Lock, Users, Globe, Cpu, FileCheck2, Phone,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ACCENT, EASE, Eyebrow } from '@/components/cinema/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { Footer } from '@/components/cinema/Footer';

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
  /** When set, routes the CTA through Stripe's create-plan-checkout
   *  instead of the credit-buy modal. Must match a key in
   *  supabase/functions/create-plan-checkout/PLAN_CATALOG. */
  planLookupKey?: string;
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
      planLookupKey: 'sub_creator_monthly',
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
      planLookupKey: 'sub_pro_monthly',
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
      planLookupKey: 'sub_studio_monthly',
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

const KEYFRAMES = `
@keyframes pr-rays { 0%,100% { transform: translateX(-50%) rotate(-3deg); opacity: .55; } 50% { transform: translateX(-50%) rotate(3deg); opacity: 1; } }
@keyframes pr-tick { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pr-anim { animation: none !important; } }
`;

/** Deep gradient + light-ray page backdrop — matches the Enter Studio page. */
function PricingBackdrop({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#05060a]">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(125% 80% at 50% -12%, #0c1430 0%, #070b1a 40%, #05060a 74%)' }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(90% 60% at 50% 116%, hsl(${ACCENT} / 0.18), transparent 60%)` }} />
      {!reduced && (
        <div
          className="pr-anim absolute left-1/2 top-[-34%] h-[150%] w-[150%]"
          style={{ transformOrigin: '50% 0%', filter: 'blur(24px)', animation: 'pr-rays 28s ease-in-out infinite', background: `conic-gradient(from 180deg at 50% 0%, transparent 0deg, hsl(${ACCENT} / 0.10) 7deg, transparent 16deg, transparent 30deg, hsl(${ACCENT} / 0.06) 40deg, transparent 52deg, transparent 66deg, hsl(${ACCENT} / 0.07) 74deg, transparent 84deg)` }}
        />
      )}
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(120,170,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,170,255,0.06) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(120% 95% at 50% 0%, #000 28%, transparent 72%)', WebkitMaskImage: 'radial-gradient(120% 95% at 50% 0%, #000 28%, transparent 72%)' }} />
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, hsl(${ACCENT} / 0.5), transparent)` }} />
    </div>
  );
}

/**
 * CreditDial — animated luminous ring showing credit volume.
 * Single blue accent, conic-gradient progress against deep glass core.
 */
function CreditDial({ credits, clips, popular }: { credits: number; clips: string; popular?: boolean }) {
  const min = Math.log(90), max = Math.log(75000);
  const safe = Math.max(credits, 90);
  const ratio = Math.min(1, Math.max(0.18, (Math.log(safe) - min) / (max - min)));
  const deg = Math.round(ratio * 360);

  return (
    <div className="relative mx-auto h-[150px] w-[150px]">
      <div
        aria-hidden
        className={cn('absolute -inset-3 rounded-full blur-2xl transition-opacity duration-700', popular ? 'opacity-90' : 'opacity-40 group-hover:opacity-80')}
        style={{ background: `radial-gradient(closest-side, hsl(${ACCENT} / ${popular ? 0.5 : 0.22}), transparent 70%)` }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from -90deg, hsl(${ACCENT}) 0deg, hsl(${ACCENT} / 0.85) ${deg * 0.5}deg, hsl(${ACCENT} / 0.55) ${deg}deg, hsl(0 0% 100% / 0.04) ${deg}deg 360deg)`,
          padding: '2px',
          WebkitMask: 'radial-gradient(circle, transparent 64%, #000 65%)',
          mask: 'radial-gradient(circle, transparent 64%, #000 65%)',
        }}
      />
      <div className="absolute inset-[6px] rounded-full border border-white/[0.06] bg-[radial-gradient(closest-side,#0a0d14,#05070c)] backdrop-blur-xl" />
      <div aria-hidden className="pointer-events-none absolute inset-[6px] rounded-full opacity-60" style={{ background: 'linear-gradient(160deg, hsl(0 0% 100% / 0.06) 0%, transparent 38%)' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums text-white">
          {credits === 0 ? '∞' : credits >= 1000 ? `${(credits / 1000).toFixed(credits % 1000 === 0 ? 0 : 1)}k` : credits}
        </span>
        <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.28em] text-white/70">credits</span>
        <div className="my-2 h-px w-7 bg-white/15" />
        <span className="text-[10px] tabular-nums text-white/45">{clips} clips</span>
      </div>
    </div>
  );
}

function PricingCard({ pkg, index, onPurchase }: { pkg: CreditPackage; index: number; onPurchase: (pkg: CreditPackage) => void }) {
  const isContact = !!pkg.contactSales;
  const isCustom = pkg.price === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.6, delay: 0.05 + index * 0.07, ease: EASE }}
      className={cn('group relative h-full', pkg.popular && 'lg:-mt-3')}
    >
      {/* Popular badge */}
      {pkg.popular && (
        <div className="absolute -top-3.5 left-1/2 z-20 -translate-x-1/2">
          <div className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white" style={{ background: `hsl(${ACCENT} / 0.18)`, boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.55), 0 8px 30px -8px hsl(${ACCENT} / 0.8)` }}>
            <Gem className="h-3 w-3" style={{ color: `hsl(${ACCENT})` }} />
            Most loved
          </div>
        </div>
      )}

      {/* Soft accent halo (popular only) — borderless emphasis */}
      {pkg.popular && (
        <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[40px] opacity-70 blur-3xl" style={{ background: `radial-gradient(closest-side, hsl(${ACCENT} / 0.22), transparent 70%)` }} />
      )}

      <div
        className={cn(
          'relative h-full overflow-hidden rounded-[28px] p-7 pt-9 backdrop-blur-xl transition-colors duration-500 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)]',
          pkg.popular ? 'bg-white/[0.07]' : 'bg-white/[0.04] hover:bg-white/[0.065]',
        )}
        style={pkg.popular ? { boxShadow: `0 44px 120px -44px hsl(${ACCENT} / 0.55)` } : undefined}
      >
        {/* Top-edge specular highlight */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)' }} />
        {/* Corner aurora glow */}
        <div aria-hidden className={cn('pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl transition-opacity duration-700', pkg.popular ? 'opacity-80' : 'opacity-0 group-hover:opacity-50')} style={{ background: `radial-gradient(closest-side, hsl(${ACCENT} / 0.32), transparent 70%)` }} />

        {/* Header row: icon + badge */}
        <div className="relative mb-5 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={pkg.popular ? { background: `hsl(${ACCENT} / 0.18)`, color: `hsl(${ACCENT})` } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }}>
            {pkg.icon}
          </div>
          {isContact ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">Custom contract</div>
          ) : pkg.interval ? (
            <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]" style={{ background: `hsl(${ACCENT} / 0.14)`, color: `hsl(${ACCENT})` }}>Monthly</div>
          ) : pkg.savingsPct && pkg.savingsPct > 0 ? (
            <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]" style={{ background: `hsl(${ACCENT} / 0.14)`, color: `hsl(${ACCENT})` }}>Save {pkg.savingsPct}%</div>
          ) : (
            <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">Pay-as-you-go</div>
          )}
        </div>

        {/* Title + tagline */}
        <h3 className="mb-2 font-display text-[22px] font-semibold leading-none tracking-tight text-white">{pkg.name}</h3>
        <p className="mb-6 text-[12px] leading-relaxed text-white/50">{pkg.tagline}</p>

        {/* Price */}
        <div className="mb-7 flex items-baseline gap-2">
          {isCustom ? (
            <span className="font-display text-[42px] font-semibold leading-none tracking-[-0.03em] text-white">Custom</span>
          ) : (
            <>
              <span className="text-[11px] font-medium text-white/45">$</span>
              <span className="font-display text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{pkg.price.toLocaleString()}</span>
              <span className="ml-1 text-[11px] text-white/45">{pkg.interval ? `/ ${pkg.interval}` : 'one-time'}</span>
            </>
          )}
        </div>

        {/* Credit Dial */}
        {!isCustom && <div className="mb-7"><CreditDial credits={pkg.credits} clips={pkg.clips} popular={pkg.popular} /></div>}

        {/* Per-credit micro-rate */}
        {!isCustom && pkg.credits > 0 && (
          <div className="mb-6 flex items-center justify-center gap-1.5 text-[10px] text-white/45">
            <Wand2 className="h-3 w-3" />
            <span className="tabular-nums">${(pkg.price / pkg.credits).toFixed(3)}</span>
            <span>/ credit{pkg.interval ? ` · ${pkg.clips}` : ''}</span>
          </div>
        )}

        {/* Divider */}
        <div className="mb-7 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

        {/* Features */}
        <ul className="mb-7 min-h-[148px] space-y-2.5">
          {pkg.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-white/60">
              <Check className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${ACCENT})` }} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onPurchase(pkg)}
          className={cn(
            'group/btn relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-2xl text-[13px] font-semibold transition-colors duration-300',
            pkg.popular ? 'bg-white text-[#0a0b0e] hover:bg-white/90' : 'bg-white/[0.07] text-white hover:bg-white/[0.12]',
          )}
          style={pkg.popular ? { boxShadow: `0 14px 44px -14px hsl(${ACCENT} / 0.9)` } : undefined}
        >
          <span aria-hidden className="absolute inset-0 -translate-x-full transition-transform duration-700 group-hover/btn:translate-x-full" style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)' }} />
          <span className="relative inline-flex items-center justify-center gap-1.5">
            {pkg.ctaLabel ?? `Get ${pkg.credits >= 1000 ? pkg.credits.toLocaleString() : pkg.credits} credits`}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </span>
        </button>
      </div>
    </motion.div>
  );
}

function MatrixCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4" style={{ color: `hsl(${ACCENT})` }} />;
  if (value === false) return <span className="text-white/25">—</span>;
  return <span className="text-[12px] text-white/55">{value}</span>;
}

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-2xl bg-white/[0.03] px-5 py-4 text-left transition-colors hover:bg-white/[0.055]"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] font-medium text-white/90">{q}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/45 transition-transform', open && 'rotate-180')} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden text-[13px] leading-relaxed text-white/55"
          >
            {a}
          </motion.p>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function Pricing() {
  usePageMeta({ title: 'Pricing — Small Bridges', description: 'Pay-as-you-go credits at $0.10 each. No subscriptions, no expirations. Generate cinematic video on demand.' });

  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const reduced = useReducedMotion() ?? false;
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [segment, setSegment] = useState<Segment>('personal');

  const meta = SEGMENT_META[segment];
  const packages = useMemo(() => SEGMENT_PACKAGES[segment], [segment]);

  // PUBLIC MARKETING PAGE — never starts a checkout. All real purchasing
  // (credit packs + subscriptions) happens on the signed-in Credits hub.
  // CTAs send people there, signing them up first when needed.
  const handlePurchase = (pkg: CreditPackage) => {
    const slug = (pkg.name || '').toLowerCase();
    if (pkg.contactSales) {
      navigate(`/contact?topic=sales&plan=${slug}`);
      return;
    }
    if (user) {
      navigate('/credits');
    } else {
      navigate(`/auth?mode=signup&next=${encodeURIComponent('/credits')}`);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const segmentKeys = Object.keys(SEGMENT_META) as Segment[];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-white antialiased">
      <style>{KEYFRAMES}</style>
      <PricingBackdrop reduced={reduced} />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 px-5 pb-2 pt-28 text-center sm:px-8">
        <div className="mx-auto max-w-3xl">
          <motion.div key={segment} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <Eyebrow>{meta.kicker}</Eyebrow>
            <h1 className="mt-4 font-display text-[clamp(2.5rem,7vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.03em] [text-shadow:0_2px_30px_rgba(0,0,0,0.6)]">
              {meta.headline} <span className="italic">{meta.highlight}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] font-light leading-relaxed text-white/65">
              {meta.blurb} <span className="tabular-nums text-white/80">1 credit = $0.10</span>.
            </p>

            {/* Diagnostic ticker */}
            <div className="mt-8 inline-flex items-center gap-5 text-[10px] font-medium uppercase tracking-[0.32em] text-white/75">
              {['Engine', 'Render', 'Stream'].map((t, i) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className="pr-anim h-1 w-1 rounded-full" style={{ background: `hsl(${ACCENT})`, animation: `pr-tick 2.4s ease-in-out ${i * 0.4}s infinite` }} />
                  {t}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Segment switcher */}
          <div className="mt-10 flex justify-center">
            <div role="tablist" aria-label="Pricing audience" className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] p-1 backdrop-blur-xl">
              {segmentKeys.map((seg) => {
                const m = SEGMENT_META[seg];
                const active = segment === seg;
                return (
                  <button
                    key={seg}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSegment(seg)}
                    className={cn(
                      'relative inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-medium tracking-tight transition-colors sm:px-5',
                      active ? 'bg-white text-[#0a0b0e]' : 'text-white/55 hover:text-white',
                    )}
                  >
                    <span style={active ? { color: 'rgba(10,11,14,0.7)' } : { color: `hsl(${ACCENT})` }}>{m.icon}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="relative z-10 px-5 pb-10 pt-14 sm:px-8">
        <div className={cn('mx-auto grid max-w-6xl grid-cols-1 items-start gap-6', packages.length === 4 && 'sm:grid-cols-2 lg:grid-cols-4', packages.length === 3 && 'sm:grid-cols-2 lg:grid-cols-3')}>
          <AnimatePresence mode="wait">
            {packages.map((pkg, i) => (
              <PricingCard key={`${segment}-${pkg.name}`} pkg={pkg} index={i} onPurchase={handlePurchase} />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Trust */}
      <section className="relative z-10 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white/[0.03] px-6 py-5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUST_POINTS.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-white/55">
                <span style={{ color: `hsl(${ACCENT})` }}>{p.icon}</span>
                <span className="text-[12px] font-medium">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison matrix */}
      <section className="relative z-10 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <Eyebrow>Compare</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(2rem,5vw,2.8rem)] font-semibold leading-tight tracking-[-0.03em]">Every tier, side by side.</h2>
            <p className="mt-3 text-[14px] text-white/55">Find the track that fits — switch anytime.</p>
          </div>

          <div className="overflow-hidden rounded-3xl bg-white/[0.03] backdrop-blur-md">
            <div className="grid grid-cols-5 bg-white/[0.04] px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/45">
              <div className="font-medium">Feature</div>
              {segmentKeys.map((seg) => (
                <div key={seg} className="text-center font-medium">{SEGMENT_META[seg].label}</div>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {MATRIX_ROWS.map((row) => (
                <div key={row.label} className="grid grid-cols-5 items-center px-5 py-3.5 transition-colors hover:bg-white/[0.025]">
                  <div className="text-[13px] font-medium text-white/60">{row.label}</div>
                  {segmentKeys.map((seg) => (
                    <div key={seg} className="text-center"><MatrixCell value={row.values[seg]} /></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise contact strip */}
      <section className="relative z-10 px-5 py-14 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white/[0.04] px-8 py-10 backdrop-blur-2xl md:px-12 md:py-12" style={{ boxShadow: `0 40px 120px -50px hsl(${ACCENT} / 0.45)` }}>
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(closest-side, hsl(${ACCENT} / 0.28), transparent 70%)` }} />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <Eyebrow>Enterprise</Eyebrow>
              <h3 className="mt-3 font-display text-[clamp(1.7rem,4vw,2.2rem)] font-semibold leading-tight tracking-[-0.025em]">Need volume, SSO and a contract?</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-white/55">Talk to sales for custom credit volumes, dedicated infrastructure, security review, MSAs and DPAs — typically priced from $50k/year.</p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row">
              <button type="button" onClick={() => navigate('/contact?topic=sales')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[13px] font-semibold text-[#0a0b0e] transition-colors hover:bg-white/90" style={{ boxShadow: `0 14px 44px -14px hsl(${ACCENT} / 0.9)` }}>
                <Phone className="h-4 w-4" /> Talk to sales
              </button>
              <button type="button" onClick={() => setSegment('enterprise')} className="inline-flex h-12 items-center justify-center rounded-full bg-white/[0.07] px-6 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.12]">See enterprise tiers</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(2rem,5vw,2.8rem)] font-semibold leading-tight tracking-[-0.03em]">Questions, answered.</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-5 py-20 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-display text-[clamp(2rem,5vw,2.8rem)] font-semibold leading-tight tracking-[-0.03em]">Pick a pack. Start <span className="italic">rendering</span>.</h2>
          <p className="mb-8 text-[14px] text-white/55">Credits don't expire. Pay only for what you generate.</p>
          <button type="button" onClick={() => navigate('/auth?mode=signup')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[13px] font-semibold text-[#0a0b0e] transition-colors hover:bg-white/90" style={{ boxShadow: `0 18px 50px -16px hsl(${ACCENT} / 0.9)` }}>
            <Sparkles className="h-4 w-4" /> Get started free
          </button>
        </motion.div>
      </section>

      <Footer />

      {/* In-page checkout for authed users */}
      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
}
