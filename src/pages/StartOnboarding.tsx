import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  User, Briefcase, Building2, ArrowRight, ArrowLeft, Check, Sparkles,
  Film, Megaphone, Wand2, Crown, Gem, Loader2, X, ShieldCheck, Star, Quote,
  Mail, Lock, Eye, EyeOff, Palette, Users, Receipt, Target,
  Globe2, Tv, Music2, Camera, Pencil, Rocket,
} from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/Logo';
import { BetaHero } from '@/components/ui/BetaHero';
import { OAuthProviders } from '@/components/auth/OAuthProviders';
import { AuthOtpInput } from '@/components/auth/AuthOtpInput';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import heroPersonal from '@/assets/onboarding/hero-personal.jpg';
import heroBusiness from '@/assets/onboarding/hero-business.jpg';

import { usePageMeta } from '@/hooks/usePageMeta';
type AccountType = 'personal' | 'business' | 'enterprise';
type PlanKind = 'credits' | 'subscription' | 'contact';

interface Plan {
  id: string;
  kind: PlanKind;
  name: string;
  tagline: string;
  price: number;
  interval?: 'month' | 'year';
  credits?: number;
  features: string[];
  popular?: boolean;
  Icon: typeof Sparkles;
}

/* ───────── Plans ───────── */

const PERSONAL_PLANS: Plan[] = [
  { id: 'credits_mini', kind: 'credits', name: 'Mini', tagline: 'A short story',
    price: 9, credits: 90, Icon: Sparkles,
    features: ['1080p HD', 'AI script generator', 'All cinematic engines'] },
  { id: 'sub_creator_monthly', kind: 'subscription', name: 'Creator', tagline: 'Weekly creators',
    price: 19, interval: 'month', credits: 1000, Icon: Crown, popular: true,
    features: ['1,000 credits / month', '4K Ultra HD', 'Priority queue', 'Cancel anytime'] },
  { id: 'credits_growth', kind: 'credits', name: 'Growth', tagline: 'Ship every week',
    price: 99, credits: 1000, Icon: Gem,
    features: ['4K Ultra HD', 'Priority render queue', 'Multi-character dialogue'] },
];

const BUSINESS_PLANS: Plan[] = [
  { id: 'sub_pro_monthly', kind: 'subscription', name: 'Pro', tagline: 'Solo specialists',
    price: 49, interval: 'month', credits: 3000, Icon: Briefcase,
    features: ['3,000 credits / month', '4K HDR', 'API & webhooks', 'Priority support'] },
  { id: 'sub_studio_monthly', kind: 'subscription', name: 'Studio', tagline: 'In-house teams',
    price: 149, interval: 'month', credits: 10000, Icon: Crown, popular: true,
    features: ['10,000 credits / month', 'Up to 5 seats', 'Brand kit & presets', 'Account manager'] },
  { id: 'sub_business_monthly', kind: 'subscription', name: 'Business', tagline: 'Agency engines',
    price: 499, interval: 'month', credits: 35000, Icon: Building2,
    features: ['35,000 credits / month', '15 seats', 'Dedicated CSM', 'Slack support'] },
];

/* ───────── Steps ───────── */

// Personal onboarding is intentionally lean: pick a plan, create an account, verify.
// Taste/goals/channels/experience are collected later in Settings so first-run feels effortless.
const PERSONAL_STEPS = ['account', 'verify'] as const;
// The plan step only rendered the auto-claiming BetaFreePlanCard (no real
// choice), so it's dropped for business too — the "free to start (first 5-sec video on Wan)" value
// message now lives in the account step header.
const BUSINESS_STEPS = ['company', 'team', 'account', 'verify'] as const;

type StepKey = typeof PERSONAL_STEPS[number] | typeof BUSINESS_STEPS[number];

const STEP_META: Record<StepKey, { chapter: string; question: string; whisper: string }> = {
  company: { chapter: 'Chapter I', question: 'Introduce\nyour company.', whisper: 'A few firmographics so we can shape the workspace around you.' },
  team:    { chapter: 'Chapter II', question: 'Sketch out\nyour operation.', whisper: 'Team, role, monthly volume, brand voice — defaults baked in.' },
  account: { chapter: 'Chapter III', question: 'Make it\nofficial.', whisper: 'One step to start free — your first 5-second video is on us.' },
  verify:  { chapter: 'Chapter IV', question: 'Verify and\nstep inside.', whisper: 'Last step — confirm your email and your studio opens.' },
};

/* ───────── Vocab ───────── */

const PERSONAL_GOALS = [
  { id: 'social',   label: 'Short-form social', Icon: Film },
  { id: 'youtube',  label: 'YouTube content',   Icon: Tv },
  { id: 'music',    label: 'Music videos',      Icon: Music2 },
  { id: 'narrative',label: 'Narrative film',    Icon: Camera },
  { id: 'ads',      label: 'Ads & promos',      Icon: Megaphone },
  { id: 'passion',  label: 'Passion projects',  Icon: Sparkles },
  { id: 'learn',    label: 'Just exploring',    Icon: Wand2 },
  { id: 'other',    label: 'Something else',    Icon: Pencil },
];

const PERSONAL_STYLES = [
  { id: 'cinematic', label: 'Cinematic',  desc: 'Hollywood lighting, depth, drama' },
  { id: 'dreamy',    label: 'Dreamy',     desc: 'Soft, surreal, atmospheric' },
  { id: 'gritty',    label: 'Gritty',     desc: 'Hand-held, raw, documentary' },
  { id: 'animated',  label: 'Animated',   desc: 'Stylized, vibrant, motion-rich' },
];

