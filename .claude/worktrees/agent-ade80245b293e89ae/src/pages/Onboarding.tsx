import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

import { usePageMeta } from '@/hooks/usePageMeta';
/**
 * Onboarding (legacy redirect)
 *
 * The full onboarding wizard now lives at `/start` (StartOnboarding.tsx),
 * which captures display name, company, role, industry, team size, brand,
 * use case, plan and invites in a single guided flow.
 *
 * Previously this file rendered a SECOND 5-step wizard that re-asked the
 * same questions after email verification — a bad duplicate experience.
 * It now simply:
 *   1. Consumes any pending intent token (if the user came from /start)
 *   2. Marks onboarding_completed if a profile exists but isn't flagged
 *   3. Forwards the user to their correct landing page (or back to /start
 *      if no prior data exists, so they answer the questions exactly once).
 */
export default function Onboarding() {
  usePageMeta({ title: "Welcome to Apex Studio", description: "Three quick steps to set up your cinematic AI workspace." });

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
      // Try to consume any pending pre-signup intent (the path most users take).
      let token: string | null = null;
      try { token = sessionStorage.getItem('apex.intent_token'); } catch {}

      let accountType: 'personal' | 'business' | 'enterprise' | undefined;
      let planId: string | undefined;
      let planKind: string | undefined;

      if (token) {
        try {
          const { data } = await supabase.rpc('consume_onboarding_intent', {
            p_intent_token: token,
          });
          const r = data as {
            success?: boolean;
            account_type?: 'personal' | 'business' | 'enterprise';
            plan_id?: string;
            plan_kind?: string;
          } | null;
          if (r?.success) {
            accountType = r.account_type;
            planId = r.plan_id;
            planKind = r.plan_kind;
          }
        } catch (e) {
          console.warn('[Onboarding] intent consume failed', e);
        }
        try { sessionStorage.removeItem('apex.intent_token'); } catch {}
      }

      // If the intent was consumed, the RPC already flagged onboarded.
      // Otherwise, if the user has no prior wizard data at all, send them
      // to /start so they answer the questionnaire exactly once.
      const consumedIntent = !!accountType;
      try { await refreshProfile(); } catch {}
      if (!consumedIntent && profile && !profile.onboarding_completed) {
        navigate('/start', { replace: true });
        return;
      }

      if (cancelled) return;

      // Decide where to send the user.
      const next = new URLSearchParams(window.location.search).get('next');
      if (next) { navigate(next, { replace: true }); return; }

      if (planId && planKind && planKind !== 'contact') {
        navigate(`/welcome/checkout?plan=${planId}`, { replace: true });
        return;
      }

      const type =
        accountType ??
        (profile?.account_type as 'personal' | 'business' | 'enterprise' | undefined) ??
        'personal';

      if (type === 'business' || type === 'enterprise') {
        navigate('/workspace/overview', { replace: true });
      } else {
        navigate('/create', { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [user, profile, loading, isSessionVerified, navigate, refreshProfile]);

  return (
    <CinemaLoader
      message="Finishing setup..."
      showProgress
      progress={85}
      variant="fullscreen"
    />
  );
}
