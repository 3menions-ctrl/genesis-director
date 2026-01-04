import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Film, Mail, Lock, Loader2, Sparkles } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      // If onboarding not completed, go to onboarding
      if (!profile.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/projects');
      }
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { signIn, signUp } = await import('@/contexts/AuthContext').then(m => {
      // We need to get signIn and signUp from context
      return { signIn: null, signUp: null };
    });
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    // Email validation
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
          // Navigation will happen via useEffect when user/profile loads
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
          // Will redirect to onboarding via useEffect
        }
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, hsl(262 35% 15%) 0%, hsl(262 40% 8%) 100%)'
    }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            AI Film Studio
          </h1>
          <p className="text-violet-300/70">
            {isLogin ? 'Welcome back, creator' : 'Start your filmmaking journey'}
          </p>
        </div>

        {/* Form Card */}
        <div className="card-dark p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-violet-200 text-sm">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-violet-400/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-violet-200 text-sm">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-violet-400/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                'Sign In'
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
            <p className="text-violet-300/60 text-sm">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Free credits callout for signup */}
          {!isLogin && (
            <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 font-medium text-sm">50 Free Credits</p>
                  <p className="text-emerald-400/60 text-xs">Start creating instantly</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
