import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

import { usePageMeta } from '@/hooks/usePageMeta';
const emailSchema = z.string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

export default function ForgotPassword() {
  usePageMeta({ title: "Forgot password — Small Bridges", description: "Reset your Small Bridges password by email." });

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = emailSchema.safeParse(email);
    if (!result.success) { setError(result.error.errors[0].message); return; }

    setLoading(true);
    try {
      // Send the recovery link straight to /reset-password. The page does
      // the token exchange itself for every Supabase URL shape (hash,
      // token_hash, PKCE code), so we don't need a separate callback round
      // trip — fewer moving parts means fewer ways to land on a blank page.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetError) {
        if (resetError.message.includes('rate limit')) {
          setError('Too many requests. Please wait a moment.');
        } else {
          setSubmitted(true);
        }
      } else {
        setSubmitted(true);
        toast.success('Check your email for the reset link');
      }
    } catch { setError('Something went wrong. Please try again.'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(240,10%,4%)] relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/6 blur-[180px]" />
      </div>

      <motion.div 
        className="w-full max-w-[420px] relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex mb-4">
            <Logo size="xl" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-white/75 text-sm mt-2">We'll send you a recovery link</p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.10] to-white/[0.03] p-px">
            <div className="w-full h-full rounded-3xl bg-[hsl(240,10%,6%)]/90 backdrop-blur-xl" />
          </div>
          
          <div className="relative p-8">
            {submitted ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-white mb-2">Check Your Email</h2>
                <p className="text-white/50 text-sm mb-1">
                  If an account exists with <span className="text-white font-medium">{email}</span>, you'll receive a reset link.
                </p>
                <div className="flex items-start gap-2 text-left rounded-xl bg-glass border border-white/[0.06] px-3.5 py-2.5 mt-4 mb-2 max-w-xs mx-auto">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Links arrive in under a minute. If you don't see it, check your <span className="text-white/80 font-medium">Spam</span> or <span className="text-white/80 font-medium">Promotions</span> folder.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button onClick={() => setSubmitted(false)} variant="outline"
                    className="w-full h-11 rounded-xl border-white/[0.08] text-white hover:bg-glass-hover">
                    Try Again
                  </Button>
                  <Link to="/auth" className="block">
                    <Button variant="ghost" className="w-full h-11 rounded-xl text-white/50 hover:text-white">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    Email address
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/65 group-focus-within:text-primary/70 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      className={cn(
                        "h-12 pl-11 bg-glass-hover border-white/[0.08] text-white placeholder:text-white/25",
                        "focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
                      )}
                      maxLength={255}
                      required
                    />
                  </div>
                  {error && <p className="text-destructive text-xs">{error}</p>}
                </div>

                <Button type="submit" disabled={loading}
                  className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-2xl font-semibold text-sm shadow-lg shadow-white/5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/auth" className="text-xs text-white/65 hover:text-white/60 transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
