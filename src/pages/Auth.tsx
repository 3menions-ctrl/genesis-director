import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Film, Mail, Lock, Loader2, Sparkles, Play, User, ArrowRight, Zap } from 'lucide-react';
import { z } from 'zod';
import { PasswordStrength } from '@/components/ui/password-strength';

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
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const authFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signupFormSchema = z.object({
  email: emailSchema,
  password: signupPasswordSchema,
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signIn, signUp, signInWithGoogle } = useAuth();
  
  // Check URL params for mode (from creation teaser)
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const fromCreate = searchParams.get('from') === 'create';
  const modeParam = searchParams.get('mode');
  
  const [isLogin, setIsLogin] = useState(modeParam !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; terms?: string }>({});
  const [hasRedirected, setHasRedirected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [hasPendingCreation, setHasPendingCreation] = useState(false);

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
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // Only redirect once
    if (hasRedirected) return;
    
    if (user && profile) {
      setHasRedirected(true);
      if (!profile.onboarding_completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/projects', { replace: true });
      }
    }
  }, [user, profile, authLoading, hasRedirected, navigate]);

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

    // Check terms agreement for signup
    if (!isLogin && !agreedToTerms) {
      setErrors(prev => ({ ...prev, terms: 'You must agree to the Terms of Service and Privacy Policy' }));
      toast.error('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      
      if (isLogin) {
        // Use signIn from AuthContext for consistency
        const { error } = await signIn(trimmedEmail, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
        }
      } else {
        // Use signUp from AuthContext for consistency (standardized redirect URL)
        const { error } = await signUp(trimmedEmail, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Try logging in instead.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created! Let\'s set up your profile.');
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || 'Failed to sign in with Google');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Stunning Visual Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute -bottom-32 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/30 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          
          {/* Grid pattern overlay */}
          <div 
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />
          
          {/* Floating shapes */}
          <div className="absolute top-20 right-20 w-16 h-16 border-2 border-white/20 rounded-2xl rotate-12 animate-float" />
          <div className="absolute bottom-32 left-16 w-12 h-12 border-2 border-white/20 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-1/2 right-32 w-8 h-8 bg-white/10 rounded-lg rotate-45 animate-float" style={{ animationDelay: '1s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-2xl">
                <span className="text-2xl font-display font-bold text-white">AS</span>
              </div>
              <span className="text-2xl font-display font-bold text-white">Apex Studio</span>
            </div>

            {/* Hero text */}
            <h1 className="text-6xl xl:text-7xl font-display font-bold text-white leading-[1.1] mb-8">
              Create<br />
              <span className="text-white/60">cinematic</span><br />
              videos
            </h1>
            <p className="text-xl text-white/70 max-w-md leading-relaxed">
              Transform your ideas into stunning video content with our AI-powered generation platform.
            </p>
          </div>

          {/* Features with glass cards */}
          <div className="space-y-3 mb-8">
            {[
              { icon: Zap, text: 'AI-powered script generation', highlight: true },
              { icon: Play, text: 'Text & image to video' },
              { icon: Sparkles, text: 'Smart retry system' },
            ].map((feature, i) => (
              <div 
                key={i} 
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  feature.highlight 
                    ? 'bg-white/20 backdrop-blur-xl border border-white/30' 
                    : 'bg-white/5 backdrop-blur-sm border border-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  feature.highlight ? 'bg-white text-primary' : 'bg-white/10 text-white'
                }`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className={`font-medium ${feature.highlight ? 'text-white' : 'text-white/80'}`}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Credits callout */}
          <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center border border-white/30">
                <Film className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg">Start Free</p>
                <p className="text-white/60 text-sm">60 credits • No card required</p>
              </div>
              <div className="px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                <span className="text-white font-bold text-sm">1 clip</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-32 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />
        </div>

        {/* Transparent container */}
        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-lg shadow-primary/25">
              <span className="text-2xl font-display font-bold text-white">AS</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Apex Studio
            </h1>
          </div>

          {/* Glass container for form */}
          <div className="relative p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-primary/[0.03] via-primary/[0.02] to-transparent backdrop-blur-xl border border-primary/10 shadow-xl">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-accent/10 rounded-3xl blur-xl opacity-50 -z-10" />
            
            {/* Pending Creation Banner */}
            {hasPendingCreation && !isLogin && (
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Film className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Your video is ready to create!</p>
                    <p className="text-xs text-muted-foreground">Sign up to bring your vision to life</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {hasPendingCreation && !isLogin ? 'Almost there!' : isLogin ? 'Welcome back' : 'Get started'}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2">
                {isLogin ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-muted-foreground">
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
              <Label htmlFor="email" className="text-foreground text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  className={`h-12 pl-12 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/20 rounded-xl ${errors.email ? 'border-destructive' : ''}`}
                  maxLength={255}
                />
                {errors.email && (
                  <p className="text-destructive text-xs mt-1">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground text-sm font-medium">
                  Password
                </Label>
                {isLogin && (
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                  }}
                  className={`h-12 pl-12 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/20 rounded-xl ${errors.password ? 'border-destructive' : ''}`}
                  maxLength={72}
                />
                {errors.password && (
                  <p className="text-destructive text-xs mt-1">{errors.password}</p>
                )}
              </div>
            {!isLogin && password && (
                <div className="mt-3 p-3 rounded-lg bg-muted border border-border">
                  <PasswordStrength password={password} />
                </div>
              )}
            </div>

            {/* Terms Agreement Checkbox - Only for Signup */}
            {!isLogin && (
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => {
                      setAgreedToTerms(checked === true);
                      if (errors.terms) setErrors(prev => ({ ...prev, terms: undefined }));
                    }}
                    className={`mt-0.5 ${errors.terms ? 'border-destructive' : ''}`}
                  />
                  <Label 
                    htmlFor="terms" 
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    I agree to the{' '}
                    <Link to="/terms" className="text-foreground hover:text-foreground/80 underline underline-offset-2">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-foreground hover:text-foreground/80 underline underline-offset-2">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>
                {errors.terms && (
                  <p className="text-destructive text-xs ml-7">{errors.terms}</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (!isLogin && !agreedToTerms)}
              className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-xl shadow-lg shadow-foreground/10 transition-all hover:shadow-xl hover:shadow-foreground/15 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>

            {/* Google Sign In - Hidden until configured */}
            {/* 
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 text-muted-foreground">or continue with</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-12 bg-background hover:bg-muted border-border text-foreground font-medium rounded-xl transition-all"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
            */}
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-foreground hover:text-foreground/80 font-semibold transition-colors"
              >
                {isLogin ? 'Sign up for free' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Free credits callout for signup */}
          {!isLogin && (
            <div className="mt-6 p-4 rounded-2xl bg-muted border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-background" />
                </div>
                <div>
                  <p className="text-foreground font-semibold">60 Free Credits</p>
                  <p className="text-muted-foreground text-sm">Enough for 1 video clip</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer inside glass container */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-foreground hover:text-foreground/80">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-foreground hover:text-foreground/80">Privacy Policy</a>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
