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
  Star, Infinity as InfinityIcon, Film, Gem, User, Briefcase,
  Repeat, Headphones, Globe, FileCheck2,
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
import { VioletBackdrop } from '@/components/marketing/VioletBackdrop';
import { Footer } from '@/components/cinema/Footer';

type Segment = 'personal' | 'business' | 'subscription';

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

const SEGMENT_PACKAGES: Record<Segment, CreditPackage[]> = {
  personal: buildPersonal(),
  business: buildBusiness(),
  subscription: buildSubscription(),
};

const TRUST_POINTS = [
  { icon: <Shield className="w-3.5 h-3.5" />, text: 'Secure checkout via Polar' },
  { icon: <InfinityIcon className="w-3.5 h-3.5" />, text: 'Credits never expire' },
  { icon: <Film className="w-3.5 h-3.5" />, text: 'Kling V3 + Seedance 2.0' },
  { icon: <Star className="w-3.5 h-3.5" />, text: 'Failed renders refunded' },
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
};

/** Feature matrix — what's included across the four tracks */
// Accurate, side-by-side comparison — only facts that are actually true today.
const MATRIX_ROWS: { label: string; values: Record<Segment, string | boolean> }[] = [
  { label: 'Billing', values: { personal: 'Pay-as-you-go', business: 'Volume packs', subscription: 'Monthly' } },
  { label: 'Credits', values: { personal: '90–2,500 / pack', business: '5,500–32,000 / pack', subscription: '220–2,000 / mo' } },
  { label: 'Per-credit price', values: { personal: 'from $0.099', business: 'from $0.078', subscription: 'from $0.075' } },
  { label: 'Credits expiry', values: { personal: 'Never expire', business: 'Never expire', subscription: 'Roll over 1 cycle' } },
  { label: 'Output resolution', values: { personal: 'Up to 4K', business: 'Up to 4K', subscription: 'Up to 4K' } },
  { label: 'Seats', values: { personal: '1', business: 'Team seats', subscription: 'Up to 5' } },
  { label: 'Commitment', values: { personal: 'None · one-time', business: 'None · one-time', subscription: 'Cancel anytime' } },
  { label: 'Best for', values: { personal: 'Solo creators', business: 'Teams & agencies', subscription: 'Weekly shippers' } },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do credits work?',
    a: '1 credit = $0.10 at list price. A finished clip costs roughly 10 credits, varying with duration, resolution and the engine you pick. Buying in larger packs lowers your effective rate to as little as $0.075 per credit. Personal credit packs never expire.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — your first 5-second video is on us. Create an account and render a clip to judge the quality before you buy a single credit.',
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
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. You can cancel or change to a different tier at any time — there is no lock-in. Credits already granted stay in your balance, and unused subscription credits roll over for one billing cycle.',
  },
  {
    q: 'What resolution can I export?',
    a: 'Entry packs (Mini, Starter and Indie) export at 1080p HD. From the Growth, Pro and Studio tiers upward you unlock 4K Ultra HD, and the top business and subscription Studio tiers add 4K HDR and ProRes.',
  },
  {
    q: 'What happens if a render fails?',
    a: 'Failed renders are automatically refunded — you are only charged credits for clips that finish successfully.',
  },
  {
    q: 'Do you offer team seats?',
    a: 'Yes. Business plans scale from 5 seats (Studio) to 15 (Brand) to unlimited (Agency+), with brand kits and shared assets. Agency+ also adds SAML SSO for enterprise security.',
  },
  {
    q: 'Do you offer API access?',
    a: 'Yes. API access is included on the Personal Agency, Business Brand and Subscription Studio tiers, with webhooks on the Brand and Studio plans for programmatic generation.',
  },
  {
    q: 'Is my payment secure?',
    a: 'All payments are processed by Polar, our payment provider. We never see or store card numbers. Refund disputes are handled per Polar policy.',
  },
];

const KEYFRAMES = `
@keyframes pr-rays { 0%,100% { transform: translateX(-50%) rotate(-3deg); opacity: .55; } 50% { transform: translateX(-50%) rotate(3deg); opacity: 1; } }
@keyframes pr-tick { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pr-anim { animation: none !important; } }
`;

/** Premium glossy violet page backdrop (shared with How It Works). The focal
 *  bloom sits behind the recommended plan row to guide the eye. */
function PricingBackdrop() {
  return <VioletBackdrop focal={0.34} />;
}

/**
 * PricingOrb — each tier rendered as a large, glassy circular "orb" with a
 * conic credit-ring rim, arranged in an artsy orbital wave (popular = the big,
 * bright centre). Detailed feature comparison lives in the matrix below.
 */
