import { useState, useEffect, forwardRef, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Zap, KeyRound, Star, Apple } from 'lucide-react';
import { z } from 'zod';
import { PasswordStrength } from '@/components/ui/password-strength';
import { WelcomeBackDialog } from '@/components/auth/WelcomeBackDialog';
import { useSafeNavigation } from '@/lib/navigation';
import { Logo } from '@/components/ui/Logo';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';
import authHeroImage from '@/assets/auth-hero-mittens.webp';


import { usePageMeta } from '@/hooks/usePageMeta';
// ─── Floating Particles ─────────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 2 + 0.6,
            height: Math.random() * 2 + 0.6,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 2 === 0
              ? 'hsl(212, 100%, 55%)'
              : 'rgba(255,255,255,0.35)',
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0, 0.5, 0],
            scale: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 6 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Orb ───────────────────────────────────────────────────
function AnimatedOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={cn("absolute rounded-full blur-[120px] pointer-events-none", className)}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.15, 0.25, 0.15],
      }}
      transition={{ duration: 8, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

// Validation schemas
const emailSchema = z.string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be less than 72 characters');

const signupPasswordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be less than 72 characters');

const authFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signupFormSchema = z.object({
  email: emailSchema,
  password: signupPasswordSchema,
});

// CRITICAL: forwardRef wrapper to prevent "Function components cannot be given refs" crash
const Auth = forwardRef<HTMLDivElement, Record<string, never>>(function Auth(_props, ref) {
  const internalRef = useRef<HTMLDivElement>(null);
  usePageMeta({ title: "Sign in — Small Bridges", description: "Sign in or create your Small Bridges account." });

  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    internalRef.current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    }
  }, [ref]);

  const { navigate } = useSafeNavigation();
  const { user, profile, loading: authLoading, isAdmin, signIn, signUp } = useAuth();

  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const fromCreate = searchParams.get('from') === 'create';
  const modeParam = searchParams.get('mode');
  // `next` is sanitized to prevent open-redirects. Only same-origin paths starting
  // with a single `/` are honored; everything else falls back to the default landing.
  const rawNext = searchParams.get('next');
  const nextParam =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : null;

  const [isLogin, setIsLogin] = useState(modeParam !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; terms?: string }>({});
  const [hasRedirected, setHasRedirected] = useState(false);
  const [hasPendingCreation, setHasPendingCreation] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const trackSignup = useCallback(async (userId: string) => {
    try {
      // Wait briefly for session to be fully established in the client
      // This prevents auth-guard rejection when called right after OTP/login
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[Auth] trackSignup: No session available, skipping');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      await supabase.functions.invoke('track-signup', {
        body: {
          user_id: userId,
          utm_source: params.get('utm_source'),
          utm_medium: params.get('utm_medium'),
          utm_campaign: params.get('utm_campaign'),
          referrer: document.referrer || null,
        },
      });
    } catch (err) {
      console.warn('[Auth] trackSignup failed:', err);
    }
  }, []);

  useEffect(() => {
    const pendingData = sessionStorage.getItem('pendingCreation');
    if (pendingData) {
      try {
        const data = JSON.parse(pendingData);
        if (Date.now() - data.timestamp < 60 * 60 * 1000) {
          setHasPendingCreation(true);
        } else {
          sessionStorage.removeItem('pendingCreation');
        }
      } catch {
        sessionStorage.removeItem('pendingCreation');
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (hasRedirected) return;
    if (showWelcomeDialog) return;
    
    if (user && profile) {
      setHasRedirected(true);
      trackSignup(user.id);
      if (!profile.onboarding_completed) {
        // Onboarding finalizes setup and routes to /welcome/checkout (beta) or projects.
        const target = nextParam ? `/onboarding?next=${encodeURIComponent(nextParam)}` : '/onboarding';
        navigate(target, { replace: true });
      } else {
        if (isAdmin) {
          navigate('/admin', { replace: true });
          return;
        }

        // Returning users land on their project library (SaaS convention) —
        // the new-creation path is one click from there. Business accounts
        // land on the Workspace dashboard. Brand-new users land on the
        // welcome card so they can see their starter credits before working.
        const isBusinessAccount =
          profile.account_type === 'business' || profile.account_type === 'enterprise';
        const isBrandNew = (profile.total_credits_used ?? 0) === 0;
        const defaultLanding = isBrandNew
          ? '/welcome/checkout'
          : isBusinessAccount
            ? '/workspace'
            : '/projects';
        navigate(nextParam || defaultLanding, { replace: true });
      }
    }
  }, [user, profile, authLoading, hasRedirected, navigate, showWelcomeDialog, nextParam, isAdmin]);

  const validateForm = (): boolean => {
    const schema = isLogin ? authFormSchema : signupFormSchema;
    const result = schema.safeParse({ email: email.trim(), password });
    
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as 'email' | 'password';
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error('Please check your details and try again.');
      return false;
    }
    
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isLogin && password !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      
      if (isLogin) {
        const { error } = await signIn(trimmedEmail, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else if (error.message.includes('Email not confirmed')) {
            setPendingEmailConfirmation(trimmedEmail);
            toast.error('Your email is not verified yet. Enter the code we sent to verify.');
          } else {
            toast.error('Login failed. Please check your credentials and try again.');
          }
        } else {
          const { data: sessionData } = await supabase.auth.getUser();
          if (sessionData?.user) trackSignup(sessionData.user.id);
          // Only show the "Welcome back" Hoppy dialog to genuinely-returning
          // users — defined as anyone who has consumed credits before. New
          // accounts go straight to the welcome card / projects so the first
          // experience is never a blocking animation.
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('total_credits_used')
            .eq('id', sessionData?.user?.id ?? '')
            .maybeSingle();
          const isReturning = (profileRow?.total_credits_used ?? 0) > 0;
          if (isReturning) {
            setShowWelcomeDialog(true);
          }
        }
      } else {
        const { error } = await signUp(trimmedEmail, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Try logging in instead.');
          } else {
            toast.error('Signup failed. Please try again with a different email.');
          }
        } else {
          setPendingEmailConfirmation(trimmedEmail);
          toast.success('Account created! Check your email to confirm.');
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasNavigatedRef = useRef(false);
  
  const handleWelcomeChoice = useCallback((choice: 'create' | 'explore') => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    
    setShowWelcomeDialog(false);
    setHasRedirected(true);
    if (profile && !profile.onboarding_completed) {
      const target = nextParam ? `/onboarding?next=${encodeURIComponent(nextParam)}` : '/onboarding';
      navigate(target, { replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else {
      navigate(nextParam || (choice === 'create' ? '/create' : '/creators'), { replace: true });
    }
  }, [profile, navigate, nextParam, isAdmin]);

  const formEnter = { opacity: 0, y: 20 };
  const formAnimate = { opacity: 1, y: 0, transition: { duration: 0.5 } };
  const formExit = { opacity: 0, y: -20, transition: { duration: 0.3 } };

  return (
    <>
      <WelcomeBackDialog 
        isOpen={showWelcomeDialog} 
        onChoice={handleWelcomeChoice}
        userName={profile?.display_name?.split(' ')[0]}
      />
      
      <div ref={mergedRef} className="min-h-screen flex relative overflow-hidden">
        {/* Pro-Dark cinematic background */}
        <div className="fixed inset-0 bg-[hsl(220,14%,2%)]" />

        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(900px 600px at 12% -10%, hsla(212, 100%, 50%, 0.10), transparent 60%), radial-gradient(700px 500px at 100% 110%, hsla(212, 100%, 45%, 0.06), transparent 55%)',
          }}
        />
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-[0.07] mix-blend-screen"
          style={{ backgroundImage: `url(${landingAbstractBg})` }}
        />
        {/* Hairline grid */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
        {/* Film grain */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
        {/* Vignette */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)' }}
        />

        {/* Left Side - Hero Image */}
        <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <motion.img 
              src={authHeroImage}
              alt="Small Bridges"
              className="w-full h-full object-cover object-center"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(220,14%,2%)]/30 to-[hsl(220,14%,2%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,14%,2%)]/90 via-transparent to-[hsl(220,14%,2%)]/70" />
            {/* Cinematic letterbox lines */}
            <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
            {/* Right edge hairline */}
            <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />
          </div>
          
          <FloatingParticles />
          
          <div className="relative z-10 p-12 xl:p-16 w-full h-full flex flex-col justify-between">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Logo size="xl" showText textClassName="text-2xl font-display font-semibold tracking-[-0.01em] drop-shadow-lg" />
            </motion.div>
            
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass-hover border border-white/[0.08] backdrop-blur-md mb-6">
                  <span className="w-1 h-1 rounded-full bg-[hsl(212,100%,55%)] shadow-[0_0_8px_hsl(212,100%,55%)]" />
                  <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-white/60">Small Bridges Pro</span>
                </div>
                <h2 className="text-5xl xl:text-7xl font-display font-semibold text-white leading-[0.98] tracking-[-0.035em]">
                  Create.<br />
                  <span className="text-[hsl(212,100%,62%)]">Direct.</span><br />
                  <span className="text-white/25">Produce.</span>
                </h2>
              </motion.div>
              
              <motion.p
                className="text-base text-white/45 max-w-md leading-relaxed font-light"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                AI-powered cinema at the speed of thought. One prompt — minutes of cinematic video.
              </motion.p>
              
              {/* Premium social proof */}
              <motion.div
                className="inline-flex items-center gap-4 pl-3 pr-5 py-2.5 rounded-full bg-white/[0.035] border border-white/[0.07] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
              >
                <div className="flex -space-x-2.5">
                  {[
                    'from-[hsl(212,100%,60%)] to-[hsl(212,100%,42%)]',
                    'from-white/80 to-white/40',
                    'from-[hsl(212,100%,70%)] to-[hsl(212,100%,45%)]',
                    'from-white/60 to-white/20',
                  ].map((gradient, i) => (
                    <motion.div
                      key={i}
                      className={cn(
                        'w-7 h-7 rounded-full bg-gradient-to-br border-2 border-[hsl(220,14%,2%)]',
                        gradient,
                      )}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.1 + i * 0.1, type: 'spring', stiffness: 300 }}
                    />
                  ))}
                </div>
                <div>
                  <span className="text-[13px] text-white/80 font-medium tracking-tight tabular-nums">1,000+ filmmakers</span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-2.5 h-2.5 text-white/70 fill-white/70" />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
          <FloatingParticles />
          
          <motion.div 
            className="w-full max-w-[440px] relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-10">
              <motion.div 
                className="inline-flex items-center justify-center mb-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <Logo size="xl" />
              </motion.div>
              <h1 className="text-xl font-display font-semibold tracking-[-0.01em] text-white/90">Small Bridges</h1>
            </div>

            {/* Glass card — Apple-clean, hairline ring, deep shadow */}
            <div
              className="relative rounded-[24px] overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, hsla(220, 14%, 6%, 0.92) 0%, hsla(220, 14%, 3.5%, 0.96) 100%)',
                boxShadow:
                  '0 1px 0 hsla(0,0%,100%,0.05) inset, 0 0 0 1px hsla(0,0%,100%,0.06), 0 30px 80px -20px rgba(0,0,0,0.7), 0 0 60px -20px hsla(212,100%,50%,0.12)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Top hairline highlight */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              {/* Subtle blue rim glow at top */}
              <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[320px] h-[180px] rounded-full"
                style={{ background: 'radial-gradient(closest-side, hsla(212,100%,55%,0.18), transparent 70%)' }}
              />

              <div className="relative p-8 sm:p-10">
                  <AnimatePresence mode="wait">
                    {/* Email Confirmation Pending */}
                    {pendingEmailConfirmation && (
                      <motion.div key="pending" initial={formEnter} animate={formAnimate} exit={formExit} className="text-center py-6">
                        {/* Animated key icon */}
                        <motion.div 
                          className="relative mx-auto mb-8 w-24 h-24"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                        >
                          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse" />
                          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-center">
                            <KeyRound className="w-10 h-10 text-primary" />
                          </div>
                          {/* Orbiting dot */}
                          <motion.div
                            className="absolute w-2 h-2 rounded-full bg-primary"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            style={{ top: -4, left: '50%', transformOrigin: '0 56px' }}
                          />
                        </motion.div>
                        
                        <motion.h2
                          className="text-[28px] font-display font-semibold text-white mb-3 tracking-[-0.025em]"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          Enter verification code
                        </motion.h2>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                        >
                          <p className="text-white/45 mb-1 text-[13px]">We sent a verification code to</p>
                          <p className="text-white font-medium text-[13px] mb-6 tracking-tight">{pendingEmailConfirmation}</p>
                          
                          {/* OTP Input */}
                          <div className="flex justify-center gap-1.5 mb-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <input
                                key={i}
                                id={`otp-${i}`}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={otpCode[i] || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  if (!val && e.target.value) return;
                                  const newOtp = otpCode.split('');
                                  newOtp[i] = val;
                                  const joined = newOtp.join('').slice(0, 8);
                                  setOtpCode(joined);
                                  // Auto-focus next input
                                  if (val && i < 7) {
                                    document.getElementById(`otp-${i + 1}`)?.focus();
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
                                    document.getElementById(`otp-${i - 1}`)?.focus();
                                  }
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
                                  setOtpCode(pasted);
                                  const focusIdx = Math.min(pasted.length, 7);
                                  document.getElementById(`otp-${focusIdx}`)?.focus();
                                }}
                                className={cn(
                                  'w-10 h-14 text-center text-lg font-semibold text-white rounded-xl tabular-nums',
                                  'bg-white/[0.035] border border-white/[0.08]',
                                  'focus:border-[hsl(212,100%,55%)]/60 focus:ring-2 focus:ring-[hsl(212,100%,55%)]/20 focus:bg-glass-active',
                                  'outline-none transition-all duration-200',
                                  'hover:border-white/[0.15]',
                                  otpCode[i] && 'border-[hsl(212,100%,55%)]/40 bg-[hsl(212,100%,55%)]/[0.05] shadow-[0_0_18px_-6px_hsla(212,100%,55%,0.5)]',
                                )}
                                autoFocus={i === 0}
                              />
                            ))}
                          </div>
                          
                          {/* Security badge */}
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass-hover border border-white/[0.08] mb-6 backdrop-blur-md">
                            <ShieldCheck className="w-3.5 h-3.5 text-[hsl(212,100%,62%)]" />
                            <span className="text-[11px] tracking-wide text-white/65">End-to-end secure</span>
                          </div>
                          
                          <div className="space-y-2 mb-6 max-w-[320px] mx-auto">
                            <p className="text-white/35 text-[12px] leading-relaxed">
                              Enter the code from your email to verify your account.
                            </p>
                            <div className="flex items-start gap-2 text-left rounded-xl bg-glass border border-white/[0.06] px-3.5 py-2.5">
                              <Mail className="w-3.5 h-3.5 text-[hsl(212,100%,62%)] mt-0.5 shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[11px] text-white/60 leading-relaxed">
                                  Codes arrive in under a minute. If you don't see it, check your <span className="text-white/80 font-medium">Spam</span> or <span className="text-white/80 font-medium">Promotions</span> folder.
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                        
                        <div className="space-y-3">
                          <Button
                            onClick={async () => {
                              if (otpCode.length < 6 || otpCode.length > 8) {
                                toast.error('Please enter the full verification code');
                                return;
                              }
                              setVerifyingOtp(true);
                              try {
                                const { error } = await supabase.auth.verifyOtp({
                                  email: pendingEmailConfirmation!,
                                  token: otpCode,
                                  type: 'signup',
                                });
                                if (error) {
                                  toast.error(error.message || 'Invalid code. Please try again.');
                                  setOtpCode('');
                                  document.getElementById('otp-0')?.focus();
                                } else {
                                  toast.success('Email verified! Welcome aboard.');
                                  // Track signup analytics after OTP verification
                                  const { data: sessionData } = await supabase.auth.getUser();
                                  if (sessionData?.user) {
                                    trackSignup(sessionData.user.id);
                                    // Fire-and-forget welcome email. We don't gate UI on this
                                    // — if the function is missing it logs and moves on.
                                    void supabase.functions
                                      .invoke('send-transactional-email', {
                                        body: {
                                          template: 'user_welcome',
                                          recipientEmail: sessionData.user.email,
                                          templateData: {
                                            displayName:
                                              (sessionData.user.user_metadata?.display_name as string | undefined) ||
                                              sessionData.user.email?.split('@')[0] ||
                                              'there',
                                            starterCredits: 100,
                                          },
                                        },
                                      })
                                      .catch((e) => console.warn('[Auth] welcome email failed:', e));
                                  }
                                  setPendingEmailConfirmation(null);
                                  setOtpCode('');
                                }
                              } catch {
                                toast.error('Verification failed. Please try again.');
                              } finally {
                                setVerifyingOtp(false);
                              }
                            }}
                            disabled={verifyingOtp || otpCode.length < 6}
                            className="w-full h-12 rounded-2xl font-semibold text-[13px] tracking-tight text-black bg-white hover:bg-white/90 transition-all duration-300 hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-[0_1px_0_hsla(0,0%,100%,0.6)_inset,0_10px_30px_-10px_hsla(0,0%,100%,0.35)]"
                          >
                            {verifyingOtp ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                Verify & continue
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </>
                            )}
                          </Button>
                          
                          <button
                            type="button"
                            disabled={resendingOtp}
                            onClick={async () => {
                              setResendingOtp(true);
                              try {
                                const { error } = await supabase.auth.resend({
                                  type: 'signup',
                                  email: pendingEmailConfirmation!,
                                });
                                if (error) {
                                  toast.error('Could not resend code. Please wait a moment and try again.');
                                } else {
                                  toast.success('New code sent! Check your inbox.');
                                  setOtpCode('');
                                  document.getElementById('otp-0')?.focus();
                                }
                              } catch {
                                toast.error('Something went wrong.');
                              } finally {
                                setResendingOtp(false);
                              }
                            }}
                            className="text-xs text-white/75 hover:text-white/70 transition-colors disabled:opacity-50"
                          >
                            {resendingOtp ? 'Sending...' : "Didn't get a code? Resend"}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => { setPendingEmailConfirmation(null); setOtpCode(''); setPassword(''); setConfirmPassword(''); }}
                            className="text-xs text-white/65 hover:text-white/60 transition-colors"
                          >
                            Use a different email
                          </button>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Auth Form */}
                    {!pendingEmailConfirmation && (
                      <motion.div key={isLogin ? 'login' : 'signup'} initial={formEnter} animate={formAnimate} exit={formExit}>
                        {/* Header */}
                        <div className="mb-7">
                          <motion.div
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass-hover border border-white/[0.08] backdrop-blur-md mb-5"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1, type: 'spring' }}
                          >
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-[hsl(212,100%,55%)] shadow-[0_0_8px_hsl(212,100%,55%)]"
                              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-[10px] font-medium tracking-[0.16em] uppercase text-white/65">
                              {isLogin ? 'Welcome back' : 'Get started free'}
                            </span>
                          </motion.div>
                          <h2 className="text-[32px] sm:text-[36px] font-display font-semibold text-white mb-2 tracking-[-0.03em] leading-[1.05]">
                            {isLogin ? 'Sign in' : 'Create account'}
                          </h2>
                          <p className="text-white/75 text-[13px]">
                            {isLogin ? 'Continue to your creative studio' : 'Start your filmmaking journey today'}
                          </p>
                        </div>

                        {/* Pending Creation Banner */}
                        {hasPendingCreation && !isLogin && (
                          <motion.div
                            className="mb-6 p-3.5 rounded-2xl bg-[hsl(212,100%,55%)]/[0.05] border border-[hsl(212,100%,55%)]/15"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[hsl(212,100%,55%)]/15 border border-[hsl(212,100%,55%)]/20 flex items-center justify-center shrink-0">
                                <Zap className="w-4.5 h-4.5 text-[hsl(212,100%,65%)]" />
                              </div>
                              <div>
                                <p className="text-[13px] font-medium text-white tracking-tight">Your video is ready to create</p>
                                <p className="text-[11px] text-white/75">Sign up to bring your vision to life</p>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                          {/* Email */}
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-white/55 text-[10px] font-medium uppercase tracking-[0.16em]">
                              Email
                            </Label>
                            <div className="relative group">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/65 group-focus-within:text-[hsl(212,100%,62%)] transition-colors duration-300" />
                              <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => {
                                  setEmail(e.target.value);
                                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                                }}
                                className={cn(
                                  'h-12 pl-11 bg-white/[0.025] border-white/[0.07] text-white placeholder:text-white/25 text-[14px]',
                                  'focus:border-[hsl(212,100%,55%)]/55 focus:ring-2 focus:ring-[hsl(212,100%,55%)]/15 focus:bg-glass-hover',
                                  'rounded-xl transition-all duration-300',
                                  'hover:border-white/[0.12] hover:bg-white/[0.035]',
                                  errors.email && 'border-destructive/50 focus:ring-destructive/15',
                                )}
                                maxLength={255}
                              />
                            </div>
                            {errors.email && (
                              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-destructive text-xs">
                                {errors.email}
                              </motion.p>
                            )}
                          </div>

                          {/* Password */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="password" className="text-white/55 text-[10px] font-medium uppercase tracking-[0.16em]">
                                Password
                              </Label>
                              {isLogin && (
                                <Link to="/forgot-password" className="text-[11px] text-white/45 hover:text-[hsl(212,100%,65%)] transition-colors">
                                  Forgot password?
                                </Link>
                              )}
                            </div>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/65 group-focus-within:text-[hsl(212,100%,62%)] transition-colors duration-300" />
                              <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => {
                                  setPassword(e.target.value);
                                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                                }}
                                className={cn(
                                  'h-12 pl-11 pr-11 bg-white/[0.025] border-white/[0.07] text-white placeholder:text-white/25 text-[14px]',
                                  'focus:border-[hsl(212,100%,55%)]/55 focus:ring-2 focus:ring-[hsl(212,100%,55%)]/15 focus:bg-glass-hover',
                                  'rounded-xl transition-all duration-300',
                                  'hover:border-white/[0.12] hover:bg-white/[0.035]',
                                  errors.password && 'border-destructive/50',
                                )}
                                maxLength={72}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/65 hover:text-white/70 transition-colors"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {errors.password && (
                              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-destructive text-xs">
                                {errors.password}
                              </motion.p>
                            )}
                            {!isLogin && password && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: 'auto' }}
                                className="overflow-hidden"
                              >
                                <div className="pt-2 px-1">
                                  <PasswordStrength password={password} />
                                </div>
                              </motion.div>
                            )}
                          </div>

                          {/* Confirm Password */}
                          {!isLogin && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }} 
                              animate={{ opacity: 1, height: 'auto' }}
                              className="space-y-2 overflow-hidden"
                            >
                              <Label htmlFor="confirmPassword" className="text-white/55 text-[10px] font-medium uppercase tracking-[0.16em]">
                                Confirm Password
                              </Label>
                              <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/65 group-focus-within:text-[hsl(212,100%,62%)] transition-colors duration-300" />
                                <Input
                                  id="confirmPassword"
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  placeholder="••••••••"
                                  value={confirmPassword}
                                  onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                                  }}
                                  className={cn(
                                    'h-12 pl-11 pr-11 bg-white/[0.025] border-white/[0.07] text-white placeholder:text-white/25 text-[14px]',
                                    'focus:border-[hsl(212,100%,55%)]/55 focus:ring-2 focus:ring-[hsl(212,100%,55%)]/15 focus:bg-glass-hover',
                                    'rounded-xl transition-all duration-300',
                                    'hover:border-white/[0.12] hover:bg-white/[0.035]',
                                    errors.confirmPassword && 'border-destructive/50',
                                  )}
                                  maxLength={72}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/65 hover:text-white/70 transition-colors"
                                >
                                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                {/* Match indicator */}
                                {confirmPassword && password && (
                                  <motion.div 
                                    className="absolute right-12 top-1/2 -translate-y-1/2"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring' }}
                                  >
                                    <div className={cn(
                                      'w-1.5 h-1.5 rounded-full transition-colors',
                                      password === confirmPassword ? 'bg-[hsl(142,70%,55%)] shadow-[0_0_10px_hsla(142,70%,55%,0.7)]' : 'bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.6)]',
                                    )} />
                                  </motion.div>
                                )}
                              </div>
                              {errors.confirmPassword && (
                                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-destructive text-xs">
                                  {errors.confirmPassword}
                                </motion.p>
                              )}
                            </motion.div>
                          )}

                          {/* Submit — luminous blue CTA */}
                          <Button
                            type="submit"
                            disabled={loading}
                            className={cn(
                              'w-full h-12 rounded-xl font-semibold text-[13px] tracking-tight text-black bg-white hover:bg-white/90 relative overflow-hidden shadow-[0_1px_0_hsla(0,0%,100%,0.6)_inset,0_10px_30px_-10px_hsla(0,0%,100%,0.35)]',
                              'transition-all duration-300 hover:scale-[1.005] active:scale-[0.995] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100',
                            )}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {isLogin ? 'Signing in...' : 'Creating account...'}
                              </>
                            ) : (
                              <>
                                {isLogin ? 'Sign in' : 'Create account'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </>
                            )}
                          </Button>
                        </form>

                        {/* Toggle Mode */}
                        <p className="text-center text-[13px] text-white/75 mt-7">
                          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setIsLogin((v) => !v);
                              setErrors({});
                              setPassword('');
                              setConfirmPassword('');
                            }}
                            className="text-white font-medium hover:text-[hsl(212,100%,65%)] transition-colors duration-300 underline-offset-4 hover:underline"
                          >
                            {isLogin ? 'Sign up' : 'Sign in'}
                          </button>
                        </p>

                        {/* Terms */}
                        {!isLogin && (
                          <motion.p 
                            className="text-center text-[11px] text-white/65 mt-4 leading-relaxed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            By creating an account, you agree to our{' '}
                            <Link to="/terms" className="text-white/55 hover:text-white underline underline-offset-2 transition-colors">Terms</Link>
                            {' '}and{' '}
                            <Link to="/privacy" className="text-white/55 hover:text-white underline underline-offset-2 transition-colors">Privacy</Link>
                          </motion.p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            </div>
            
            {/* Bottom trust badges */}
            <motion.div
              className="flex items-center justify-center gap-5 mt-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[
                { icon: ShieldCheck, text: 'End-to-end secure' },
                { icon: Zap, text: 'Instant setup' },
                { icon: Star, text: 'Cinema-grade output' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 text-white/25" />
                  <span className="text-[10px] tracking-wide text-white/65">{text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
});

export default Auth;
