import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Film, Mail, Lock, Loader2, Sparkles, Play, User, ArrowRight, Zap } from 'lucide-react';
import { z } from 'zod';

// Validation schemas
const emailSchema = z.string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be less than 72 characters');

const authFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [hasRedirected, setHasRedirected] = useState(false);
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

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

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const { error } = await signIn('demo@aifilmstudio.com', 'demo123456');
      if (error) {
        toast.error('Demo login failed. Please try again.');
      } else {
        toast.success('Welcome to the demo!');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const result = authFormSchema.safeParse({ email: email.trim(), password });
    
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

    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: trimmedEmail, 
          password 
        });
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
        const redirectUrl = `${window.location.origin}/onboarding`;
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
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
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-foreground">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Film className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-white">AI Film Studio</span>
            </div>

            <h1 className="text-5xl font-display font-bold text-white leading-tight mb-6">
              Create stunning<br />
              <span className="text-white/70">AI-powered</span> films
            </h1>
            <p className="text-xl text-white/50 max-w-md">
              Transform your ideas into cinematic experiences with our intelligent filmmaking platform.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: Zap, text: 'Generate scripts with AI in seconds' },
              { icon: Play, text: 'Create videos from text prompts' },
              { icon: Sparkles, text: 'Professional-grade results' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/60">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <feature.icon className="w-4 h-4 text-white/80" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <p className="text-white/70 text-sm italic mb-4">
              "AI Film Studio completely transformed how I create content. What used to take days now takes minutes."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Alex Chen</p>
                <p className="text-white/40 text-xs">Content Creator</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-foreground mb-4">
              <Film className="w-7 h-7 text-background" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              AI Film Studio
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-foreground mb-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-muted-foreground">
              {isLogin ? 'Sign in to continue to your studio' : 'Start your filmmaking journey today'}
            </p>
          </div>

          {/* Demo Login Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="w-full mb-6 p-4 rounded-2xl bg-muted border border-border hover:border-foreground/20 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                  {demoLoading ? (
                    <Loader2 className="w-5 h-5 text-background animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 text-background" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Try Demo Account</p>
                  <p className="text-xs text-muted-foreground">Explore features without signing up</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground">or continue with email</span>
            </div>
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
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-xl shadow-lg shadow-foreground/10 transition-all hover:shadow-xl hover:shadow-foreground/15"
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
                  <p className="text-foreground font-semibold">50 Free Credits</p>
                  <p className="text-muted-foreground text-sm">Start creating amazing content instantly</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-foreground hover:text-foreground/80">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-foreground hover:text-foreground/80">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
