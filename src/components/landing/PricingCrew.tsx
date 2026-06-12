/**
 * PricingCrew — pricing as a horizontal production-crew diagram.
 *
 * Three "tiers" rendered as crew sizes — Solo Director, Studio Team,
 * Production House — each with a hand-drawn-style SVG silhouette, the
 * tier name, what's included, credit allocation, and one specific
 * "who-this-is-for" line. No "Most Popular" badge. No comparison
 * checkmarks. No price psychology games.
 *
 * During beta the entire row reads BETA · FREE.
 */

import { useSafeNavigation } from '@/lib/navigation';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';

interface Crew {
  size: 1 | 3 | 7;
  code: string;
  tier: string;
  who: string;
  credits: string;
  priceCurrent: string;
  priceFuture: string;
  includes: readonly string[];
}

const CREWS: readonly Crew[] = [
  {
    size: 1,
    code: 'SOLO',
    tier: 'Solo Director',
    who: 'You have a story you want to test before risking budget.',
    credits: '100 starter credits',
    priceCurrent: 'Free during beta',
    priceFuture: 'will be ~$0 / mo',
    includes: [
      'Full studio access',
      'Cast + Locations + Looks library',
      'Beat-cut editor',
      'Public share pages',
    ],
  },
  {
    size: 3,
    code: 'STDIO',
    tier: 'Studio Team',
    who: 'You ship work weekly with two collaborators and you need versioning.',
    credits: '1,200 monthly credits',
    priceCurrent: 'Free during beta',
    priceFuture: 'will be $49 / mo',
    includes: [
      'Everything in Solo, plus —',
      'Up to 3 seats',
      'Branded export presets',
      'Inline comments + versioning',
    ],
  },
  {
    size: 7,
    code: 'HOUSE',
    tier: 'Production House',
    who: 'You’re running a full production with cinematographer + AD + supervisor.',
    credits: '6,000 monthly credits',
    priceCurrent: 'Free during beta',
    priceFuture: 'will be $299 / mo',
    includes: [
      'Everything in Studio, plus —',
      'Up to 12 seats',
      'Webhooks + API + SSO',
      'Dedicated rendering priority',
    ],
  },
] as const;

export function PricingCrew() {
  const { navigate } = useSafeNavigation();
  return (
    <section className="relative z-10 py-32 lg:py-48 px-6" id="pricing">
      <div className="max-w-[1280px] mx-auto">
        {/* Eyebrow */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">
            The Crew · Three Production Sizes
          </div>
          <h2
            className="font-display text-[36px] sm:text-[52px] lg:text-[64px] font-light text-white leading-[1.05]"
            style={{ fontVariant: 'small-caps' }}
          >
            Pick the crew that fits the scene.
          </h2>
          <p className="text-white/55 text-[14px] sm:text-[16px] max-w-xl mx-auto mt-5 leading-relaxed">
            Small Bridges is free during beta. The crew you join now is the crew you scale into.
          </p>
        </div>

        {/* Crew row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {CREWS.map((c, idx) => (
            <CrewCard key={c.code} crew={c} index={idx} />
          ))}
        </div>

        {/* Tail */}
        <div className="mt-14 text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30 mb-5">
            Small Bridges grows with you. No re-signing. No data migrations.
          </div>
          <PrimaryCTA size="lg" onClick={() => navigate('/start')}>
            Join the crew — free
          </PrimaryCTA>
        </div>
      </div>
    </section>
  );
}

function CrewCard({ crew, index }: { crew: Crew; index: number }) {
  return (
    <div
      className="relative rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.025] to-transparent p-7 lg:p-8 overflow-hidden"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Soft brand glow on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-10 w-[260px] h-[260px] rounded-full opacity-0 hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 65%)',
          filter: 'blur(48px)',
        }}
      />

      <div className="relative">
        {/* Crew silhouette */}
        <CrewSilhouette size={crew.size} />

        {/* Tier code + name */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-brand-light">
            {crew.code}
          </span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <h3
          className="font-display text-[24px] sm:text-[28px] text-white leading-tight"
          style={{ fontVariant: 'small-caps' }}
        >
          {crew.tier}
        </h3>
        <p className="text-white/55 text-[13px] leading-relaxed mt-3 min-h-[3.2rem]">
          {crew.who}
        </p>

        {/* Price */}
        <div className="mt-6 pt-5 border-t border-white/[0.06]">
          <div className="font-display text-[24px] text-emerald-300 leading-tight">
            {crew.priceCurrent}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/30 mt-1">
            {crew.priceFuture}
          </div>
        </div>

        {/* Credits + includes */}
        <div className="mt-5 text-[10px] font-mono uppercase tracking-[0.32em] text-brand-light">
          {crew.credits}
        </div>
        <ul className="mt-3 space-y-2">
          {crew.includes.map((inc) => (
            <li key={inc} className="flex gap-3 text-[13px] text-white/70 leading-relaxed">
              <span aria-hidden className="mt-[7px] w-1 h-1 rounded-full bg-brand shrink-0" />
              {inc}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Hand-drawn-style SVG crew silhouette, scaled by crew size. */
function CrewSilhouette({ size }: { size: 1 | 3 | 7 }) {
  const figures = size === 1 ? 1 : size === 3 ? 3 : 5;
  return (
    <div className="mb-7 h-16 flex items-end gap-1.5 lg:gap-2 text-white/70" aria-hidden>
      {Array.from({ length: figures }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 64"
          className="h-full"
          style={{
            width: 18 - Math.abs(i - Math.floor(figures / 2)) * 1.5,
            opacity: 0.55 + ((figures - Math.abs(i - Math.floor(figures / 2))) / figures) * 0.45,
          }}
        >
          {/* head */}
          <circle cx="12" cy="9" r="5" fill="currentColor" />
          {/* shoulders & body */}
          <path
            d="M 4 64 L 4 32 Q 4 22 12 20 Q 20 22 20 32 L 20 64 Z"
            fill="currentColor"
          />
        </svg>
      ))}
    </div>
  );
}

export default PricingCrew;
