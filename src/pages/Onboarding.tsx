import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { usePageMeta } from '@/hooks/usePageMeta';

/**
 * Onboarding — landing target after email verification.
 *
 * Behavior:
 *   1. Consume any pending intent token from the /start wizard.
 *   2. Mark onboarding_completed = true unconditionally (Small Bridges is free during
 *      beta — the gating questions live in /start as a courtesy, but the
 *      product itself works the moment auth succeeds).
 *   3. Route to /welcome/checkout (which shows the BETA-FREE welcome card)
 *      so brand-new users see what they got. Returning users skip straight
 *      to /projects.
 *
 * The previous version of this file bounced the user back to /start in a
 * loop when no intent token was present — that's gone.
 */
export default function Onboarding() {
  usePageMeta({
    title: 'Welcome to Small Bridges',
    description: 'Finishing setup for your Small Bridges account.',
  });

  const { user, profile, refreshProfile, loading, isSessionVerified } = useAuth();
  const { navigate } = useSafeNavigation();

  useEffect(() => {
    if (loading || !isSessionVerified) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      // Consume an intent token from /start if one is present.
      let intentToken: string | null = null;
      try {
        intentToken = sessionStorage.getItem('smallbridges.intent_token');
      } catch {}

      let accountType: 'personal' | 'business' | 'enterprise' | undefined;

      if (intentToken) {
        try {
          const { data } = await supabase.rpc('consume_onboarding_intent', {
            p_intent_token: intentToken,
          });
          const r = data as {
            success?: boolean;
            account_type?: 'personal' | 'business' | 'enterprise';
          } | null;
          if (r?.success) accountType = r.account_type;
        } catch (e) {
          console.warn('[Onboarding] intent consume failed', e);
        }
        try {
          sessionStorage.removeItem('smallbridges.intent_token');
        } catch {}
      }

      // Always mark onboarding complete so the user can't get re-trapped in
      // any future redirect that gates on this flag.
      if (profile && !profile.onboarding_completed) {
        try {
          await supabase
            .from('profiles')
            .update({ onboarding_completed: true })
            .eq('id', user.id);
          await refreshProfile();
        } catch (e) {
          console.warn('[Onboarding] mark completed failed', e);
        }
      }

      if (cancelled) return;

      // ?next= takes precedence (sanitized to same-origin).
      const rawNext = new URLSearchParams(window.location.search).get('next');
      const next =
        rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
      if (next) {
        navigate(next, { replace: true });
        return;
      }

      const type =
        accountType ??
        (profile?.account_type as 'personal' | 'business' | 'enterprise' | undefined) ??
        'personal';

      // Brand-new accounts → welcome card. Returning accounts → project list.
      const isBrandNew = (profile?.total_credits_used ?? 0) === 0;

      if (type === 'business' || type === 'enterprise') {
        navigate(isBrandNew ? '/welcome/checkout' : '/workspace', { replace: true });
      } else {
        navigate(isBrandNew ? '/welcome/checkout' : '/projects', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile, loading, isSessionVerified, navigate, refreshProfile]);

  return <CinemaLoader message="Finishing setup..." showProgress progress={85} variant="fullscreen" />;
}