const PERSONAL_CHANNELS = [
  { id: 'tiktok',   label: 'TikTok' },
  { id: 'reels',    label: 'Instagram Reels' },
  { id: 'shorts',   label: 'YouTube Shorts' },
  { id: 'youtube',  label: 'YouTube long-form' },
  { id: 'x',        label: 'X / Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'client',   label: 'Client work' },
  { id: 'personal', label: 'Personal / archive' },
];

const EXPERIENCE_LEVELS = [
  { id: 'first',    label: 'First-timer',    sub: 'Just curious' },
  { id: 'hobbyist', label: 'Hobbyist',       sub: 'I shoot for fun' },
  { id: 'creator',  label: 'Working creator',sub: 'I publish weekly' },
  { id: 'pro',      label: 'Pro filmmaker',  sub: 'Cinema is my craft' },
];

const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '201–1000', '1000+'];
const INDUSTRIES = [
  'Marketing & Ads', 'Media & Entertainment', 'E-commerce', 'Education',
  'Tech / SaaS', 'Gaming', 'Finance', 'Healthcare', 'Other',
];
const ROLES = [
  'Founder / CEO', 'Marketing lead', 'Creative director', 'Producer',
  'Designer', 'Developer', 'Operations', 'Other',
];

const BUSINESS_USE_CASES = [
  { id: 'ads',      label: 'Performance ads',     desc: 'Hooks, UGC, paid social',         Icon: Target },
  { id: 'social',   label: 'Organic social',      desc: 'TikTok, Reels, Shorts at scale',  Icon: Megaphone },
  { id: 'product',  label: 'Product marketing',   desc: 'Launches, demos, explainers',     Icon: Sparkles },
  { id: 'sales',    label: 'Sales enablement',    desc: 'Outbound, decks, personalized',   Icon: Briefcase },
  { id: 'training', label: 'Internal & training', desc: 'Onboarding, comms, L&D',          Icon: ShieldCheck },
  { id: 'agency',   label: 'Client deliverables', desc: 'Agency work, multi-brand',        Icon: Crown },
];

const BUSINESS_VOLUME = [
  { id: '< 10 / mo',   label: 'Under 10 / mo',   desc: 'Just getting started' },
  { id: '10–50 / mo',  label: '10–50 / mo',      desc: 'Steady weekly cadence' },
  { id: '50–250 / mo', label: '50–250 / mo',     desc: 'High-output content engine' },
  { id: '250+ / mo',   label: '250+ / mo',       desc: 'Industrial scale' },
];

const BRAND_VOICES = [
  { id: 'bold',         label: 'Bold & confident', desc: 'Big claims, strong stance' },
  { id: 'playful',      label: 'Playful',          desc: 'Light, witty, irreverent' },
  { id: 'premium',      label: 'Premium & refined',desc: 'Editorial, calm, cinematic' },
  { id: 'authoritative',label: 'Authoritative',    desc: 'Expert, informative, trusted' },
];

/* ───────── Schemas ───────── */

const accountSchema = z.object({
  display_name: z.string().trim().min(2, 'Tell us your name').max(100),
  email: z.string().trim().email('Enter a valid email').max(255),
  password: z.string().min(8, 'At least 8 characters').max(128),
});
const oauthAccountSchema = z.object({
  display_name: z.string().trim().min(2, 'Tell us your name').max(100),
});
const companySchema = z.object({
  company_name: z.string().trim().min(2, 'Company name required').max(160),
  industry: z.string().min(1, 'Pick an industry'),
});

/* =================================================================
 * Main Component
 * ================================================================= */

