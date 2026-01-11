import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Film, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        // Don't reveal if email exists or not for security
        if (resetError.message.includes('rate limit')) {
          setError('Too many requests. Please wait a moment and try again.');
        } else {
          // Show success even if email doesn't exist to prevent enumeration
          setSubmitted(true);
        }
      } else {
        setSubmitted(true);
        toast.success('Check your email for the reset link');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-foreground mb-4">
            <Film className="w-7 h-7 text-background" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Reset Password
          </h1>
        </div>

        {submitted ? (
          <div className="p-8 rounded-2xl bg-muted border border-border text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Check Your Email</h2>
            <p className="text-muted-foreground mb-6">
              If an account exists with <strong className="text-foreground">{email}</strong>, 
              you'll receive a password reset link shortly.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Didn't receive an email? Check your spam folder or try again in a few minutes.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => setSubmitted(false)}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
              <Link to="/auth" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-8 rounded-2xl bg-muted border border-border">
              <p className="text-muted-foreground text-sm mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

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
                      setError(null);
                    }}
                    className="h-12 pl-12 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/20 rounded-xl"
                    maxLength={255}
                    required
                  />
                </div>
                {error && (
                  <p className="text-destructive text-xs mt-1">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-6 bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-xl"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </div>

            <div className="text-center">
              <Link 
                to="/auth" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
