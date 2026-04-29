import { memo, forwardRef } from 'react';
import { Users, Sparkles, UserCircle2, Video } from 'lucide-react';
import { PremiumPageHero, type HeroStat } from '@/components/premium/PremiumPageHero';

interface AvatarsHeroProps {
  totalCount?: number;
  realisticCount?: number;
  animatedCount?: number;
  voiceCount?: number;
}

/**
 * AvatarsHero — Pro-Dark editorial hero matching the Projects page standard.
 * Replaces the legacy violet/fuchsia hero (which violated the no-purple core rule).
 */
export const AvatarsHero = memo(forwardRef<HTMLElement, AvatarsHeroProps>(function AvatarsHero(
  { totalCount = 0, realisticCount, animatedCount, voiceCount },
  ref,
) {
  const stats: HeroStat[] = [
    { label: 'Presenters', value: totalCount, icon: Users, accent: 'text-white' },
    { label: 'Photoreal', value: realisticCount ?? '—', icon: UserCircle2, accent: 'text-[hsl(var(--primary))]' },
    { label: 'Animated', value: animatedCount ?? '—', icon: Sparkles, accent: 'text-white/85' },
    { label: 'Voices', value: voiceCount ?? '6', icon: Video, accent: 'text-white/85' },
  ];

  return (
    <section ref={ref} className="relative pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <PremiumPageHero
        eyebrow="Cast · Live"
        titlePrefix="Choose your"
        titleHighlight="presenter"
        titleSuffix="."
        description="Select a photorealistic or animated avatar to lead your next cinematic story. Voice, motion, and identity locked end-to-end."
        stats={stats}
      />
    </section>
  );
}));

AvatarsHero.displayName = 'AvatarsHero';

export default AvatarsHero;
