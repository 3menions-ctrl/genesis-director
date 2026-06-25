/**
 * MobileOnboardingGate — first-run redirect for the native shell.
 *
 * When a signed-in user hasn't completed onboarding, send them to /welcome
 * (once). Inert on web and on the auth/welcome/onboarding routes themselves.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IS_MOBILE_SHELL } from '@/lib/native';
import { useAuth } from '@/contexts/AuthContext';

const SKIP = ['/welcome', '/auth', '/onboarding'];

export function MobileOnboardingGate() {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!IS_MOBILE_SHELL || !user || !profile) return;
    if (profile.onboarding_completed) return;
    if (SKIP.some((p) => pathname.startsWith(p))) return;
    navigate('/welcome', { replace: true });
  }, [user, profile, pathname, navigate]);

  return null;
}
