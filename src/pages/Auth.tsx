import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Film, Mail, Lock, Loader2, Sparkles, Play, User, ArrowRight, Zap } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (!profile.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/projects');
      }
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
          email,
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
    } catch (err) {
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-12 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/20 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground text-sm font-medium">
                  Password
                </Label>
                {isLogin && (
                  <button type="button" className="text-sm text-muted-foreground hover:text-foreground font-medium">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-12 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/20 rounded-xl"
                />
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
