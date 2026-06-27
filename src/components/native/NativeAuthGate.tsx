/**
 * NativeAuthGate — the phone app MUST require sign-in. Anywhere in the native
 * app (or the ?shell=mobile preview), an unauthenticated visitor is bounced to
 * /auth and cannot reach any app screen until they sign in.
 *
 * Web (the marketing site) is unaffected — this only acts when IS_MOBILE_SHELL.
 * It waits for auth to resolve first (so a slow/transient session check never
 * locks a real signed-in user out), and lets the auth/reset routes through.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { IS_MOBILE_SHELL } from '@/lib/native';

// Routes a signed-out user is allowed to see (the sign-in / recovery flow).
const PUBLIC = ['/auth', '/forgot-password', '/reset-password'];

export function NativeAuthGate() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!IS_MOBILE_SHELL) return;          // only the phone app / mobile preview
    if (loading) return;                    // wait for the session check to finish
    if (user) return;                       // signed in → full access
    const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (!isPublic) navigate('/auth', { replace: true });
  }, [user, loading, pathname, navigate]);

  return null;
}
