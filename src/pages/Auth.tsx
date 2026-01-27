import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Film, Mail, Lock, Loader2, Sparkles, Play, User, ArrowRight, Zap } from 'lucide-react';
import { z } from 'zod';
import { PasswordStrength } from '@/components/ui/password-strength';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

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

export default function Auth() {
  const navigate = useNavigate();
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
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
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
          toast.success('Account created! Let\'s set up your profile.');
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
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

      {/* Left Side - Branding Content */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10">
        {/* Content */}
        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl">
                <span className="text-2xl font-display font-bold text-white">AS</span>
              </div>
              <span className="text-2xl font-display font-bold text-white">Apex Studio</span>
            </div>

            {/* Hero text */}
            <h1 className="text-6xl xl:text-7xl font-display font-bold text-white leading-[1.1] mb-8">
              Create<br />
              <span className="text-white/50">cinematic</span><br />
              videos
            </h1>
            <p className="text-xl text-white/60 max-w-md leading-relaxed">
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
                    ? 'bg-white/10 backdrop-blur-xl border border-white/20' 
                    : 'bg-white/5 backdrop-blur-sm border border-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  feature.highlight ? 'bg-white text-black' : 'bg-white/10 text-white'
                }`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className={`font-medium ${feature.highlight ? 'text-white' : 'text-white/70'}`}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Credits callout */}
          <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <Film className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg">Start Free</p>
                <p className="text-white/50 text-sm">60 credits • No card required</p>
              </div>
              <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <span className="text-white font-bold text-sm">1 clip</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        {/* Transparent container */}
        <div className="w-full max-w-md relative">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 mb-4 shadow-lg">
              <span className="text-2xl font-display font-bold text-white">AS</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              Apex Studio
            </h1>
          </div>

          {/* Glass container for form */}
          <div className="relative p-8 sm:p-10 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
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
          </div>
        </div>
      </div>
    </div>
  );
}