function PricingOrb({ pkg, index, onPurchase }: { pkg: CreditPackage; index: number; onPurchase: (pkg: CreditPackage) => void }) {
  const isContact = !!pkg.contactSales;
  const isCustom = pkg.price === 0;
  const popular = !!pkg.popular;

  // Credit-volume arc (log-scaled) drawn around the orb's rim.
  const min = Math.log(90), max = Math.log(75000);
  const safe = Math.max(pkg.credits || 90, 90);
  const ratio = Math.min(1, Math.max(0.2, (Math.log(safe) - min) / (max - min)));
  const deg = Math.round(ratio * 360);

  // Desktop (lg) vertical wave — popular stays centred, others alternate.
  const wave = popular ? '' : index % 2 === 0 ? 'lg:translate-y-14' : 'lg:-translate-y-10';
  const size = popular
    ? 'h-[clamp(16.5rem,26vw,26rem)] w-[clamp(16.5rem,26vw,26rem)]'
    : 'h-[clamp(13.5rem,19vw,19rem)] w-[clamp(13.5rem,19vw,19rem)]';

  return (
    <div className={cn('flex shrink-0 flex-col items-center', wave)}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-8%' }}
        transition={{ duration: 0.7, delay: 0.05 + index * 0.08, ease: EASE }}
        className="group relative flex flex-col items-center"
      >
        {/* Most-loved badge */}
        {popular && (
          <div className="absolute -top-3 z-30 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white" style={{ background: `hsl(${ACCENT} / 0.22)`, boxShadow: `inset 0 0 0 1px hsl(${ACCENT} / 0.6), 0 10px 30px -8px hsl(${ACCENT} / 0.9)` }}>
            <Gem className="h-3 w-3" style={{ color: `hsl(${ACCENT})` }} />
            Most loved
          </div>
        )}

        {/* Outer glow */}
        <div aria-hidden className={cn('pointer-events-none absolute -inset-6 rounded-full blur-3xl transition-opacity duration-700', popular ? 'opacity-90' : 'opacity-40 group-hover:opacity-75')} style={{ background: `radial-gradient(closest-side, hsl(${ACCENT} / ${popular ? 0.5 : 0.28}), transparent 70%)` }} />

        {/* The orb */}
        <div
          className={cn('relative flex flex-col items-center justify-center rounded-full text-center transition-transform duration-500 group-hover:-translate-y-1', size)}
          style={{
            background: 'radial-gradient(120% 120% at 50% 20%, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 55%, rgba(10,6,24,0.55))',
            boxShadow: popular
              ? `0 50px 150px -30px hsl(${ACCENT} / 0.7), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -42px 80px -32px hsl(${ACCENT} / 0.6)`
              : `0 40px 110px -42px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -32px 60px -32px hsl(${ACCENT} / 0.42)`,
          }}
        >
          {/* conic credit-ring rim */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from -90deg, hsl(${ACCENT}) 0deg, hsl(${ACCENT} / 0.85) ${deg * 0.5}deg, hsl(${ACCENT} / 0.5) ${deg}deg, hsl(0 0% 100% / 0.06) ${deg}deg 360deg)`,
              padding: '3px',
              WebkitMask: 'radial-gradient(circle, transparent calc(100% - 4px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(circle, transparent calc(100% - 4px), #000 calc(100% - 3px))',
            }}
          />
          <div aria-hidden className="absolute inset-0 rounded-full ring-1 ring-inset ring-[rgba(216,180,254,0.2)]" />

          {/* content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `hsl(${ACCENT})` }}>{pkg.name}</span>
            {isCustom ? (
              <span className="mt-2 font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-none tracking-[-0.03em] text-white">Custom</span>
            ) : (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[14px] font-medium text-white/50">$</span>
                <span className={cn('font-display font-semibold leading-none tracking-[-0.03em] tabular-nums text-white', popular ? 'text-[clamp(3.4rem,7vw,5.2rem)]' : 'text-[clamp(2.6rem,5vw,3.6rem)]')}>{pkg.price.toLocaleString()}</span>
                {pkg.interval && <span className="text-[12px] text-white/45">/{pkg.interval === 'month' ? 'mo' : pkg.interval}</span>}
              </div>
            )}
            {!isCustom && (
              <span className="mt-1.5 text-[13px] tabular-nums text-white/70">{pkg.credits >= 1000 ? pkg.credits.toLocaleString() : pkg.credits} credits</span>
            )}
            {!isCustom && pkg.credits > 0 && (
              <span className="mt-0.5 font-mono text-[10px] tracking-[0.12em] text-white/40">${(pkg.price / pkg.credits).toFixed(3)} / credit</span>
            )}
            {pkg.interval && (
              <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">{pkg.clips} · monthly</span>
            )}
            <button
              type="button"
              onClick={() => onPurchase(pkg)}
              className={cn(
                'mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors',
                popular ? 'bg-white text-[#160a33] hover:bg-white/90' : 'bg-white/[0.08] text-white ring-1 ring-inset ring-white/15 hover:bg-white/[0.14]',
              )}
              style={popular ? { boxShadow: `0 14px 40px -14px hsl(${ACCENT} / 0.9)` } : undefined}
            >
              {isContact ? 'Contact sales' : isCustom ? 'Get in touch' : popular ? `Buy ${pkg.name}` : 'Buy'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* tagline under the orb */}
        <p className="mt-5 max-w-[15rem] text-center text-[12.5px] leading-relaxed text-white/45">{pkg.tagline}</p>
      </motion.div>
    </div>
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
  usePageMeta({ title: 'Pricing — Small Bridges | Credits & Plans', description: 'Simple pricing for cinematic AI video: pay-as-you-go credit packs at $0.10 each, or monthly plans from $19. Your first 5-second video is free.' });

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
      <PricingBackdrop />

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

      {/* Cards — large circular orbs in an artsy orbital wave */}
      <section className="relative z-10 px-5 pb-10 pt-24 sm:px-8 lg:pt-28">
        <div
          key={segment}
          className="mx-auto flex max-w-[84rem] flex-col items-center gap-y-16 md:flex-row md:flex-wrap md:justify-center md:gap-x-8 md:gap-y-24 lg:flex-nowrap lg:gap-x-2"
        >
          {packages.map((pkg, i) => (
            <PricingOrb key={`${segment}-${pkg.name}`} pkg={pkg} index={i} onPurchase={handlePurchase} />
          ))}
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
            <div className="grid grid-cols-4 bg-white/[0.04] px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/45">
              <div className="font-medium">Feature</div>
              {segmentKeys.map((seg) => (
                <div key={seg} className="text-center font-medium">{SEGMENT_META[seg].label}</div>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {MATRIX_ROWS.map((row) => (
                <div key={row.label} className="grid grid-cols-4 items-center px-5 py-3.5 transition-colors hover:bg-white/[0.025]">
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
