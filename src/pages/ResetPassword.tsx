import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { useSafeNavigation } from '@/lib/navigation';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be less than 72 characters');

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const { navigate } = useSafeNavigation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (type === 'recovery' && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        });
        setIsValidSession(!error);
        if (error) setError('This password reset link has expired or is invalid.');
      } else if (session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
        setError('No valid reset session found. Please request a new link.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = passwordSchema.safeParse(password);
    if (!result.success) { setError(result.error.errors[0].message); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError('Failed to update password. Please try again.'); }
      else { setSuccess(true); toast.success('Password updated!'); setTimeout(() => navigate('/auth'), 3000); }
    } catch { setError('Something went wrong.'); } 
    finally { setLoading(false); }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(240,10%,4%)]">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(240,10%,4%)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] rounded-full bg-primary/6 blur-[180px]" />
      </div>

      <motion.div 
        className="w-full max-w-[420px] relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex mb-4"><Logo size="xl" /></div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">
            {success ? 'All set!' : 'New Password'}
          </h1>
        </div>

        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.10] to-white/[0.03] p-px">
            <div className="w-full h-full rounded-3xl bg-[hsl(240,10%,6%)]/90 backdrop-blur-xl" />
          </div>
          
          <div className="relative p-8">
            {success ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-white mb-2">Password Updated!</h2>
                <p className="text-white/50 text-sm mb-6">Redirecting to sign in...</p>
                <Link to="/auth">
                  <Button className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm">
                    Go to Sign In
                  </Button>
                </Link>
              </motion.div>
            ) : !isValidSession ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-5">
                  <Lock className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-display font-bold text-white mb-2">Invalid Link</h2>
                <p className="text-white/50 text-sm mb-6">{error}</p>
                <Link to="/forgot-password">
                  <Button className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm">
                    Request New Link
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-white/40 text-sm mb-2">Choose a strong password for your account.</p>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    New Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary/70 transition-colors" />
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pl-11 pr-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
                      maxLength={72} required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    Confirm Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary/70 transition-colors" />
                    <Input id="confirmPassword" type="password" placeholder="••••••••"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
                      maxLength={72} required
                    />
                    {confirmPassword && password && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className={cn("w-2 h-2 rounded-full", password === confirmPassword ? "bg-emerald-400" : "bg-destructive")} />
                      </div>
                    )}
                  </div>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                <Button type="submit" disabled={loading}
                  className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-2xl font-semibold text-sm shadow-lg shadow-white/5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/auth" className="text-xs text-white/30 hover:text-white/60 transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
