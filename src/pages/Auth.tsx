import { useState, useEffect, forwardRef, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, Zap, KeyRound } from 'lucide-react';
import { z } from 'zod';
import { PasswordStrength } from '@/components/ui/password-strength';
import { WelcomeBackDialog } from '@/components/auth/WelcomeBackDialog';
import { useSafeNavigation } from '@/lib/navigation';
import { Logo } from '@/components/ui/Logo';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';
import authHeroImage from '@/assets/auth-hero-mittens.png';

// ─── Floating Particles ─────────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 
              ? 'hsl(263, 70%, 58%)' 
              : i % 3 === 1 
                ? 'hsl(195, 90%, 50%)' 
                : 'rgba(255,255,255,0.4)',
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0, 0.7, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 4 + Math.random() * 6,
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
  const { user, profile, loading: authLoading, signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const fromCreate = searchParams.get('from') === 'create';
  const modeParam = searchParams.get('mode');
  
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
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/create', { replace: true });
      }
    }
  }, [user, profile, authLoading, hasRedirected, navigate, showWelcomeDialog]);

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
          setShowWelcomeDialog(true);
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
      navigate('/onboarding', { replace: true });
    } else {
      navigate(choice === 'create' ? '/create' : '/creators', { replace: true });
    }
  }, [profile, navigate]);

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
        {/* Deep cinematic background */}
        <div className="fixed inset-0 bg-[hsl(250,15%,3%)]" />
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${landingAbstractBg})` }}
        />
        
        {/* Animated orbs */}
        <AnimatedOrb className="w-[700px] h-[700px] bg-primary/20 top-[-200px] left-[10%]" />
        <AnimatedOrb className="w-[500px] h-[500px] bg-accent/15 bottom-[-100px] right-[15%]" delay={3} />
        <AnimatedOrb className="w-[400px] h-[400px] bg-primary/10 top-[40%] right-[-100px]" delay={5} />
        
        {/* Grid overlay */}
        <div 
          className="fixed inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Vignette */}
        <div className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)' }}
        />

        {/* Left Side - Hero Image */}
        <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <motion.img 
              src={authHeroImage}
              alt="Apex Studio"
              className="w-full h-full object-cover object-center"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[hsl(250,15%,3%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(250,15%,3%)]/80 via-transparent to-[hsl(250,15%,3%)]/60" />
            {/* Cinematic letterbox lines */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
          
          <FloatingParticles />
          
          <div className="relative z-10 p-12 xl:p-16 w-full h-full flex flex-col justify-between">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Logo size="xl" showText textClassName="text-2xl font-display font-bold drop-shadow-lg" />
            </motion.div>
            
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="text-5xl xl:text-7xl font-display font-bold text-white leading-[1.05] tracking-tight">
                  Create.<br />
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-[shimmer-bg_4s_ease-in-out_infinite] bg-clip-text text-transparent">
                    Direct.
                  </span><br />
                  <span className="text-white/30">Produce.</span>
                </h2>
              </motion.div>
              
              <motion.p 
                className="text-lg text-white/40 max-w-md leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                AI-powered cinema at the speed of thought. One prompt, minutes of cinematic video.
              </motion.p>
              
              {/* Premium social proof */}
              <motion.div 
                className="inline-flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
              >
                <div className="flex -space-x-2.5">
                  {[
                    'from-violet-500 to-purple-600',
                    'from-cyan-400 to-blue-500',
                    'from-emerald-400 to-teal-500',
                    'from-amber-400 to-orange-500',
                  ].map((gradient, i) => (
                    <motion.div 
                      key={i} 
                      className={cn(
                        "w-8 h-8 rounded-full bg-gradient-to-br border-2 border-[hsl(250,15%,3%)]",
                        gradient
                      )}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.1 + i * 0.1, type: 'spring', stiffness: 300 }}
                    />
                  ))}
                </div>
                <div>
                  <span className="text-sm text-white/70 font-medium">1,000+ creators</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Sparkles key={i} className="w-2.5 h-2.5 text-amber-400/80" />
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
              <h1 className="text-xl font-display font-bold text-white/90">Apex Studio</h1>
            </div>

            {/* Glass container with animated border */}
            <div className="relative rounded-[28px] overflow-hidden group">
              {/* Animated gradient border */}
              <div className="absolute inset-0 rounded-[28px] p-[1px] overflow-hidden">
                <div 
                  className="absolute inset-[-100%] animate-[spin_8s_linear_infinite]"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent, hsl(263, 70%, 58%), transparent, hsl(195, 90%, 50%), transparent)',
                  }}
                />
              </div>
              
              {/* Inner container */}
              <div className="relative rounded-[27px] m-[1px] bg-[hsl(250,15%,5%)]/95 backdrop-blur-2xl overflow-hidden">
                {/* Top highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                
                {/* Inner glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/5 blur-[80px] rounded-full" />
                
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
                          className="text-3xl font-display font-bold text-white mb-3 tracking-tight"
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
                          <p className="text-white/40 mb-1 text-sm">We sent a 6-digit code to</p>
                          <p className="text-white font-semibold text-sm mb-6">{pendingEmailConfirmation}</p>
                          
                          {/* OTP Input */}
                          <div className="flex justify-center gap-2.5 mb-6">
                            {Array.from({ length: 6 }).map((_, i) => (
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
                                  const joined = newOtp.join('').slice(0, 6);
                                  setOtpCode(joined);
                                  // Auto-focus next input
                                  if (val && i < 5) {
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
                                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                                  setOtpCode(pasted);
                                  const focusIdx = Math.min(pasted.length, 5);
                                  document.getElementById(`otp-${focusIdx}`)?.focus();
                                }}
                                className={cn(
                                  "w-12 h-14 text-center text-xl font-bold text-white rounded-xl",
                                  "bg-white/[0.04] border border-white/[0.08]",
                                  "focus:border-primary/60 focus:ring-2 focus:ring-primary/20 focus:bg-white/[0.06]",
                                  "outline-none transition-all duration-200",
                                  "hover:border-white/[0.15]",
                                  otpCode[i] && "border-primary/30 bg-primary/[0.04]"
                                )}
                                autoFocus={i === 0}
                              />
                            ))}
                          </div>
                          
                          {/* Security badge */}
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15 mb-6">
                            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs text-primary/80">Secure verification</span>
                          </div>
                          
                          <p className="text-white/30 text-xs mb-6 leading-relaxed max-w-[280px] mx-auto">
                            Enter the code from your email to verify your account.
                          </p>
                        </motion.div>
                        
                        <div className="space-y-3">
                          <Button
                            onClick={async () => {
                              if (otpCode.length !== 6) {
                                toast.error('Please enter the full 6-digit code');
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
                                  if (sessionData?.user) trackSignup(sessionData.user.id);
                                  setPendingEmailConfirmation(null);
                                  setOtpCode('');
                                }
                              } catch {
                                toast.error('Verification failed. Please try again.');
                              } finally {
                                setVerifyingOtp(false);
                              }
                            }}
                            disabled={verifyingOtp || otpCode.length !== 6}
                            className="w-full h-13 bg-gradient-to-r from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary/80 rounded-2xl font-semibold text-sm shadow-[0_0_30px_rgba(124,58,237,0.2)] hover:shadow-[0_0_40px_rgba(124,58,237,0.35)] transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                            className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
                          >
                            {resendingOtp ? 'Sending...' : "Didn't get a code? Resend"}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => { setPendingEmailConfirmation(null); setOtpCode(''); setPassword(''); setConfirmPassword(''); }}
                            className="text-xs text-white/30 hover:text-white/60 transition-colors"
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
                        <div className="mb-8">
                          <motion.div 
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/10 border border-primary/20 mb-5"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1, type: 'spring' }}
                          >
                            <motion.div 
                              className="w-1.5 h-1.5 rounded-full bg-primary"
                              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-xs font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                              {isLogin ? 'Welcome back' : 'Get started free'}
                            </span>
                          </motion.div>
                          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2 tracking-tight">
                            {isLogin ? 'Sign in' : 'Create account'}
                          </h2>
                          <p className="text-white/35 text-sm">
                            {isLogin ? 'Continue to your creative studio' : 'Start your filmmaking journey today'}
                          </p>
                        </div>

                        {/* Pending Creation Banner */}
                        {hasPendingCreation && !isLogin && (
                          <motion.div 
                            className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-primary/[0.06] to-accent/[0.04] border border-primary/15"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">Your video is ready to create!</p>
                                <p className="text-xs text-white/35">Sign up to bring your vision to life</p>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Google Sign-In */}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={googleLoading || loading}
                          onClick={async () => {
                            setGoogleLoading(true);
                            try {
                              const { error } = await signInWithGoogle();
                              if (error) {
                                toast.error('Google sign-in failed. Please try again.');
                              }
                            } catch {
                              toast.error('Something went wrong with Google sign-in.');
                            } finally {
                              setGoogleLoading(false);
                            }
                          }}
                          className={cn(
                            "w-full h-13 rounded-2xl font-semibold text-sm mb-6",
                            "bg-white/[0.04] border-white/[0.08] text-white",
                            "hover:bg-white/[0.08] hover:border-white/[0.15]",
                            "transition-all duration-300",
                            "flex items-center justify-center gap-3"
                          )}
                        >
                          {googleLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                          )}
                          Continue with Google
                        </Button>

                        {/* Apple Sign-In */}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={appleLoading || loading}
                          onClick={async () => {
                            setAppleLoading(true);
                            try {
                              const { error } = await signInWithApple();
                              if (error) {
                                toast.error('Apple sign-in failed. Please try again.');
                              }
                            } catch {
                              toast.error('Something went wrong with Apple sign-in.');
                            } finally {
                              setAppleLoading(false);
                            }
                          }}
                          className={cn(
                            "w-full h-13 rounded-2xl font-semibold text-sm mb-6",
                            "bg-white/[0.04] border-white/[0.08] text-white",
                            "hover:bg-white/[0.08] hover:border-white/[0.15]",
                            "transition-all duration-300",
                            "flex items-center justify-center gap-3"
                          )}
                        >
                          {appleLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                          )}
                          Continue with Apple
                        </Button>

                        {/* Divider */}
                        <div className="flex items-center gap-4 mb-6">
                          <div className="flex-1 h-px bg-white/[0.06]" />
                          <span className="text-xs text-white/25 uppercase tracking-wider">or</span>
                          <div className="flex-1 h-px bg-white/[0.06]" />
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                          {/* Email */}
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                              Email
                            </Label>
                            <div className="relative group">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-primary transition-colors duration-300" />
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
                                  "h-13 pl-11 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20",
                                  "focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.05]",
                                  "rounded-xl transition-all duration-300",
                                  "hover:border-white/[0.12] hover:bg-white/[0.04]",
                                  errors.email && "border-destructive/50 focus:ring-destructive/15"
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
                              <Label htmlFor="password" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                Password
                              </Label>
                              {isLogin && (
                                <Link to="/forgot-password" className="text-xs text-primary/60 hover:text-primary transition-colors">
                                  Forgot?
                                </Link>
                              )}
                            </div>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-primary transition-colors duration-300" />
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
                                  "h-13 pl-11 pr-11 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20",
                                  "focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.05]",
                                  "rounded-xl transition-all duration-300",
                                  "hover:border-white/[0.12] hover:bg-white/[0.04]",
                                  errors.password && "border-destructive/50"
                                )}
                                maxLength={72}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
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
                              <Label htmlFor="confirmPassword" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                Confirm Password
                              </Label>
                              <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-primary transition-colors duration-300" />
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
                                    "h-13 pl-11 pr-11 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20",
                                    "focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.05]",
                                    "rounded-xl transition-all duration-300",
                                    "hover:border-white/[0.12] hover:bg-white/[0.04]",
                                    errors.confirmPassword && "border-destructive/50"
                                  )}
                                  maxLength={72}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
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
                                      "w-2 h-2 rounded-full transition-colors",
                                      password === confirmPassword ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"
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

                          {/* Submit */}
                          <Button 
                            type="submit" 
                            disabled={loading}
                            className={cn(
                              "w-full h-13 rounded-2xl font-semibold text-sm transition-all duration-500",
                              "hover:scale-[1.01] active:scale-[0.99]",
                              isLogin
                                ? "bg-gradient-to-r from-white to-white/95 text-black hover:from-white/95 hover:to-white/90 shadow-[0_0_30px_rgba(255,255,255,0.08)] hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                                : "bg-gradient-to-r from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary/80 shadow-[0_0_30px_rgba(124,58,237,0.2)] hover:shadow-[0_0_40px_rgba(124,58,237,0.35)]"
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
                        <p className="text-center text-sm text-white/35 mt-8">
                          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setIsLogin(!isLogin);
                              setErrors({});
                              setPassword('');
                              setConfirmPassword('');
                            }}
                            className="text-white font-semibold hover:text-primary transition-colors duration-300"
                          >
                            {isLogin ? 'Sign up' : 'Sign in'}
                          </button>
                        </p>

                        {/* Terms */}
                        {!isLogin && (
                          <motion.p 
                            className="text-center text-xs text-white/25 mt-4 leading-relaxed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            By creating an account, you agree to our{' '}
                            <Link to="/terms" className="text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">Terms</Link>
                            {' '}and{' '}
                            <Link to="/privacy" className="text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">Privacy Policy</Link>
                          </motion.p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            
            {/* Bottom trust badges */}
            <motion.div 
              className="flex items-center justify-center gap-6 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[
                { icon: ShieldCheck, text: 'Secure' },
                { icon: Zap, text: 'Instant setup' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 text-white/20" />
                  <span className="text-[11px] text-white/20">{text}</span>
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
