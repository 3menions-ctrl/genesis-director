import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useNavigationWithLoading } from '@/components/navigation';
import { toast } from 'sonner';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

/**
 * AuthCallback - Handles email confirmation and OAuth callbacks
 * 
 * This page processes:
 * - Email confirmation links (type=signup, type=email_change)
 * - Password reset links (type=recovery)
 * - Magic link logins (type=magiclink)
 * - OAuth provider redirects
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { navigateTo } = useNavigationWithLoading();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for hash fragment (OAuth flow) or query params (email confirmation)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const tokenHash = searchParams.get('token_hash');
        const error = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        // Handle errors from the auth provider
        if (error) {
          console.error('[AuthCallback] Auth error:', error, errorDescription);
          setStatus('error');
          setMessage(errorDescription || 'Authentication failed. Please try again.');
          return;
        }

        // Handle OAuth callback with tokens in hash
        if (accessToken && refreshToken) {
          console.log('[AuthCallback] Processing OAuth callback');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('[AuthCallback] Session error:', sessionError);
            setStatus('error');
            setMessage('Failed to establish session. Please try again.');
            return;
          }

          setStatus('success');
          setMessage('Successfully signed in!');
          toast.success('Welcome back!');
          
          // Redirect to projects after brief delay
          setTimeout(() => navigateTo('/projects'), 1500);
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
              setMessage(verifyError.message || 'Verification failed. Please try again.');
            }
            return;
          }

          setStatus('success');
          
          if (type === 'recovery') {
            setMessage('Email verified! Redirecting to reset password...');
            toast.success('Email verified! Set your new password.');
            setTimeout(() => navigate('/reset-password', { replace: true }), 1500);
          } else {
            setMessage('Email confirmed! You can now sign in.');
            toast.success('Email confirmed! Please sign in to continue.');
            setTimeout(() => navigate('/auth', { replace: true }), 2000);
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
              Processing...
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
            <p className="text-white/70">{message}</p>
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
