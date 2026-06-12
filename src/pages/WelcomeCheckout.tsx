/**
 * WelcomeCheckout — post-signup landing during the free-beta period.
 *
 * Previously this page opened embedded Stripe checkout. While Small Bridges is
 * in beta there's nothing to pay — the user is granted a starter credit
 * balance (by a DB trigger on profile insert) and we just welcome them
 * and route them into the studio.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BetaHero } from '@/components/ui/BetaHero';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';

export default function WelcomeCheckout() {
  usePageMeta({
    title: 'Welcome — Small Bridges',
    description: 'Small Bridges is free during beta. Your starter credits are ready.',
  });
  const { profile } = useAuth();
  const { navigate } = useSafeNavigation();
  const [countdown, setCountdown] = useState(5);

  // Auto-route into the studio after a brief celebration moment so the user
  // never lands here and gets stuck. We keep a manual button too.
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          navigate('/create?welcome=1', { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [navigate]);

  const starterCredits = profile?.credits_balance ?? 0;

  return (
    <div className="min-h-screen flex items-center justify-center text-white px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl"
      >
        <BetaHero
          eyebrow="No card · no checkout"
          title={<>Welcome to Small Bridges.</>}
          body={
            <>
              You&rsquo;re in. Small Bridges is free while we&rsquo;re in beta — no card needed, no surprise fees. We&rsquo;ve seeded your account with{' '}
              <span className="text-emerald-300 font-mono">{starterCredits.toLocaleString()}</span>{' '}
              starter credits so you can generate your first scenes immediately.
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-4">
              <PrimaryCTA
                size="lg"
                onClick={() => navigate('/create?welcome=1', { replace: true })}
                trailingIcon={ArrowRight}
              >
                Open the studio
              </PrimaryCTA>
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/35">
                Auto-launching in {countdown}…
              </span>
            </div>
          }
        />

        <p className="mt-8 text-[11px] text-white/35 leading-relaxed text-center">
          When paid plans launch we&rsquo;ll email you well in advance with what changes (and what stays free). Your in-beta work stays yours.
        </p>
      </motion.div>
    </div>
  );
}
