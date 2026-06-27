/**
 * WelcomeCheckout — post-signup landing during the launch period.
 *
 * Previously this page opened embedded Stripe checkout. While Small Bridges is
 * at launch the user simply lands here after signup; no free credits are granted
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
    description: 'Welcome to Small Bridges. Your first 5-second video is on us.',
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
          className="!border-0 !bg-none"
          eyebrow="No card · no checkout"
          title={<>Welcome to Small Bridges.</>}
          body={
            <>
              You&rsquo;re in. Your{' '}
              <span className="text-emerald-300 font-mono">first 5-second video is free</span>
              {' '}— generated on the Wan model, no card needed. Jump into the studio and make your first scene.
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
          After your free first video, credits are pay-as-you-go — you only pay for what you successfully render, and failed renders are refunded automatically.
        </p>
      </motion.div>
    </div>
  );
}
