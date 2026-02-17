import { useState, useEffect, forwardRef, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
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
  const { user, profile, loading: authLoading, signIn, signUp } = useAuth();
  
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

  const trackSignup = useCallback((userId: string) => {
    const params = new URLSearchParams(window.location.search);
    supabase.functions.invoke('track-signup', {
      body: {
        user_id: userId,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        referrer: document.referrer || null,
      },
    }).catch(() => {});
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
            toast.error('Please check your email and click the confirmation link before signing in.');
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
  
  const handleWelcomeComplete = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    
    setShowWelcomeDialog(false);
    setHasRedirected(true);
    if (profile && !profile.onboarding_completed) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/create', { replace: true });
    }
  }, [profile, navigate]);

  const formEnter = { opacity: 0, y: 20 };
  const formAnimate = { opacity: 1, y: 0, transition: { duration: 0.5 } };
  const formExit = { opacity: 0, y: -20, transition: { duration: 0.3 } };

  return (
    <>
      <WelcomeBackDialog 
        isOpen={showWelcomeDialog} 
        onComplete={handleWelcomeComplete}
        userName={profile?.display_name?.split(' ')[0]}
      />
      
      <div ref={mergedRef} className="min-h-screen flex relative overflow-hidden">
        {/* Deep cinematic background */}
        <div className="fixed inset-0 bg-[hsl(240,10%,4%)]" />
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${landingAbstractBg})` }}
        />
        
        {/* Ambient glows */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[180px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/6 blur-[160px]" />
        </div>
        
        {/* Vignette */}
        <div className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }}
        />

        {/* Left Side - Hero Image */}
        <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <img 
              src={authHeroImage}
              alt="Apex Studio"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[hsl(240,10%,4%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(240,10%,4%)]/70 via-transparent to-[hsl(240,10%,4%)]/50" />
          </div>
          
          <div className="relative z-10 p-12 xl:p-16 w-full h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <Logo size="xl" showText textClassName="text-2xl font-display font-bold drop-shadow-lg" />
            </div>
            
            <div className="space-y-6">
              <h2 className="text-5xl xl:text-6xl font-display font-bold text-white leading-[1.1] tracking-tight">
                Create.<br />
                <span className="bg-gradient-to-r from-white/90 to-white/50 bg-clip-text text-transparent">Direct.</span><br />
                <span className="bg-gradient-to-r from-white/60 to-white/30 bg-clip-text text-transparent">Produce.</span>
              </h2>
              <p className="text-lg text-white/50 max-w-md leading-relaxed">
                AI-powered cinema at the speed of thought. One prompt, minutes of video.
              </p>
              
              {/* Social proof capsule */}
              <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm">
                <div className="flex -space-x-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 border-2 border-[hsl(240,10%,4%)]" />
                  ))}
                </div>
                <span className="text-sm text-white/60">Join 1,000+ creators</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
          <motion.div 
            className="w-full max-w-[420px]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-10">
              <div className="inline-flex items-center justify-center mb-4">
                <Logo size="xl" />
              </div>
              <h1 className="text-xl font-display font-bold text-white/90">Apex Studio</h1>
            </div>

            {/* Glass container */}
            <div className="relative rounded-3xl overflow-hidden">
              {/* Gradient border effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.12] to-white/[0.04] p-px">
                <div className="w-full h-full rounded-3xl bg-[hsl(240,10%,6%)]/90 backdrop-blur-xl" />
              </div>
              
              <div className="relative p-8 sm:p-10">
                <AnimatePresence mode="wait">
                  {/* Email Confirmation Pending */}
                  {pendingEmailConfirmation && (
                    <motion.div key="pending" initial={formEnter} animate={formAnimate} exit={formExit} className="text-center py-4">
                      <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-9 h-9 text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-display font-bold text-white mb-3">Check your inbox</h2>
                      <p className="text-white/50 mb-1 text-sm">We sent a confirmation link to</p>
                      <p className="text-white font-medium mb-6 text-sm">{pendingEmailConfirmation}</p>
                      <p className="text-white/40 text-xs mb-8 leading-relaxed">
                        Click the link in the email to activate your account, then come back here to sign in.
                      </p>
                      <div className="space-y-3">
                        <Button
                          onClick={() => {
                            setPendingEmailConfirmation(null);
                            setIsLogin(true);
                            setPassword('');
                            setConfirmPassword('');
                          }}
                          className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-2xl font-semibold text-sm"
                        >
                          I've confirmed my email
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setPendingEmailConfirmation(null); setPassword(''); setConfirmPassword(''); }}
                          className="text-xs text-white/40 hover:text-white/70 transition-colors"
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
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="text-xs font-medium text-primary">
                            {isLogin ? 'Welcome back' : 'Get started free'}
                          </span>
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">
                          {isLogin ? 'Sign in' : 'Create account'}
                        </h2>
                        <p className="text-white/40 text-sm">
                          {isLogin ? 'Continue to your creative studio' : 'Start your filmmaking journey today'}
                        </p>
                      </div>

                      {/* Pending Creation Banner */}
                      {hasPendingCreation && !isLogin && (
                        <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/15">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                              <ArrowRight className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">Your video is ready to create!</p>
                              <p className="text-xs text-white/40">Sign up to bring your vision to life</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                            Email
                          </Label>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary/70 transition-colors" />
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
                                "h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25",
                                "focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:bg-white/[0.06]",
                                "rounded-xl transition-all duration-300",
                                errors.email && "border-destructive/50"
                              )}
                              maxLength={255}
                            />
                          </div>
                          {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                              Password
                            </Label>
                            {isLogin && (
                              <Link to="/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">
                                Forgot?
                              </Link>
                            )}
                          </div>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary/70 transition-colors" />
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
                                "h-12 pl-11 pr-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25",
                                "focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:bg-white/[0.06]",
                                "rounded-xl transition-all duration-300",
                                errors.password && "border-destructive/50"
                              )}
                              maxLength={72}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
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
                            <Label htmlFor="confirmPassword" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                              Confirm Password
                            </Label>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary/70 transition-colors" />
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
                                  "h-12 pl-11 pr-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25",
                                  "focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:bg-white/[0.06]",
                                  "rounded-xl transition-all duration-300",
                                  errors.confirmPassword && "border-destructive/50"
                                )}
                                maxLength={72}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              {/* Match indicator */}
                              {confirmPassword && password && (
                                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full transition-colors",
                                    password === confirmPassword ? "bg-emerald-400" : "bg-destructive"
                                  )} />
                                </div>
                              )}
                            </div>
                            {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword}</p>}
                          </motion.div>
                        )}

                        {/* Submit */}
                        <Button 
                          type="submit" 
                          disabled={loading}
                          className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-2xl font-semibold text-sm shadow-lg shadow-white/5 transition-all duration-300 hover:shadow-white/10 hover:scale-[1.01] active:scale-[0.99]"
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
                      <p className="text-center text-sm text-white/40 mt-8">
                        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setIsLogin(!isLogin);
                            setErrors({});
                            setPassword('');
                            setConfirmPassword('');
                          }}
                          className="text-white font-semibold hover:text-primary transition-colors"
                        >
                          {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                      </p>

                      {/* Terms */}
                      {!isLogin && (
                        <p className="text-center text-xs text-white/30 mt-4 leading-relaxed">
                          By creating an account, you agree to our{' '}
                          <Link to="/terms" className="text-white/50 hover:text-white/70 underline underline-offset-2">Terms</Link>
                          {' '}and{' '}
                          <Link to="/privacy" className="text-white/50 hover:text-white/70 underline underline-offset-2">Privacy Policy</Link>
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
});

export default Auth;