export default function StartOnboarding() {
  usePageMeta({ title: "Get started — Small Bridges", description: "Begin your Small Bridges onboarding." });

  const { navigate } = useSafeNavigation();
  const [params] = useSearchParams();
  const { user, signUp, signIn } = useAuth();
  const rawType = (params.get('type') || params.get('audience')) as AccountType | null;

  // Enterprise → coming soon (separate tier)
  useEffect(() => {
    if (rawType === 'enterprise') {
      navigate('/enterprise/coming-soon', { replace: true });
    }
  }, [rawType, navigate]);

  const initialType: AccountType = rawType === 'business' ? 'business' : 'personal';
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);
  const [intentToken, setIntentToken] = useState<string | null>(null);

  const [form, setForm] = useState({
    // Personal
    display_name: '',
    goals: [] as string[],
    style: '',
    channels: [] as string[],
    experience: '',
    // Plan
    selected_plan_id: '',
    selected_plan_kind: '' as PlanKind | '',
    // Business
    company_name: '',
    company_website: '',
    industry: '',
    primary_use_case: '',
    team_size: '',
    job_role: '',
    monthly_volume: '',
    brand_voice: '',
    // Account
    email: '',
    password: '',
    // Verify-step extras (business)
    invited_emails: [] as string[],
    invite_input: '',
    billing_email: '',
    vat_id: '',
  });

  const steps = useMemo<readonly StepKey[]>(
    () => (accountType === 'business' ? BUSINESS_STEPS : PERSONAL_STEPS),
    [accountType],
  );
  const currentStep = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const meta = STEP_META[currentStep];

  const plans: Plan[] = useMemo(
    () => (accountType === 'business' ? BUSINESS_PLANS : PERSONAL_PLANS),
    [accountType],
  );

  // Reset on audience swap
  useEffect(() => {
    setForm(f => ({ ...f, selected_plan_id: '', selected_plan_kind: '' as PlanKind | '' }));
    setStepIdx(0);
  }, [accountType]);

  // Post-OAuth landing. The intent token (persisted before the OAuth redirect
  // fires) is carried on the `next` URL so /onboarding consumes the same
  // onboarding intent after the round-trip. sessionStorage is the fallback.
  const oauthNext = useMemo(() => {
    const base = '/onboarding';
    return intentToken
      ? `${base}?intent=${encodeURIComponent(intentToken)}&audience=${accountType}`
      : `${base}?audience=${accountType}`;
  }, [intentToken, accountType]);

  /* ── Validation ────────────────────────────────────────────── */
  const validate = useCallback((): boolean => {
    setErrors({});
    const fe: Record<string, string> = {};

    if (currentStep === 'company') {
      const r = companySchema.safeParse({ company_name: form.company_name, industry: form.industry });
      if (!r.success) {
        r.error.errors.forEach(e => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
      }
      if (!form.primary_use_case) fe.primary_use_case = 'Pick a use case';
    }
    if (currentStep === 'team') {
      if (!form.team_size) fe.team_size = 'Pick a team size';
      if (!form.job_role) fe.job_role = 'Pick a role';
      if (!form.monthly_volume) fe.monthly_volume = 'Pick a volume';
      if (!form.brand_voice) fe.brand_voice = 'Pick a voice';
    }
    if (currentStep === 'account') {
      if (user) {
        const r = oauthAccountSchema.safeParse({ display_name: form.display_name });
        if (!r.success) fe.display_name = r.error.errors[0].message;
      } else {
        const r = accountSchema.safeParse({
          display_name: form.display_name,
          email: form.email,
          password: form.password,
        });
        if (!r.success) {
          r.error.errors.forEach(e => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
        }
      }
    }
    if (currentStep === 'verify' && !user && (otpCode.length < 6 || otpCode.length > 8)) {
      fe.otp = 'Enter the verification code from your email';
    }

    if (Object.keys(fe).length) { setErrors(fe); return false; }
    return true;
  }, [currentStep, form, user, otpCode]);

  /* ── Persistence ───────────────────────────────────────────── */
  const ensureIntentPersisted = async (): Promise<string | null> => {
    if (intentToken) return intentToken;
    const token = `int_${crypto.randomUUID()}`;
    const payload = {
      intent_token: token,
      account_type: accountType,
      selected_plan_id: form.selected_plan_id || null,
      selected_plan_kind: (form.selected_plan_kind || null) as PlanKind | null,
      goals: form.goals.length ? form.goals : null,
      content_goals: form.goals.length ? form.goals : null,
      experience_level: form.experience || null,
      current_tools: form.channels.length ? form.channels : null,
      display_name: form.display_name || null,
      company_name: form.company_name || null,
      industry: form.industry || null,
      team_size: form.team_size || null,
      job_role: form.job_role || null,
      primary_use_case: form.primary_use_case || null,
      monthly_volume: form.monthly_volume || null,
      brand_voice: form.brand_voice || null,
      billing_email: form.billing_email || null,
      vat_id: form.vat_id || null,
      invited_emails: form.invited_emails.length ? form.invited_emails : null,
    };
    const { error } = await supabase.from('onboarding_intents').insert(payload);
    if (error) {
      console.error('[start] intent persist', error);
      toast.error('Could not save your choices. Please try again.');
      return null;
    }
    try { sessionStorage.setItem('smallbridges.intent_token', token); } catch {}
    try { localStorage.setItem('smallbridges.audience', accountType); } catch {}
    setIntentToken(token);
    return token;
  };

  const persistIntentAndConsume = async () => {
    const token = await ensureIntentPersisted();
    if (!token) return;
    try { await supabase.rpc('consume_onboarding_intent', { p_intent_token: token }); }
    catch (e) { console.warn('[start] consume_onboarding_intent', e); }
  };

  // Eagerly persist the onboarding intent the moment an unauthenticated user
  // lands on the account step, so OAuth (which redirects away immediately on
  // click) can carry the token on its `next` URL.
  const eagerPersistTried = useRef(false);
  useEffect(() => {
    if (currentStep !== 'account' || user || intentToken || eagerPersistTried.current) return;
    eagerPersistTried.current = true;
    void ensureIntentPersisted();
    // ensureIntentPersisted is a stable closure for this purpose; we only want
    // this to run once when the account step is first reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, user, intentToken]);

  /* ── OTP verify (shared by the footer button + auto-submit) ──── */
  const submitVerify = async (code: string) => {
    if (submitting) return;
    if (code.length < 6) { setErrors({ otp: 'Enter the verification code from your email' }); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: form.email.trim(), token: code, type: 'signup',
      });
      if (error) { toast.error(error.message || 'Invalid code.'); return; }
      toast.success('Email verified.');
      await persistIntentAndConsume();
      void finish();
    } finally { setSubmitting(false); }
  };

  /* ── Navigation ────────────────────────────────────────────── */
  const next = async () => {
    if (!validate()) return;

    if (currentStep === 'account') {
      // OAuth / already-authenticated users have no email to verify — skip the
      // verify step entirely and drop them straight into the studio.
      if (user) {
        await persistIntentAndConsume();
        void finish();
        return;
      }
      setSubmitting(true);
      try {
        const token = await ensureIntentPersisted();
        if (!token) return;
        const { error } = await signUp(form.email.trim(), form.password);
        if (error) {
          if (/already.*registered/i.test(error.message)) {
            const { error: siErr } = await signIn(form.email.trim(), form.password);
            if (siErr) { toast.error('That email is already registered — wrong password?'); return; }
            await persistIntentAndConsume();
            void finish();
            return;
          }
          toast.error(error.message || 'Could not create your account.');
          return;
        }
        toast.success('Check your email — we sent a 6-digit code.');
        setDirection(1); setStepIdx(i => i + 1);
      } finally { setSubmitting(false); }
      return;
    }

    if (currentStep === 'verify') {
      if (user) { await persistIntentAndConsume(); void finish(); return; }
      await submitVerify(otpCode);
      return;
    }

    if (isLast) { void finish(); return; }
    setDirection(1); setStepIdx(i => i + 1);
  };

  const back = () => {
    if (stepIdx === 0) { navigate('/'); return; }
    setDirection(-1); setStepIdx(i => i - 1);
  };

  /* ── Finish ────────────────────────────────────────────────── */
  const finish = async () => {
    setSubmitting(true);
    try {
      const token = await ensureIntentPersisted();
      if (!token) return;
      await persistIntentAndConsume();

      // Business: send invites best-effort
      if (accountType === 'business' && form.invited_emails.length > 0 && user) {
        try {
          const { data: orgs } = await supabase
            .from('organizations').select('id')
            .eq('created_by', user.id)
            .order('created_at', { ascending: true })
            .limit(1);
          const orgId = orgs?.[0]?.id;
          if (orgId) {
            const inviteRows = form.invited_emails.map(email => ({
              organization_id: orgId, email, role: 'producer' as const,
              invited_by: user.id, token: `inv_${crypto.randomUUID()}`,
              expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            }));
            await supabase.from('organization_invites').insert(inviteRows);
          }
        } catch (e) { console.warn('[start] invites', e); }
      }

      const target = form.selected_plan_id
        ? `/welcome/checkout?plan=${form.selected_plan_id}`
        : '/create';

      if (!user) {
        navigate(`/auth?mode=signup&intent=${token}&audience=${accountType}&next=${encodeURIComponent(target)}`);
        return;
      }
      navigate(target, { replace: true });
    } catch (e) {
      console.error('[start] finish', e);
      toast.error((e as Error)?.message ?? 'Could not save your choices.');
    } finally { setSubmitting(false); }
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[hsl(220,14%,2%)] text-white">
      <CinematicBackdrop accountType={accountType} stepKey={currentStep} />

      {/* Top bar */}
      <header className="relative z-30 flex items-center justify-between px-6 md:px-10 pt-6">
        <Logo size="md" showText textClassName="text-base font-bold tracking-tight" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher
            variant="ghost" size="sm" showLabel
            className="h-9 px-3 text-white/65 hover:text-white bg-glass-hover hover:bg-glass-active border border-white/[0.06] backdrop-blur-xl rounded-full"
          />
          <button
            onClick={() => navigate('/')}
            aria-label="Close"
            className="w-9 h-9 inline-flex items-center justify-center rounded-full text-white/65 hover:text-white hover:bg-glass-active backdrop-blur-md border border-white/[0.06] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Audience toggle (only on first step, only when not auth'd) */}
      {stepIdx === 0 && !user && (
        <div className="relative z-30 flex justify-center mt-6">
          <AudienceSwitch value={accountType} onChange={setAccountType} />
        </div>
      )}

      {/* Chapter bar */}
      <div className="relative z-30 max-w-3xl mx-auto px-6 mt-10 md:mt-12">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-[0.32em] uppercase text-primary/60/85 font-sans font-medium">
            {meta.chapter} · {accountType}
          </p>
          <p className="text-[10px] tracking-[0.32em] uppercase text-white/40 font-sans font-medium">
            {String(stepIdx + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => {
            const filled = i <= stepIdx;
            const active = i === stepIdx;
            return (
              <div key={s} className="relative flex-1 h-[2px] rounded-full overflow-hidden bg-glass-active">
                <motion.div
                  className="h-full origin-left"
                  style={{ background: filled ? 'linear-gradient(90deg, #0A84FF, #5AC8FA)' : 'transparent' }}
                  initial={false}
                  animate={{ scaleX: filled ? 1 : 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
                {active && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-y-0 w-10 -translate-x-full"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)', filter: 'blur(2px)' }}
                    animate={{ x: ['-40px', '180px'] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Question */}
      <div className="relative z-30 max-w-3xl mx-auto px-6 mt-10 md:mt-14 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`q-${accountType}-${currentStep}`}
            initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="font-display text-[44px] md:text-[68px] leading-[0.96] tracking-[-0.035em] font-light whitespace-pre-line">
              {meta.question.split(' ').map((word, i) => (
                <motion.span
                  key={`${currentStep}-${i}`}
                  className="inline-block mr-[0.22em]"
                  initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word.includes('\n') ? (
                    <>
                      {word.split('\n').map((part, idx, arr) => (
                        <span key={idx}>
                          {idx === 0 ? part : <><br />{part}</>}
                        </span>
                      ))}
                    </>
                  ) : word}
                </motion.span>
              ))}
            </h1>
            <p className="mt-5 text-[14px] md:text-[15px] text-white/55 font-sans max-w-xl mx-auto leading-relaxed">
              {meta.whisper}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step content */}
      <main className="relative z-30 max-w-3xl mx-auto px-6 mt-10 md:mt-14 pb-40">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`step-${accountType}-${currentStep}`}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 40 : -40, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: direction > 0 ? -40 : 40, filter: 'blur(8px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="font-sans"
          >
            {/* BUSINESS · COMPANY */}
            {currentStep === 'company' && (
              <div className="space-y-10">
                <Block label="The basics">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Company name" error={errors.company_name}>
                      <input
                        autoFocus
                        placeholder="Acme Studios"
                        value={form.company_name}
                        onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Industry" error={errors.industry}>
                      <select
                        value={form.industry}
                        onChange={(e) => setForm(f => ({ ...f, industry: e.target.value }))}
                        className={cn(inputCls, 'appearance-none')}
                      >
                        <option value="">Select industry…</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Website (optional)">
                      <div className="relative">
                        <Globe2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                        <input
                          placeholder="acmestudios.com"
                          value={form.company_website}
                          onChange={(e) => setForm(f => ({ ...f, company_website: e.target.value }))}
                          className={cn(inputCls, 'pl-10')}
                        />
                      </div>
                    </Field>
                  </div>
                </Block>

                <Block label="What will your team produce?" hint="Pick the closest match">
                  <ChipGrid
                    options={BUSINESS_USE_CASES.map(u => ({ id: u.id, label: u.label, desc: u.desc, Icon: u.Icon }))}
                    selected={form.primary_use_case ? [form.primary_use_case] : []}
                    onToggle={(id) => setForm(f => ({ ...f, primary_use_case: f.primary_use_case === id ? '' : id }))}
                    error={errors.primary_use_case}
                  />
                </Block>
              </div>
            )}

            {/* BUSINESS · TEAM */}
            {currentStep === 'team' && (
              <div className="space-y-10">
                <Block label="Team size">
                  <PillGrid
                    options={TEAM_SIZES.map(s => ({ id: s, label: s }))}
                    selected={form.team_size ? [form.team_size] : []}
                    onToggle={(id) => setForm(f => ({ ...f, team_size: f.team_size === id ? '' : id }))}
                    error={errors.team_size}
                  />
                </Block>

                <Block label="Your role">
                  <PillGrid
                    options={ROLES.map(r => ({ id: r, label: r }))}
                    selected={form.job_role ? [form.job_role] : []}
                    onToggle={(id) => setForm(f => ({ ...f, job_role: f.job_role === id ? '' : id }))}
                    error={errors.job_role}
                  />
                </Block>

                <Block label="Monthly clip volume" hint="So we can size your render lane">
                  <RadioCards
                    options={BUSINESS_VOLUME}
                    selected={form.monthly_volume}
                    onSelect={(id) => setForm(f => ({ ...f, monthly_volume: id }))}
                    error={errors.monthly_volume}
                  />
                </Block>

                <Block label="Brand voice" hint="We'll bias scripts and edits toward this">
                  <RadioCards
                    options={BRAND_VOICES}
                    selected={form.brand_voice}
                    onSelect={(id) => setForm(f => ({ ...f, brand_voice: id }))}
                    error={errors.brand_voice}
                  />
                </Block>
              </div>
            )}

            {/* ACCOUNT */}
            {currentStep === 'account' && (
              <div className="space-y-5 max-w-md mx-auto">
                {/* Free-to-start value strip — folded in from the retired plan step. */}
                <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-3 text-center">
                  <Gem className="w-4 h-4 text-emerald-300 shrink-0" />
                  <p className="text-[12.5px] text-white/75 leading-snug">
                    <span className="text-emerald-300 font-semibold">Your first 5-second video is free</span> — generated on Wan, no card, no checkout.
                  </p>
                </div>

                {!user && (
                  <>
                    <OAuthProviders next={oauthNext} />
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] uppercase tracking-[0.28em] text-white/40 font-medium">or continue with email</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  </>
                )}

                <Field label="Your name" error={errors.display_name}>
                  <input
                    placeholder="Jordan Lin"
                    value={form.display_name}
                    onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                    className={inputCls}
                  />
                </Field>

                {user ? (
                  <div className="rounded-2xl border border-white/10 bg-glass p-5 flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary/60" />
                    <div className="text-sm">
                      <p className="font-medium">Signed in as {user.email}</p>
                      <p className="text-white/45 text-xs mt-0.5">Continue to wrap up.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Field label="Email" error={errors.email}>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                        <input
                          type="email" autoComplete="email"
                          placeholder="you@example.com"
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          className={cn(inputCls, 'pl-10')}
                        />
                      </div>
                    </Field>
                    <Field label="Password" error={errors.password}>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                          placeholder="At least 8 characters"
                          value={form.password}
                          onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                          className={cn(inputCls, 'pl-10 pr-11')}
                        />
                        <button
                          type="button" onClick={() => setShowPassword(s => !s)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-glass-active transition"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>

                    <p className="text-[11px] text-white/55 leading-relaxed">
                      By continuing you agree to our Terms and Privacy Policy. We'll send a 6-digit code to verify your email.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* VERIFY */}
            {currentStep === 'verify' && (
              <div className="space-y-8 max-w-lg mx-auto">
                {user ? (
                  <div className="rounded-2xl border border-white/10 bg-glass p-5 flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary/60" />
                    <div className="text-sm">
                      <p className="font-medium">Verified.</p>
                      <p className="text-white/45 text-xs mt-0.5">Continue to finish.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <p className="text-sm text-white/65 text-center">
                      Code sent to <span className="text-white font-medium">{form.email}</span>
                    </p>
                    <AuthOtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      onComplete={(full) => { void submitVerify(full); }}
                      disabled={submitting}
                    />
                    {errors.otp && <p className="text-[11px] text-rose-400 text-center">{errors.otp}</p>}
                    <div className="text-center space-y-3">
                      <div className="flex items-start gap-2 text-left rounded-xl bg-glass border border-white/[0.06] px-3.5 py-2.5 max-w-sm mx-auto">
                        <Mail className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-[11px] text-white/60 leading-relaxed">
                            Codes arrive in under a minute. If you don't see it, check your <span className="text-white/80 font-medium">Spam</span> or <span className="text-white/80 font-medium">Promotions</span> folder.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={resending}
                        onClick={async () => {
                          setResending(true);
                          try {
                            const { error } = await supabase.auth.resend({ type: 'signup', email: form.email.trim() });
                            if (error) toast.error(error.message);
                            else toast.success('Code re-sent.');
                          } finally { setResending(false); }
                        }}
                        className="text-xs text-white/55 hover:text-white underline-offset-4 hover:underline disabled:opacity-50"
                      >
                        {resending ? 'Sending…' : 'Didn\u2019t get it? Resend code'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Business: optional invites + billing on the same final step */}
                {accountType === 'business' && (
                  <div className="pt-8 mt-2 border-t border-white/[0.06] space-y-6">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-primary/60/85 text-center">Optional · finalize later in workspace</p>

                    <div>
                      <Field label="Invite teammates by email">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                            <input
                              type="email"
                              placeholder="teammate@company.com"
                              value={form.invite_input}
                              onChange={(e) => setForm(f => ({ ...f, invite_input: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const v = form.invite_input.trim().toLowerCase();
                                  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !form.invited_emails.includes(v)) {
                                    setForm(f => ({ ...f, invited_emails: [...f.invited_emails, v], invite_input: '' }));
                                  }
                                }
                              }}
                              className={cn(inputCls, 'pl-10')}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const v = form.invite_input.trim().toLowerCase();
                              if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !form.invited_emails.includes(v)) {
                                setForm(f => ({ ...f, invited_emails: [...f.invited_emails, v], invite_input: '' }));
                              }
                            }}
                            className="h-12 px-5 rounded-xl bg-glass-active border border-white/10 text-sm font-medium hover:bg-white/[0.10] transition"
                          >Add</button>
                        </div>
                      </Field>
                      {form.invited_emails.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {form.invited_emails.map(em => (
                            <span key={em} className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full bg-glass-hover border border-white/10 text-xs">
                              {em}
                              <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, invited_emails: f.invited_emails.filter(x => x !== em) }))}
                                className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-white/[0.10]"
                                aria-label={`Remove ${em}`}
                              ><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Billing email">
                        <div className="relative">
                          <Receipt className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                          <input
                            type="email"
                            placeholder="ap@company.com"
                            value={form.billing_email}
                            onChange={(e) => setForm(f => ({ ...f, billing_email: e.target.value }))}
                            className={cn(inputCls, 'pl-10')}
                          />
                        </div>
                      </Field>
                      <Field label="VAT / Tax ID">
                        <input
                          placeholder="EU123456789"
                          value={form.vat_id}
                          onChange={(e) => setForm(f => ({ ...f, vat_id: e.target.value }))}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky footer nav */}
      <footer className="fixed bottom-0 inset-x-0 z-40 px-6 md:px-10 pb-6 pt-4 bg-gradient-to-t from-[hsl(220,14%,2%)] via-[hsla(220,14%,2%,0.85)] to-transparent backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={submitting}
            className="group inline-flex items-center gap-2 h-11 px-4 text-sm font-sans text-white/55 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> {stepIdx === 0 ? 'Exit' : 'Back'}
          </button>

          {currentStep === 'account' || currentStep === 'verify' ? (
            <div className="hidden md:flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2 text-[10px] tracking-[0.26em] uppercase text-white/40 font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300/70" />
                <span>Bank-grade encryption · No card required · Cancel anytime</span>
              </div>
              <div className="flex items-center gap-1 text-white/40">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 text-amber-300 fill-amber-300" />
                ))}
                <span className="ml-1.5 text-[10px] tracking-[0.2em] uppercase text-white/35 font-sans">Encrypted · we never share your email</span>
              </div>
            </div>
          ) : (
            <p className="hidden md:block text-[10px] tracking-[0.28em] uppercase text-white/35 font-sans">
              Saved automatically as you go
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onClick={next}
            disabled={submitting}
            className="group relative inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold text-white overflow-hidden disabled:opacity-60 font-sans"
            style={{
              background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
              boxShadow: '0 10px 40px -8px hsla(212,100%,55%,0.55), 0 0 0 1px hsla(212,100%,75%,0.25) inset',
            }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-16 -translate-x-full pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }}
              animate={{ x: ['-80px', '320px'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            />
            <span className="relative inline-flex items-center gap-2">
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : currentStep === 'account'
                  ? <>{user ? 'Continue' : 'Create account'} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                  : currentStep === 'verify'
                    ? <>{user ? 'Step inside' : 'Verify & enter'} <Rocket className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                    : isLast
                      ? <>Continue to checkout <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                      : <>Continue <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>}
            </span>
          </motion.button>
        </div>
      </footer>
    </div>
  );
}

/* =================================================================
 * Cinematic Backdrop — full-bleed, morphs per step + audience
 * ================================================================= */

function CinematicBackdrop({ accountType, stepKey }: { accountType: AccountType; stepKey: StepKey }) {
  const img = accountType === 'business' ? heroBusiness : heroPersonal;

  // Step-driven hue + position
  const hueByStep: Record<StepKey, { angle: string; tint: string; pos: string }> = {
    company: { angle: '15% 0%',  tint: 'hsla(212,100%,40%,0.22)', pos: '85% 100%' },
    team:    { angle: '85% 0%',  tint: 'hsla(195,100%,55%,0.18)', pos: '15% 100%' },
    account: { angle: '20% 100%',tint: 'hsla(212,100%,45%,0.18)', pos: '80% 0%'   },
    verify:  { angle: '50% 50%', tint: 'hsla(195,100%,65%,0.20)', pos: '50% 0%'   },
  };
  const h = hueByStep[stepKey];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Hero image, deeply darkened */}
      <AnimatePresence>
        <motion.div
          key={`bg-${accountType}`}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover"
               style={{ filter: 'saturate(0.85) contrast(1.05)' }} />
          <div className="absolute inset-0" style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 60%, hsl(220,14%,2%) 100%)',
          }} />
        </motion.div>
      </AnimatePresence>

      {/* Step-driven aurora */}
      <AnimatePresence>
        <motion.div
          key={`aurora-${stepKey}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          style={{
            background:
              `radial-gradient(ellipse at ${h.angle}, ${h.tint}, transparent 55%),` +
              `radial-gradient(ellipse at ${h.pos}, hsla(195,100%,55%,0.10), transparent 55%)`,
          }}
        />
      </AnimatePresence>

      {/* Drifting orb */}
      <motion.div
        className="absolute -top-32 -left-32 w-[640px] h-[640px] rounded-full"
        style={{ background: 'radial-gradient(circle, hsla(212,100%,55%,0.18), transparent 60%)' }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-32 w-[520px] h-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, hsla(195,100%,65%,0.14), transparent 60%)' }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Anamorphic flare */}
      <motion.div
        className="absolute left-0 right-0 top-[34%] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsla(195,100%,75%,0.55), transparent)' }}
        animate={{ opacity: [0, 0.7, 0], scaleX: [0.6, 1, 0.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Film grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}

/* =================================================================
 * Audience switch — premium pill toggle
 * ================================================================= */

function AudienceSwitch({ value, onChange }: { value: AccountType; onChange: (v: AccountType) => void }) {
  const opts: { id: AccountType; label: string; Icon: typeof User }[] = [
    { id: 'personal', label: 'Personal',  Icon: User },
    { id: 'business', label: 'Business',  Icon: Briefcase },
  ];
  return (
    <div className="relative inline-flex items-center gap-1 p-1 rounded-full bg-glass-hover border border-white/[0.08] backdrop-blur-2xl font-sans">
      {opts.map(o => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'relative h-9 px-4 inline-flex items-center gap-2 rounded-full text-xs font-medium tracking-[0.08em] uppercase transition-colors',
              active ? 'text-white' : 'text-white/55 hover:text-white/80',
            )}
          >
            {active && (
              <motion.span
                layoutId="aud-pill"
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, hsla(212,100%,40%,0.45), hsla(195,100%,55%,0.35))',
                  boxShadow: '0 6px 24px -8px hsla(212,100%,55%,0.55), 0 0 0 1px hsla(212,100%,75%,0.20) inset',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              <o.Icon className="w-3.5 h-3.5" /> {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =================================================================
 * Atoms
 * ================================================================= */

const inputCls =
  'w-full h-12 px-4 rounded-xl bg-glass border border-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[hsla(212,100%,60%,0.55)] focus:bg-glass-hover transition-all font-sans';

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[10px] tracking-[0.28em] uppercase text-white/55 font-medium font-sans">{label}</p>
        {hint && <p className="text-[10.5px] text-white/35 font-sans">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.22em] uppercase text-white/55 font-medium mb-2 font-sans">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-rose-400 mt-1.5 font-sans">{error}</span>}
    </label>
  );
}

function ChipGrid({
  options, selected, onToggle, error, multi,
}: {
  options: { id: string; label: string; desc?: string; Icon?: React.ComponentType<{ className?: string }> }[];
  selected: string[];
  onToggle: (id: string) => void;
  error?: string;
  multi?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {options.map(({ id, label, desc, Icon }, i) => {
          const active = selected.includes(id);
          return (
            <motion.button
              key={id}
              onClick={() => onToggle(id)}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.45, delay: 0.04 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'group relative min-h-[110px] p-4 rounded-2xl border text-left flex flex-col gap-2 overflow-hidden font-sans',
                active
                  ? 'border-primary/55 bg-primary/[0.10] shadow-[0_0_32px_-8px_hsla(212,100%,55%,0.55)]'
                  : 'border-white/[0.08] bg-glass hover:border-white/15',
              )}
            >
              {Icon && (
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center border transition-colors',
                  active ? 'border-primary/55 bg-primary/[0.18]' : 'border-white/[0.08] bg-glass-hover',
                )}>
                  <Icon className="w-4 h-4 text-primary/60" />
                </div>
              )}
              <p className="text-sm font-semibold text-white">{label}</p>
              {desc && <p className="text-[11.5px] text-white/55 leading-snug">{desc}</p>}
              {active && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full inline-flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0A84FF, #5AC8FA)', boxShadow: '0 0 12px hsla(212,100%,60%,0.6)' }}>
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3 font-sans">{error}</p>}
    </div>
  );
}

function PillGrid({
  options, selected, onToggle, error,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2.5 font-sans">
        {options.map(({ id, label }, i) => {
          const active = selected.includes(id);
          return (
            <motion.button
              key={id}
              onClick={() => onToggle(id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.03 + i * 0.025 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                'h-11 px-4 rounded-full text-[13px] font-medium transition-all border inline-flex items-center gap-2',
                active
                  ? 'border-primary/55 bg-primary/[0.12] text-white shadow-[0_0_18px_-6px_hsla(212,100%,55%,0.5)]'
                  : 'border-white/[0.08] bg-glass text-white/70 hover:border-white/15 hover:text-white',
              )}
            >
              {active && <Check className="w-3 h-3 text-primary/60" />}
              {label}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3 font-sans">{error}</p>}
    </div>
  );
}

function RadioCards({
  options, selected, onSelect, error,
}: {
  options: { id: string; label: string; desc?: string; sub?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
        {options.map(({ id, label, desc, sub }, i) => {
          const active = selected === id;
          return (
            <motion.button
              key={id}
              onClick={() => onSelect(id)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.04 + i * 0.04 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              className={cn(
                'relative p-4 rounded-2xl border text-left transition-all',
                active
                  ? 'border-primary/55 bg-primary/[0.10] shadow-[0_0_32px_-8px_hsla(212,100%,55%,0.55)]'
                  : 'border-white/[0.08] bg-glass hover:border-white/15',
              )}
            >
              <p className="text-sm font-semibold text-white">{label}</p>
              {(desc || sub) && <p className="text-[11.5px] text-white/55 mt-1">{desc || sub}</p>}
              {active && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full inline-flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0A84FF, #5AC8FA)', boxShadow: '0 0 12px hsla(212,100%,60%,0.6)' }}>
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3 font-sans">{error}</p>}
    </div>
  );
}

function SegmentScale({
  options, selected, onSelect, error,
}: {
  options: { id: string; label: string; sub?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-sans">
        {options.map(({ id, label, sub }, i) => {
          const active = selected === id;
          return (
            <motion.button
              key={id}
              onClick={() => onSelect(id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.04 + i * 0.04 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'relative h-[78px] px-3 rounded-2xl border flex flex-col items-center justify-center transition-all',
                active
                  ? 'border-primary/55 bg-primary/[0.10] shadow-[0_0_24px_-8px_hsla(212,100%,55%,0.5)]'
                  : 'border-white/[0.08] bg-glass hover:border-white/15',
              )}
            >
              <p className="text-[12.5px] font-semibold text-white">{label}</p>
              {sub && <p className="text-[10.5px] text-white/50 mt-0.5">{sub}</p>}
              <div className="absolute bottom-1.5 left-3 right-3 flex gap-0.5">
                {options.map((_, j) => (
                  <span key={j} className={cn(
                    'flex-1 h-0.5 rounded-full transition-colors',
                    j <= i && active ? 'bg-primary/90' : 'bg-glass-active',
                  )} />
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3 font-sans">{error}</p>}
    </div>
  );
}

function BetaFreePlanCard({ onContinue }: { onContinue: () => void }) {
  // Auto-claim the free-to-start "plan" the moment this step mounts so the user
  // can advance without an explicit click. The visible card explains why
  // there's nothing to choose.
  useEffect(() => {
    onContinue();
  }, [onContinue]);

  return (
    <div className="max-w-2xl mx-auto">
      <BetaHero
        size="compact"
        eyebrow="No checkout required"
        title={<>Your first video is on us.</>}
        body={
          <>
            <span className="text-emerald-300 font-mono">Your first 5-second video is free</span>, generated on the Wan model — no card required to start. From there, credits are pay-as-you-go across every mode: text-to-video, avatars, motion transfer, the lot.
          </>
        }
        actions={
          <ul className="space-y-2.5">
            {[
              'No card on file to start. No surprise charges.',
              'Refunds for failed renders land back in your balance automatically.',
              'Top up credits anytime from /credits — you only pay for what you render.',
              'Credits never expire.',
            ].map((l) => (
              <li key={l} className="flex gap-3 text-[13px] text-white/65 leading-relaxed">
                <span className="mt-[7px] w-1 h-1 rounded-full bg-primary shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}

function PlanGrid({
  plans, selectedId, onSelect, error,
}: { plans: Plan[]; selectedId: string; onSelect: (p: Plan) => void; error?: string }) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-sans">
        {plans.map((p, i) => {
          const active = selectedId === p.id;
          const Icon = p.Icon;
          return (
            <motion.button
              key={p.id}
              onClick={() => onSelect(p)}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 + i * 0.06 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
              className={cn(
                'relative p-5 rounded-2xl border text-left transition-all overflow-hidden',
                active
                  ? 'border-primary/55 bg-primary/[0.08] shadow-[0_0_40px_-8px_hsla(212,100%,55%,0.55)]'
                  : 'border-white/[0.08] bg-glass hover:border-white/15',
              )}
            >
              {p.popular && (
                <span className="absolute top-4 right-4 text-[9.5px] tracking-[0.22em] uppercase text-primary/60 bg-primary/[0.15] border border-primary/30 rounded-full px-2 py-0.5">
                  Popular
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/[0.08] bg-glass-hover">
                  <Icon className="w-4 h-4 text-primary/60" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{p.name}</p>
                  <p className="text-[11px] text-white/55">{p.tagline}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-3xl font-bold tracking-tight text-white">${p.price}</span>
                {p.interval && <span className="text-xs text-white/45">/ {p.interval}</span>}
                {p.credits && <span className="text-[11px] text-white/40 ml-1.5">· {p.credits.toLocaleString()} credits</span>}
              </div>
              <ul className="space-y-1.5">
                {p.features.slice(0, 4).map(f => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-white/65">
                    <Check className="w-3 h-3 mt-1 text-primary/60 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {active && (
                <motion.div
                  layoutId="plan-bar"
                  className="absolute inset-x-0 bottom-0 h-[3px]"
                  style={{ background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {active && (
                <span className="absolute top-4 left-4 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0A84FF, #5AC8FA)', boxShadow: '0 0 16px hsla(212,100%,60%,0.6)' }}>
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3 font-sans">{error}</p>}
    </div>
  );
}

