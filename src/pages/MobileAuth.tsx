/**
 * MobileAuth — the native sign-in / sign-up screen. Email + password with a
 * magic-link fallback (the methods AuthContext exposes). Premium, borderless,
 * floating glass over the Aurora backdrop.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Loader2, Wand2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';

type Mode = 'signin' | 'signup';

export default function MobileAuth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | 'magic' | 'confirm'>(null);

  // Already signed in → into the app.
  useEffect(() => { if (user) navigate('/feed', { replace: true }); }, [user, navigate]);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const submit = async () => {
    if (loading) return;
    if (!validEmail) { toast.error('Enter a valid email'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    void hapticTap();
    setLoading(true);
    try {
      const { error } = mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      if (error) { toast.error(error.message || 'Something went wrong'); return; }
      if (mode === 'signup') { setSent('confirm'); return; } // auto-redirects via effect if session is created
      // signin success → the user effect redirects.
    } finally { setLoading(false); }
  };

  const magic = async () => {
    if (loading) return;
    if (!validEmail) { toast.error('Enter your email first'); return; }
    void hapticTap();
    setLoading(true);
    try {
      const { error } = await signInWithMagicLink(email.trim());
      if (error) { toast.error(error.message || 'Could not send link'); return; }
      setSent('magic');
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
        <AuroraBackdrop />
        <div className="msg-glass relative z-10 grid h-16 w-16 place-items-center rounded-3xl text-[#8fb4ff]"><MailCheck className="h-8 w-8" /></div>
        <h1 className="relative z-10 mt-6 text-[26px] font-light italic" style={{ fontFamily: 'Fraunces, serif' }}>Check your inbox</h1>
        <p className="relative z-10 mt-2 max-w-[280px] text-[14px] leading-relaxed text-white/60">
          {sent === 'magic' ? 'We emailed a one-tap sign-in link to' : 'Confirm your account from the link we sent to'} <span className="text-white/85">{email.trim()}</span>.
        </p>
        <button onClick={() => setSent(null)} className="relative z-10 mt-7 text-[13px] font-medium text-[#8fb4ff]">Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-7" style={{ paddingTop: 'var(--safe-top,0px)', paddingBottom: 'calc(var(--safe-bottom,0px) + 20px)' }}>
        {/* Brand */}
        <div className="mb-9 flex flex-col items-center text-center">
          <div className="msg-glass-accent grid h-14 w-14 place-items-center rounded-2xl"><Sparkles className="h-7 w-7 text-white" /></div>
          <h1 className="mt-4 text-[30px] font-light leading-none" style={{ fontFamily: 'Fraunces, serif' }}>Small Bridges</h1>
          <p className="mt-2 text-[13.5px] text-white/55">{mode === 'signin' ? 'Welcome back, director.' : 'Direct films from a single line.'}</p>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div className="msg-glass flex h-[54px] items-center gap-3 rounded-2xl px-4">
            <Mail className="h-[19px] w-[19px] text-white/45" strokeWidth={1.8} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="Email"
              className="flex-1 bg-transparent text-[15.5px] text-white outline-none placeholder:text-white/35" />
          </div>
          <div className="msg-glass flex h-[54px] items-center gap-3 rounded-2xl px-4">
            <Lock className="h-[19px] w-[19px] text-white/45" strokeWidth={1.8} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Password"
              className="flex-1 bg-transparent text-[15.5px] text-white outline-none placeholder:text-white/35" />
            <button onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="text-white/40">{showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button>
          </div>

          <button onClick={submit} disabled={loading}
            className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-[15.5px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_20px_44px_-14px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="h-[18px] w-[18px]" /></>}
          </button>

          <button onClick={magic} disabled={loading} className="msg-glass flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white/85 transition-transform active:scale-[0.99] disabled:opacity-50">
            <Wand2 className="h-[17px] w-[17px] text-[#8fb4ff]" /> Email me a sign-in link
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-7 text-center text-[13.5px] text-white/50">
          {mode === 'signin' ? "New to Small Bridges? " : 'Already have an account? '}
          <button onClick={() => { void hapticTap(); setMode((m) => (m === 'signin' ? 'signup' : 'signin')); }} className="font-semibold text-[#8fb4ff]">
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
