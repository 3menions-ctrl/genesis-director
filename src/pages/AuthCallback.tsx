import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigationWithLoading } from '@/components/navigation';
import { toast } from 'sonner';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

import { usePageMeta } from '@/hooks/usePageMeta';
/**
 * AuthCallback - Handles email confirmation, magic-link sign-in, and password recovery.
 *
 * This page processes:
 * - Email confirmation links   (type=signup, type=email_change)
 * - Password reset links       (type=recovery)
 * - Magic link logins          (type=magiclink)
 *
 * OAuth was removed — the app uses email-based auth only.
 */
export default function AuthCallback() {
  usePageMeta({ title: "Signing in — Small Bridges", description: "Completing your Small Bridges sign-in." });

  const { navigate } = useSafeNavigation();
  // Plain react-router navigate — bypasses the safe-nav coordinator, which
  // can silently reject a follow-up navigation while it's still unlocking
  // from the original email-link click. Used for the recovery → reset
  // redirect so the user never gets stranded on the success card.
  const hardNavigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { navigateTo } = useNavigationWithLoading();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase delivers the verification payload in one of THREE shapes
        // depending on the email-template version and provider settings.
        // We accept any of them so users don't 404 mid-flow:
        //
        //   1) Hash fragment:    #access_token=...&refresh_token=...&type=signup
        //      (Supabase v2 email templates — session arrives ready-made.)
        //   2) Query token_hash: ?token_hash=...&type=signup
        //      (Supabase v3 default.)
        //   3) Legacy query:     ?token=...&type=signup
        //      (Older email templates / some external IdP redirects.)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const tokenHash = searchParams.get('token_hash') ?? searchParams.get('token');
        const error = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        if (error) {
          console.error('[AuthCallback] Auth error:', error, errorDescription);
          setStatus('error');
          setMessage(errorDescription || 'Sign-in failed. Please try again.');
          return;
        }

        // Magic-link / email-confirmation paths that arrive with tokens in the
        // URL hash get exchanged for a Supabase session, then the user is
        // routed to /projects (or /reset-password for recovery).
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            setStatus('error');
            setMessage('Could not finish sign-in. Please try again.');
            return;
          }
          setStatus('success');
          const next = searchParams.get('next');
          if (type === 'recovery') {
            // Recovery flows should land on the reset form immediately —
            // no setTimeout, no coordinator. The toast is the only feedback.
            toast.success('Email verified. Set your new password.');
            hardNavigate(next || '/reset-password', { replace: true });
          } else if (next) {
            setMessage('Signed in!');
            toast.success('Welcome to Small Bridges');
            setTimeout(() => navigate(next, { replace: true }), 1200);
          } else {
            setMessage('Signed in!');
            toast.success('Welcome to Small Bridges');
            setTimeout(() => navigateTo('/projects'), 1200);
          }
          return;
        }

        // Handle email confirmation (token_hash in URL)
        if (tokenHash && type) {
          console.log('[AuthCallback] Processing email verification, type:', type);
          setMessage('Confirming your email...');
          
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'email_change' | 'recovery' | 'magiclink',
          });

          if (verifyError) {
            console.error('[AuthCallback] Verification error:', verifyError);
            setStatus('error');
            
            if (verifyError.message.includes('expired')) {
              setMessage('This link has expired. Please request a new confirmation email.');
            } else if (verifyError.message.includes('already') || verifyError.message.includes('confirmed')) {
              // Email already confirmed - this is actually success
              setStatus('success');
              setMessage('Email already confirmed! You can now sign in.');
              setTimeout(() => navigate('/auth', { replace: true }), 2000);
              return;
            } else {
              setMessage('Verification failed. Please try again.');
            }
            return;
          }

          setStatus('success');
          
          // Track signup analytics for email-verified users
          try {
            const { data: { session: verifiedSession } } = await supabase.auth.getSession();
            if (verifiedSession?.user) {
              await supabase.functions.invoke('track-signup', {
                body: {
                  user_id: verifiedSession.user.id,
                  utm_source: searchParams.get('utm_source'),
                  utm_medium: searchParams.get('utm_medium'),
                  utm_campaign: searchParams.get('utm_campaign'),
                  referrer: document.referrer || null,
                },
              });
            }
          } catch {
            console.warn('[AuthCallback] trackSignup failed');
          }

          const next = searchParams.get('next');
          if (type === 'recovery') {
            // Recovery flows redirect immediately — same reason as above.
            toast.success('Email verified! Set your new password.');
            hardNavigate(next || '/reset-password', { replace: true });
          } else if (next) {
            setMessage('Signed in!');
            toast.success('Welcome to Small Bridges');
            setTimeout(() => navigate(next, { replace: true }), 1500);
          } else {
            setMessage('Email confirmed! You can now sign in.');
            toast.success('Email confirmed! Please sign in to continue.');
            setTimeout(() => navigate('/auth', { replace: true }), 2000);
          }
          return;
        }

        // Supabase v3 PKCE flow — the email link delivers the user to the
        // redirect URL with `?code=…`. Exchange the code for a session.
        const pkceCode = searchParams.get('code');
        if (pkceCode) {
          setMessage('Completing sign-in…');
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(pkceCode);
          if (codeErr) {
            console.error('[AuthCallback] code exchange failed', codeErr);
            setStatus('error');
            setMessage(
              codeErr.message.toLowerCase().includes('expired')
                ? 'This link has expired. Please request a new one.'
                : 'Could not finish sign-in. Please try again.'
            );
            return;
          }
          setStatus('success');
          const next = searchParams.get('next');
          // Default destination depends on intent — recovery codes always go
          // to /reset-password unless an explicit `next` is supplied.
          const dest = next || (type === 'recovery' ? '/reset-password' : '/projects');
          setMessage(type === 'recovery' ? 'Set a new password to continue.' : 'Signed in!');
          if (type === 'recovery' || next === '/reset-password') {
            toast.success('Set a new password.');
            hardNavigate(dest, { replace: true });
          } else {
            setTimeout(() => navigate(dest, { replace: true }), 1200);
          }
          return;
        }

        // Check if we already have a session (user refreshed page after callback)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus('success');
          setMessage('Already signed in! Redirecting...');
          setTimeout(() => navigateTo('/projects'), 1000);
          return;
        }

        // No valid callback parameters found
        console.warn('[AuthCallback] No valid auth parameters found');
        setStatus('error');
        setMessage('Invalid or missing authentication data. Please try again.');
        
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      <div 
        className="fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center p-8 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl max-w-md mx-4">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 text-white animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Processing…
            </h1>
            <p className="text-white/70">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Success!
            </h1>
            <p className="text-white/70 mb-4">{message}</p>
            {/* Safety-net link — if the auto-redirect ever silently fails
                (e.g. a coordinator lock or a slow navigation), the user can
                always finish manually. Visible only on success. */}
            <button
              onClick={() => {
                const next = searchParams.get('next');
                const type = searchParams.get('type')
                  || new URLSearchParams(window.location.hash.substring(1)).get('type');
                hardNavigate(next || (type === 'recovery' ? '/reset-password' : '/projects'), { replace: true });
              }}
              className="text-sm text-white/55 hover:text-white underline underline-offset-4 transition-colors"
            >
              Continue manually →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Verification Failed
            </h1>
            <p className="text-white/70 mb-6">{message}</p>
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="px-6 py-3 bg-white text-black rounded-xl font-semibold hover:bg-white/90 transition-colors"
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
