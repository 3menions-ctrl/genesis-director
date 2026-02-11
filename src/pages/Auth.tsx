import { useState, useEffect, forwardRef, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Film, Mail, Lock, Loader2, User, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { PasswordStrength } from '@/components/ui/password-strength';
import { WelcomeBackDialog } from '@/components/auth/WelcomeBackDialog';
import { useSafeNavigation } from '@/lib/navigation';
import { Logo } from '@/components/ui/Logo';
import { supabase } from '@/integrations/supabase/client';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';
import authHeroImage from '@/assets/auth-hero.jpg';
// Validation schemas
const emailSchema = z.string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be less than 72 characters');

// Simplified signup password - just min length, no complex requirements
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
  
  // Synchronous ref merger - runs during render, not in useEffect
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
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  
  // FIX: useAuth now returns safe fallback if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user, profile, loading: authLoading, signIn, signUp } = useAuth();
  
  // Check URL params for mode (from creation teaser)
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

  // Track signup/login geo data (fire-and-forget)
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
    }).catch(() => {}); // silent fail
  }, []);


  // Check for pending creation on mount
  useEffect(() => {
    const pendingData = sessionStorage.getItem('pendingCreation');
    if (pendingData) {
      try {
        const data = JSON.parse(pendingData);
        // Only consider valid if less than 1 hour old
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

  // Redirect authenticated users - only once to prevent blinking
  // CRITICAL: Skip redirect while welcome dialog is showing to prevent flash
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // Only redirect once
    if (hasRedirected) return;
    
    // Don't redirect while welcome dialog is showing - it will handle navigation
    if (showWelcomeDialog) return;
    
    if (user && profile) {
      setHasRedirected(true);
      if (!profile.onboarding_completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/projects', { replace: true });
      }
    }
  }, [user, profile, authLoading, hasRedirected, navigate, showWelcomeDialog]);

  const validateForm = (): boolean => {
    // Use stricter validation for signup
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
      
      // Show first error as toast
      const firstError = result.error.errors[0];
      toast.error(firstError.message);
      return false;
    }
    
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Check password confirmation for signup
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
            // User hasn't confirmed their email yet
            setPendingEmailConfirmation(trimmedEmail);
            toast.error('Please check your email and click the confirmation link before signing in.');
          } else {
            toast.error(error.message);
          }
        } else {
          // Track geo data on login
          if (user) trackSignup(user.id);
          // Show epic welcome dialog instead of simple toast
          setShowWelcomeDialog(true);
        }
      } else {
        const { error } = await signUp(trimmedEmail, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Try logging in instead.');
          } else {
            toast.error(error.message);
          }
        } else {
          // Show email confirmation pending state
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

  // CRITICAL: Ref-based guard to prevent handleWelcomeComplete from double-firing
  const hasNavigatedRef = useRef(false);
  
  const handleWelcomeComplete = useCallback(() => {
    // Guard against double-fire from timer + click
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    
    setShowWelcomeDialog(false);
    // Explicitly navigate after welcome dialog - don't rely on useEffect
    // This ensures smooth transition without flash
    setHasRedirected(true);
    if (profile && !profile.onboarding_completed) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/projects', { replace: true });
    }
  }, [profile, navigate]);

  return (
    <>
      {/* Epic Welcome Back Dialog */}
      <WelcomeBackDialog 
        isOpen={showWelcomeDialog} 
        onComplete={handleWelcomeComplete}
        userName={profile?.display_name?.split(' ')[0]}
      />
      
      <div className="min-h-screen flex relative">
      {/* Full-page glossy black background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      
      {/* Subtle vignette overlay */}
      <div 
        className="fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center overflow-hidden">
        {/* Hero Image */}
        <div className="absolute inset-0">
          <img 
            src={authHeroImage}
            alt="Premium race car"
            className="w-full h-full object-cover object-center"
          />
          {/* Gradient overlays for blending */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        </div>
        
        {/* Floating Logo & Text Overlay */}
        <div className="relative z-10 p-12 xl:p-16 w-full h-full flex flex-col justify-between">
          {/* Top: Logo */}
          <div className="flex items-center gap-3">
            <Logo size="xl" showText textClassName="text-2xl font-display font-bold drop-shadow-lg" />
          </div>
          
          {/* Bottom: Tagline */}
          <div className="space-y-4">
            <h2 className="text-4xl xl:text-5xl font-display font-bold text-white leading-tight drop-shadow-lg">
              Speed.<br />
              <span className="text-white/70">Precision.</span><br />
              <span className="text-white/50">Vision.</span>
            </h2>
            <p className="text-lg text-white/60 max-w-md leading-relaxed drop-shadow-md">
              AI-powered video generation at the speed of thought.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        {/* Transparent container */}
        <div className="w-full max-w-md relative">
          {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <Logo size="xl" />
              </div>
            <h1 className="text-2xl font-display font-bold text-white">
              Apex-Studio
            </h1>
          </div>

          {/* Glass container for form */}
          <div className="relative p-8 sm:p-10 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
            {/* Email Confirmation Pending State */}
            {pendingEmailConfirmation && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
                  Check your email
                </h2>
                <p className="text-white/70 mb-2">
                  We sent a confirmation link to:
                </p>
                <p className="text-white font-medium mb-6">
                  {pendingEmailConfirmation}
                </p>
                <p className="text-white/60 text-sm mb-8">
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
                    className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-xl font-semibold"
                  >
                    I've confirmed my email
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingEmailConfirmation(null);
                      setPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            )}
            
            {/* Regular Form - only show when not pending email confirmation */}
            {!pendingEmailConfirmation && (
              <>
            {/* Glow effect */}
            
            {/* Pending Creation Banner */}
            {hasPendingCreation && !isLogin && (
              <div className="mb-6 p-4 rounded-xl bg-white/10 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Your video is ready to create!</p>
                    <p className="text-xs text-white/60">Sign up to bring your vision to life</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-4">
                <User className="w-3.5 h-3.5 text-white" />
                <span className="text-xs font-medium text-white">
                  {hasPendingCreation && !isLogin ? 'Almost there!' : isLogin ? 'Welcome back' : 'Get started'}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">
                {isLogin ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-white/60">
                {hasPendingCreation && !isLogin 
                  ? 'Create your account to generate your video'
                  : isLogin 
                    ? 'Continue to your creative studio' 
                    : 'Start your filmmaking journey today'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-sm font-medium">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    className={`h-12 pl-12 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-white/10 rounded-xl ${errors.email ? 'border-destructive' : ''}`}
                    maxLength={255}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white text-sm font-medium">
                    Password
                  </Label>
                  {isLogin && (
                    <Link 
                      to="/forgot-password" 
                      className="text-sm text-white/60 hover:text-white font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                    }}
                    className={`h-12 pl-12 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-white/10 rounded-xl ${errors.password ? 'border-destructive' : ''}`}
                    maxLength={72}
                  />
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1">{errors.password}</p>
                  )}
                </div>
                {!isLogin && password && (
                  <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <PasswordStrength password={password} />
                  </div>
                )}
              </div>

              {/* Confirm Password - Only for Signup */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white text-sm font-medium">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                      }}
                      className={`h-12 pl-12 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-white/10 rounded-xl ${errors.confirmPassword ? 'border-destructive' : ''}`}
                      maxLength={72}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                    )}
                    {/* Password match indicator */}
                    {confirmPassword && password && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {password === confirmPassword ? (
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-base shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    {isLogin ? 'Sign in' : 'Create account'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle Mode */}
            <p className="text-center text-sm text-white/60 mt-6">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-white hover:underline font-semibold transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            {/* Terms */}
            {!isLogin && (
              <p className="text-center text-xs text-white/50 mt-4">
                By creating an account, you agree to our{' '}
                <Link to="/terms" className="text-white/70 hover:underline">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-white/70 hover:underline">Privacy Policy</Link>
              </p>
            )}
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );
});

export default Auth;
