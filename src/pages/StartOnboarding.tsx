import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { z } from 'zod';
import {
  User, Briefcase, Building2, ArrowRight, ArrowLeft, Check, Sparkles,
  Film, Megaphone, Wand2, Crown, Gem,
  Loader2, X, Cpu, ShieldCheck, Star, Quote, Mail, Lock, Eye, EyeOff,
  Palette, Users, Plug, Receipt, Target, BarChart3,
} from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';
import heroPersonal from '@/assets/onboarding/hero-personal.jpg';
import heroBusiness from '@/assets/onboarding/hero-business.jpg';
import heroEnterprise from '@/assets/onboarding/hero-enterprise.jpg';

type AccountType = 'personal' | 'business' | 'enterprise';
type PlanKind = 'credits' | 'subscription' | 'contact';

interface Plan {
  id: string;            // priceId / lookup_key (or 'contact_sales')
  kind: PlanKind;
  name: string;
  tagline: string;
  price: number;         // dollars
  interval?: 'month' | 'year';
  credits?: number;
  features: string[];
  popular?: boolean;
  Icon: typeof Sparkles;
}

/* ─────────────────────────────────────────────────────────────────────
 * Plan catalogs per audience
 * ──────────────────────────────────────────────────────────────────── */

const PERSONAL_PLANS: Plan[] = [
  { id: 'credits_mini',     kind: 'credits', name: 'Mini',    tagline: 'Quick top-up — one short story',
    price: 9,   credits: 90,   Icon: Sparkles,
    features: ['1080p HD export', 'AI script generator', 'All cinematic engines'] },
  { id: 'credits_starter',  kind: 'credits', name: 'Starter', tagline: 'A weekend of cinematic experiments',
    price: 37,  credits: 370,  Icon: Wand2,
    features: ['1080p HD export', 'AI script generator', 'Standard support'] },
  { id: 'sub_creator_monthly', kind: 'subscription', name: 'Creator', tagline: 'Best for weekly creators',
    price: 19, interval: 'month', credits: 1000, Icon: Crown, popular: true,
    features: ['1,000 credits / month', '4K Ultra HD', 'Priority queue', 'Cancel anytime'] },
  { id: 'credits_growth',   kind: 'credits', name: 'Growth',  tagline: 'Built for shipping every week',
    price: 99,  credits: 1000, Icon: Gem,
    features: ['4K Ultra HD (2160p)', 'Priority render queue', 'Multi-character dialogue'] },
];

const BUSINESS_PLANS: Plan[] = [
  { id: 'sub_pro_monthly',     kind: 'subscription', name: 'Pro',     tagline: 'Solo specialists & founders',
    price: 49,  interval: 'month', credits: 3000, Icon: Briefcase,
    features: ['3,000 credits / month', '4K HDR export', 'API & webhooks', 'Priority support'] },
  { id: 'sub_studio_monthly',  kind: 'subscription', name: 'Studio',  tagline: 'In-house teams shipping campaigns',
    price: 149, interval: 'month', credits: 10000, Icon: Crown, popular: true,
    features: ['10,000 credits / month', 'Up to 5 seats', 'Brand kit & presets', 'Account manager'] },
  { id: 'sub_business_monthly',kind: 'subscription', name: 'Business',tagline: 'Agencies running content engines',
    price: 499, interval: 'month', credits: 35000, Icon: Building2,
    features: ['35,000 credits / month', 'Up to 15 seats', 'Dedicated CSM', 'Slack support'] },
  { id: 'biz_studio_pack',     kind: 'credits',      name: 'Studio Pack', tagline: 'One-time volume — no commitment',
    price: 499, credits: 5500, Icon: Gem,
    features: ['5,500 credits', 'No expiration', 'All cinematic engines', 'Up to 5 seats'] },
];

const ENTERPRISE_PLAN: Plan = {
  id: 'contact_sales', kind: 'contact', name: 'Enterprise',
  tagline: 'Custom contracts, SSO, dedicated production',
  price: 0, Icon: Building2,
  features: ['Unlimited seats & API', 'SAML SSO & SCIM', 'Dedicated render lane', 'White-glove production', 'SLA & DPA'],
};

/* ─────────────────────────────────────────────────────────────────────
 * Step definitions per audience
 * ──────────────────────────────────────────────────────────────────── */

// Billing/checkout is ALWAYS the final step. Account creation (incl. Google/Apple)
// happens AFTER the user has completed all questionnaire + plan selection — this
// preserves the full onboarding flow and lands users on billing as the last action.
const PERSONAL_STEPS = ['goals', 'usecase', 'profile', 'plan', 'account', 'verify'] as const;
// Business onboarding is intentionally deeper than personal — it captures workspace,
// brand, volume, integrations and an optional teammate invite list before billing.
const BUSINESS_STEPS = ['company', 'biz_usecase', 'team', 'role', 'brand', 'volume', 'integrations', 'plan', 'account', 'verify', 'invite', 'billing'] as const;
const ENTERPRISE_STEPS = ['company', 'scale', 'needs', 'contact'] as const;

type StepKey =
  | typeof PERSONAL_STEPS[number]
  | typeof BUSINESS_STEPS[number]
  | typeof ENTERPRISE_STEPS[number];

const STEP_META: Record<StepKey, { label: string; copy: string }> = {
  goals:   { label: 'Goals',         copy: 'What do you want to make?' },
  usecase: { label: 'Style',         copy: 'Pick the experience you want.' },
  plan:    { label: 'Plan',          copy: 'Choose how you want to start.' },
  profile: { label: 'Profile',       copy: 'How should we greet you?' },
  company: { label: 'Company',       copy: 'Tell us about your team.' },
  team:    { label: 'Team',          copy: 'How big is your crew?' },
  role:    { label: 'Your role',     copy: 'What do you do?' },
  billing: { label: 'Billing',       copy: 'Almost there — confirm your plan.' },
  scale:   { label: 'Scale',         copy: 'Help us size your contract.' },
  needs:   { label: 'Requirements',  copy: 'Pick what you need.' },
  contact: { label: 'Contact',       copy: 'How should we reach you?' },
  account: { label: 'Account',       copy: 'Create your account.' },
  verify:  { label: 'Verify',        copy: 'Confirm your email.' },
  biz_usecase:  { label: 'Use case',     copy: 'What will your team produce?' },
  brand:        { label: 'Brand kit',    copy: 'Bring your brand into Apex.' },
  volume:       { label: 'Volume',       copy: 'How much content per month?' },
  integrations: { label: 'Integrations', copy: 'Where does video need to go?' },
  invite:       { label: 'Invite team',  copy: 'Bring your crew on board.' },
};

const PERSONAL_GOALS = [
  { id: 'social',   label: 'Short-form social', Icon: Film },
  { id: 'passion',  label: 'Passion projects',  Icon: Sparkles },
  { id: 'learn',    label: 'Just exploring',    Icon: Wand2 },
  { id: 'youtube',  label: 'YouTube content',   Icon: Megaphone },
];

const PERSONAL_STYLES = [
  { id: 'cinematic', label: 'Cinematic',   desc: 'Hollywood lighting, depth, drama' },
  { id: 'dreamy',    label: 'Dreamy',      desc: 'Soft, surreal, atmospheric' },
  { id: 'gritty',    label: 'Gritty',      desc: 'Hand-held, raw, documentary' },
  { id: 'animated',  label: 'Animated',    desc: 'Stylized, vibrant, motion-rich' },
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
const VOLUME_OPTIONS = ['< 1,000 / mo', '1,000–5,000 / mo', '5,000–25,000 / mo', '25,000–100,000 / mo', '100,000+ / mo'];

const BUSINESS_USE_CASES = [
  { id: 'ads',         label: 'Performance ads',       desc: 'Hooks, UGC, paid social creative', Icon: Target },
  { id: 'social',      label: 'Organic social',        desc: 'TikTok, Reels, Shorts at scale',  Icon: Megaphone },
  { id: 'product',     label: 'Product marketing',     desc: 'Launches, demos, explainers',     Icon: Sparkles },
  { id: 'sales',       label: 'Sales enablement',      desc: 'Outbound, decks, personalized',   Icon: Briefcase },
  { id: 'training',    label: 'Internal & training',   desc: 'Onboarding, comms, L&D',          Icon: ShieldCheck },
  { id: 'agency',      label: 'Client deliverables',   desc: 'Agency work for multiple brands', Icon: Crown },
];

const BUSINESS_VOLUME = [
  { id: '< 10 / mo',     label: 'Under 10 / mo',     desc: 'Just getting started' },
  { id: '10–50 / mo',    label: '10–50 / mo',        desc: 'A steady weekly cadence' },
  { id: '50–250 / mo',   label: '50–250 / mo',       desc: 'High-output content engine' },
  { id: '250+ / mo',     label: '250+ / mo',         desc: 'Industrial scale' },
];

const BUSINESS_INTEGRATIONS = [
  { id: 'meta',     label: 'Meta Ads' },
  { id: 'tiktok',   label: 'TikTok' },
  { id: 'youtube',  label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'shopify',  label: 'Shopify' },
  { id: 'hubspot',  label: 'HubSpot' },
  { id: 'slack',    label: 'Slack' },
  { id: 'zapier',   label: 'Zapier / API' },
];

const BRAND_VOICES = [
  { id: 'bold',         label: 'Bold & confident',     desc: 'Big claims, strong stance' },
  { id: 'playful',      label: 'Playful',              desc: 'Light, witty, irreverent' },
  { id: 'premium',      label: 'Premium & refined',    desc: 'Editorial, cinematic, calm' },
  { id: 'authoritative',label: 'Authoritative',        desc: 'Expert, informative, trusted' },
  { id: 'warm',         label: 'Warm & human',         desc: 'Empathetic, friendly, real' },
];

const PRESET_BRAND_COLORS = [
  '#0A84FF', '#5AC8FA', '#FF453A', '#FF9F0A', '#FFD60A',
  '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#FFFFFF',
];

/* ─────────────────────────────────────────────────────────────────────
 * Schemas
 * ──────────────────────────────────────────────────────────────────── */

const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Tell us your name').max(100),
});
const accountSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(255),
  password: z.string().min(8, 'At least 8 characters').max(128),
});
const companySchema = z.object({
  company_name: z.string().trim().min(2, 'Company name required').max(160),
  industry: z.string().min(1, 'Select an industry'),
});
const contactSchema = z.object({
  contact_email: z.string().trim().email('Enter a valid email').max(255),
  contact_phone: z.string().trim().max(40).optional().or(z.literal('')),
});

/* ─────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────── */

export default function StartOnboarding() {
  const { navigate } = useSafeNavigation();
  const [params] = useSearchParams();
  const { user, signUp, signIn, signInWithGoogle, signInWithApple } = useAuth();
  const initialType = (params.get('type') as AccountType) || 'personal';
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);

  // Form state (single bag — not all fields used per audience)
  const [form, setForm] = useState({
    display_name: '',
    goals: [] as string[],
    style: '',
    selected_plan_id: '',
    selected_plan_kind: '' as PlanKind | '',
    company_name: '',
    team_size: '',
    industry: '',
    job_role: '',
    expected_volume: '',
    needs_sso: false,
    needs_sla: false,
    needs_api: false,
    contact_email: '',
    contact_phone: '',
    email: '',
    password: '',
    // Business-only
    primary_use_case: '',
    monthly_volume: '',
    brand_colors: [] as string[],
    brand_voice: '',
    integrations_needed: [] as string[],
    billing_email: '',
    vat_id: '',
    invited_emails: [] as string[],
    invite_input: '',
  });

  const steps = useMemo<readonly StepKey[]>(() => {
    if (accountType === 'business')   return BUSINESS_STEPS;
    if (accountType === 'enterprise') return ENTERPRISE_STEPS;
    return PERSONAL_STEPS;
  }, [accountType]);

  const currentStep = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const progress = ((stepIdx + 1) / steps.length) * 100;

  const plans: Plan[] = useMemo(() => {
    if (accountType === 'business') return BUSINESS_PLANS;
    if (accountType === 'enterprise') return [ENTERPRISE_PLAN];
    return PERSONAL_PLANS;
  }, [accountType]);

  // Auto-select enterprise contact-sales plan
  useEffect(() => {
    if (accountType === 'enterprise') {
      setForm(f => ({ ...f, selected_plan_id: 'contact_sales', selected_plan_kind: 'contact' }));
    } else {
      // Reset selection when switching audiences from same page
      setForm(f => ({ ...f, selected_plan_id: '', selected_plan_kind: '' as any }));
    }
    setStepIdx(0);
  }, [accountType]);

  /* ── Validation per step ───────────────────────────────────────── */
  const validate = useCallback((): boolean => {
    setErrors({});
    if (currentStep === 'goals' && form.goals.length === 0) {
      setErrors({ goals: 'Pick at least one' }); return false;
    }
    if (currentStep === 'usecase' && !form.style) {
      setErrors({ style: 'Choose a style' }); return false;
    }
    if (currentStep === 'profile') {
      const r = profileSchema.safeParse({ display_name: form.display_name });
      if (!r.success) { setErrors({ display_name: r.error.errors[0].message }); return false; }
    }
    if (currentStep === 'company') {
      const r = companySchema.safeParse({ company_name: form.company_name, industry: form.industry });
      if (!r.success) {
        const fe: Record<string, string> = {};
        r.error.errors.forEach(e => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
        setErrors(fe); return false;
      }
    }
    if (currentStep === 'team' && !form.team_size) {
      setErrors({ team_size: 'Pick a team size' }); return false;
    }
    if (currentStep === 'role' && !form.job_role) {
      setErrors({ job_role: 'Pick a role' }); return false;
    }
    if (currentStep === 'plan' && !form.selected_plan_id) {
      setErrors({ plan: 'Pick a plan to continue' }); return false;
    }
    if (currentStep === 'account') {
      // If already authenticated (e.g. via OAuth), skip validation
      if (user) return true;
      const r = accountSchema.safeParse({ email: form.email, password: form.password });
      if (!r.success) {
        const fe: Record<string, string> = {};
        r.error.errors.forEach(e => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
        setErrors(fe); return false;
      }
    }
    if (currentStep === 'verify') {
      if (user) return true;
      if (otpCode.length !== 6) { setErrors({ otp: 'Enter the 6-digit code' }); return false; }
    }
    if (currentStep === 'scale' && !form.expected_volume) {
      setErrors({ expected_volume: 'Pick an expected volume' }); return false;
    }
    if (currentStep === 'contact') {
      const r = contactSchema.safeParse({ contact_email: form.contact_email, contact_phone: form.contact_phone });
      if (!r.success) {
        const fe: Record<string, string> = {};
        r.error.errors.forEach(e => { if (e.path[0]) fe[e.path[0] as string] = e.message; });
        setErrors(fe); return false;
      }
    }
    return true;
  }, [currentStep, form, user, otpCode]);

  // Holds the persisted intent token after we save the wizard data
  const [intentToken, setIntentToken] = useState<string | null>(null);

  const next = async () => {
    if (!validate()) return;

    // Step: account → persist intent + create account, then advance to verify
    if (currentStep === 'account') {
      if (user) {
        // Already authenticated (e.g. via OAuth). Skip verify; advance to billing
        // (business) or finish (personal — billing is handled by checkout redirect).
        await persistIntentAndConsume();
        const skipTo = stepIdx + 2;
        if (skipTo >= steps.length) { void finish(); return; }
        setDirection(1);
        setStepIdx(skipTo);
        return;
      }
      setSubmitting(true);
      try {
        const token = await ensureIntentPersisted();
        if (!token) return;
        const { error } = await signUp(form.email.trim(), form.password);
        if (error) {
          if (/already.*registered/i.test(error.message)) {
            // Try sign-in instead
            const { error: siErr } = await signIn(form.email.trim(), form.password);
            if (siErr) {
              toast.error('That email is already registered — wrong password?');
              return;
            }
            // Existing account signed in — skip OTP and proceed to billing/finish.
            await persistIntentAndConsume();
            const skipTo = stepIdx + 2;
            if (skipTo >= steps.length) { void finish(); return; }
            setDirection(1);
            setStepIdx(skipTo);
            return;
          }
          toast.error(error.message || 'Could not create your account.');
          return;
        }
        toast.success('Check your email — we sent a 6-digit code.');
        setDirection(1);
        setStepIdx(i => i + 1);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Step: verify → confirm OTP, consume intent, advance to billing or finish
    if (currentStep === 'verify') {
      if (user) {
        await persistIntentAndConsume();
        if (stepIdx + 1 >= steps.length) { void finish(); return; }
        setDirection(1);
        setStepIdx(i => i + 1);
        return;
      }
      setSubmitting(true);
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: form.email.trim(),
          token: otpCode,
          type: 'signup',
        });
        if (error) {
          toast.error(error.message || 'Invalid code.');
          return;
        }
        toast.success('Email verified.');
        await persistIntentAndConsume();
        if (stepIdx + 1 >= steps.length) { void finish(); return; }
        setDirection(1);
        setStepIdx(i => i + 1);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (isLast) { void finish(); return; }
    setDirection(1);
    setStepIdx(i => i + 1);
  };
  const back = () => {
    if (stepIdx === 0) {
      navigate('/');
      return;
    }
    setDirection(-1);
    setStepIdx(i => i - 1);
  };

  /* ── Persist wizard intent (idempotent — only inserts once) ───── */
  const ensureIntentPersisted = async (): Promise<string | null> => {
    if (intentToken) return intentToken;
    const token = `int_${crypto.randomUUID()}`;
    const payload = {
      intent_token: token,
      account_type: accountType,
      selected_plan_id: form.selected_plan_id || null,
      selected_plan_kind: (form.selected_plan_kind || null) as PlanKind | null,
      goals: form.goals.length ? form.goals : null,
      experience_level: form.style || null,
      company_name: form.company_name || null,
      team_size: form.team_size || null,
      industry: form.industry || null,
      job_role: form.job_role || null,
      expected_volume: form.expected_volume || null,
      needs_sso: form.needs_sso,
      needs_sla: form.needs_sla,
      needs_api: form.needs_api,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      display_name: form.display_name || null,
    };
    const { error } = await supabase.from('onboarding_intents').insert(payload);
    if (error) {
      console.error('[start] intent persist', error);
      toast.error('Could not save your choices. Please try again.');
      return null;
    }
    try { sessionStorage.setItem('apex.intent_token', token); } catch {}
    try { localStorage.setItem('apex.audience', accountType); } catch {}
    setIntentToken(token);
    return token;
  };

  const persistIntentAndConsume = async () => {
    const token = await ensureIntentPersisted();
    if (!token) return;
    try {
      await supabase.rpc('consume_onboarding_intent', { _token: token });
    } catch (e) {
      console.warn('[start] consume_onboarding_intent', e);
    }
  };

  const routeAfterAuth = async () => {
    const target = form.selected_plan_kind === 'contact'
      ? '/projects'
      : form.selected_plan_id
        ? `/welcome/checkout?plan=${form.selected_plan_id}`
        : '/create';
    navigate(target, { replace: true });
  };

  /* ── Finish: final plan/billing step → checkout (or enterprise lead capture) ── */
  const finish = async () => {
    setSubmitting(true);
    try {
      const token = await ensureIntentPersisted();
      if (!token) return;

      // Enterprise: lead-capture path, no account, no checkout
      if (accountType === 'enterprise') {
        // Lead-capture: insert basic enterprise lead (best-effort)
        try {
          await supabase.from('enterprise_leads').insert({
            email: form.contact_email,
            company_name: form.company_name,
            company_size: form.team_size || null,
            industry: form.industry || null,
            primary_use_case: form.expected_volume || null,
            needs_sso: form.needs_sso,
            status: 'new',
          });
        } catch (e) { console.warn('[start] enterprise lead insert', e); }
        toast.success('Thanks — our team will reach out within one business day.');
        navigate(`/auth?mode=signup&intent=${token}&audience=enterprise&next=${encodeURIComponent('/projects')}`);
        return;
      }

      // Personal / Business — user is already authenticated at this point.
      // Consume intent then go straight to checkout.
      await persistIntentAndConsume();

      const target = form.selected_plan_kind === 'contact'
        ? '/projects'
        : form.selected_plan_id
          ? `/welcome/checkout?plan=${form.selected_plan_id}`
          : '/create';

      // Safety net: if for any reason the user isn't authenticated, fall back to /auth.
      if (!user) {
        navigate(`/auth?mode=signup&intent=${token}&audience=${accountType}&next=${encodeURIComponent(target)}`);
        return;
      }

      navigate(target, { replace: true });
    } catch (e: any) {
      console.error('[start] finish', e);
      toast.error(e?.message ?? 'Could not save your choices.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[hsl(220,14%,2%)] text-white">
      {/* Ambient global background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background:
            'radial-gradient(ellipse at 15% 0%, hsla(212,100%,40%,0.16), transparent 55%), radial-gradient(ellipse at 85% 100%, hsla(195,100%,55%,0.10), transparent 55%), #000',
        }} />
      </div>

      {/* Close */}
      <button
        onClick={() => navigate('/')}
        aria-label="Close"
        className="fixed top-6 right-6 z-30 w-10 h-10 inline-flex items-center justify-center rounded-full text-white/55 hover:text-white hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.06] transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-h-screen">
        {/* ─────────── LEFT — Cinematic poster pane ─────────── */}
        <CinematicPane
          accountType={accountType}
          stepIdx={stepIdx}
          currentStep={currentStep}
        />

        {/* ─────────── RIGHT — Wizard ─────────── */}
        <div className="relative flex flex-col px-6 md:px-12 lg:px-14 pt-10 lg:pt-14 pb-20">
          {/* Brand */}
          <div className="flex items-center justify-between mb-8">
            <Logo size="md" showText textClassName="text-base font-display font-bold" />
            <p className="hidden md:block text-[10px] tracking-[0.32em] uppercase text-white/40">
              Step {stepIdx + 1} / {steps.length}
            </p>
          </div>

          {/* Selected audience badge (read-only — type was chosen on the previous screen) */}
          <div className="flex justify-start mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur text-[11px] uppercase tracking-[0.18em] font-medium text-white/75">
              {accountType === 'personal' && <User className="w-3.5 h-3.5 text-[#9DCBFF]" />}
              {accountType === 'business' && <Briefcase className="w-3.5 h-3.5 text-[#9DCBFF]" />}
              {accountType === 'enterprise' && <Building2 className="w-3.5 h-3.5 text-[#9DCBFF]" />}
              {accountType}
            </div>
          </div>

          {/* Stepper rail with traveling shimmer on the active segment */}
          <div className="flex items-center gap-1.5 mb-8">
            {steps.map((s, i) => {
              const filled = i <= stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s} className="relative flex-1 h-[3px] rounded-full overflow-hidden bg-white/[0.06]">
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

          {/* Step header */}
          <div className="mb-8 min-h-[120px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`header-${accountType}-${currentStep}`}
                initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.p
                  className="text-[10px] tracking-[0.32em] uppercase text-[#9DCBFF] font-medium mb-3 inline-flex items-center gap-2"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                >
                  <motion.span
                    className="w-1 h-1 rounded-full bg-[#5AC8FA]"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  {STEP_META[currentStep].label}
                </motion.p>
                <h1 className="font-display text-[32px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
                  {STEP_META[currentStep].copy.split(' ').map((word, i) => (
                    <motion.span
                      key={`${currentStep}-${i}`}
                      className="inline-block mr-[0.25em]"
                      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ duration: 0.6, delay: 0.08 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </h1>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Card */}
          <div className="relative flex-1">
            <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${accountType}-${currentStep}`}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 40 : -40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: direction > 0 ? -40 : 40, filter: 'blur(8px)' }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Goals (Personal) */}
              {currentStep === 'goals' && (
                <ChipGrid
                  options={PERSONAL_GOALS.map(g => ({ id: g.id, label: g.label, Icon: g.Icon }))}
                  selected={form.goals}
                  onToggle={(id) => setForm(f => ({
                    ...f, goals: f.goals.includes(id) ? f.goals.filter(x => x !== id) : [...f.goals, id],
                  }))}
                  error={errors.goals}
                  multi
                />
              )}

              {/* Style (Personal) */}
              {currentStep === 'usecase' && (
                <RadioGrid
                  options={PERSONAL_STYLES}
                  selected={form.style}
                  onSelect={(id) => setForm(f => ({ ...f, style: id }))}
                  error={errors.style}
                />
              )}

              {/* Plan */}
              {currentStep === 'plan' && (
                <PlanGrid
                  plans={plans}
                  selectedId={form.selected_plan_id}
                  onSelect={(p) => setForm(f => ({ ...f, selected_plan_id: p.id, selected_plan_kind: p.kind }))}
                  error={errors.plan}
                />
              )}

              {/* Profile (Personal) */}
              {currentStep === 'profile' && (
                <Field label="Your name" error={errors.display_name}>
                  <input
                    autoFocus
                    placeholder="Jordan Lin"
                    value={form.display_name}
                    onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              )}

              {/* Company (Business / Enterprise) */}
              {currentStep === 'company' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Company name" error={errors.company_name}>
                    <input
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
              )}

              {/* Team (Business) */}
              {currentStep === 'team' && (
                <RadioGrid
                  options={TEAM_SIZES.map(s => ({ id: s, label: s, desc: '' }))}
                  selected={form.team_size}
                  onSelect={(id) => setForm(f => ({ ...f, team_size: id }))}
                  error={errors.team_size}
                  compact
                />
              )}

              {/* Role (Business) */}
              {currentStep === 'role' && (
                <RadioGrid
                  options={ROLES.map(r => ({ id: r, label: r, desc: '' }))}
                  selected={form.job_role}
                  onSelect={(id) => setForm(f => ({ ...f, job_role: id }))}
                  error={errors.job_role}
                  compact
                />
              )}

              {/* Billing summary (Business) */}
              {currentStep === 'billing' && (
                <BillingSummary
                  audience={accountType}
                  plan={plans.find(p => p.id === form.selected_plan_id)}
                />
              )}

              {/* Scale (Enterprise) */}
              {currentStep === 'scale' && (
                <RadioGrid
                  options={VOLUME_OPTIONS.map(v => ({ id: v, label: v, desc: '' }))}
                  selected={form.expected_volume}
                  onSelect={(id) => setForm(f => ({ ...f, expected_volume: id }))}
                  error={errors.expected_volume}
                  compact
                />
              )}

              {/* Needs (Enterprise) */}
              {currentStep === 'needs' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { key: 'needs_sso', label: 'SAML SSO', desc: 'Okta, Entra, Google', Icon: ShieldCheck },
                    { key: 'needs_sla', label: 'SLA & DPA', desc: 'Uptime + data terms', Icon: FileCheckIcon },
                    { key: 'needs_api', label: 'API & webhooks', desc: 'Programmatic access', Icon: Cpu },
                  ].map(({ key, label, desc, Icon }) => {
                    const active = (form as any)[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                        className={cn(
                          'text-left rounded-2xl p-5 border transition-all',
                          active
                            ? 'border-[#0A84FF]/55 bg-[#0A84FF]/[0.08] shadow-[0_0_30px_-8px_hsla(212,100%,55%,0.4)]'
                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
                        )}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-white/[0.04] border border-white/[0.08]">
                          <Icon className="w-4 h-4 text-[#9DCBFF]" />
                        </div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-white/45 mt-1">{desc}</p>
                        {active && <div className="absolute top-3 right-3 text-[#9DCBFF]"><Check className="w-4 h-4" /></div>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Contact (Enterprise) */}
              {currentStep === 'contact' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Work email" error={errors.contact_email}>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={form.contact_email}
                      onChange={(e) => setForm(f => ({ ...f, contact_email: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Phone (optional)" error={errors.contact_phone}>
                    <input
                      placeholder="+1 555 123 4567"
                      value={form.contact_phone}
                      onChange={(e) => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {/* Account creation (Personal / Business) */}
              {currentStep === 'account' && (
                <div className="space-y-5">
                  {user ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#9DCBFF]" />
                      <div className="text-sm">
                        <p className="font-medium">You're already signed in as {user.email}</p>
                        <p className="text-white/45 text-xs mt-0.5">Click continue to finalize your setup.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* OAuth buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={async () => {
                            await ensureIntentPersisted();
                            const { error } = await signInWithGoogle();
                            if (error) toast.error(error.message || 'Google sign-in failed.');
                          }}
                          className="h-12 rounded-xl bg-white text-black text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.99] transition disabled:opacity-60"
                        >
                          <GoogleGlyph className="w-4 h-4" />
                          Continue with Google
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={async () => {
                            await ensureIntentPersisted();
                            const { error } = await signInWithApple();
                            if (error) toast.error(error.message || 'Apple sign-in failed.');
                          }}
                          className="h-12 rounded-xl bg-black text-white text-sm font-semibold inline-flex items-center justify-center gap-2 border border-white/15 hover:bg-white/[0.04] active:scale-[0.99] transition disabled:opacity-60"
                        >
                          <AppleGlyph className="w-4 h-4" />
                          Continue with Apple
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/[0.07]" />
                        <span className="text-[10px] tracking-[0.28em] uppercase text-white/35">or with email</span>
                        <div className="h-px flex-1 bg-white/[0.07]" />
                      </div>

                      <Field label="Email" error={errors.email}>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                          <input
                            autoFocus
                            type="email"
                            autoComplete="email"
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
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            value={form.password}
                            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                            className={cn(inputCls, 'pl-10 pr-11')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(s => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/[0.06] transition"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </Field>

                      <p className="text-[11px] text-white/30 leading-relaxed">
                        By continuing you agree to our Terms and Privacy Policy. We'll send a 6-digit code to verify your email.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* OTP verification (Personal / Business) */}
              {currentStep === 'verify' && (
                <div className="space-y-6">
                  {user ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#9DCBFF]" />
                      <div className="text-sm">
                        <p className="font-medium">Verified.</p>
                        <p className="text-white/45 text-xs mt-0.5">Click continue to wrap up.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-white/55">
                        Enter the 6-digit code we sent to <span className="text-white">{form.email}</span>.
                      </p>
                      <div className="flex gap-2 justify-start">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <input
                            key={i}
                            id={`apex-otp-${i}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={otpCode[i] || ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 1);
                              const next = (otpCode.substring(0, i) + v + otpCode.substring(i + 1)).slice(0, 6);
                              setOtpCode(next);
                              if (v && i < 5) document.getElementById(`apex-otp-${i + 1}`)?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
                                document.getElementById(`apex-otp-${i - 1}`)?.focus();
                              }
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                              if (pasted.length >= 1) {
                                e.preventDefault();
                                setOtpCode(pasted);
                                const focusIdx = Math.min(pasted.length, 5);
                                document.getElementById(`apex-otp-${focusIdx}`)?.focus();
                              }
                            }}
                            className={cn(
                              'w-12 h-14 text-center text-xl font-semibold rounded-xl tabular-nums',
                              'bg-white/[0.035] border border-white/10 text-white outline-none',
                              'focus:border-[hsla(212,100%,60%,0.6)] focus:bg-white/[0.05] transition-all',
                              otpCode[i] && 'border-[hsla(212,100%,55%,0.45)] shadow-[0_0_18px_-6px_hsla(212,100%,55%,0.5)]',
                            )}
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>
                      {errors.otp && <p className="text-[11px] text-rose-400">{errors.otp}</p>}
                      <button
                        type="button"
                        disabled={resending}
                        onClick={async () => {
                          setResending(true);
                          try {
                            const { error } = await supabase.auth.resend({
                              type: 'signup',
                              email: form.email.trim(),
                            });
                            if (error) toast.error(error.message);
                            else toast.success('Code re-sent.');
                          } finally { setResending(false); }
                        }}
                        className="text-xs text-white/55 hover:text-white underline-offset-4 hover:underline disabled:opacity-50"
                      >
                        {resending ? 'Sending…' : 'Didn\u2019t get it? Resend code'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-3 mt-12 pt-8 border-t border-white/[0.06]">
            <motion.button
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={back}
              disabled={submitting}
              className="group inline-flex items-center gap-2 h-11 px-4 text-sm text-white/55 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> Back
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={next}
              disabled={submitting}
              className="group relative inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold text-white overflow-hidden disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
                boxShadow: '0 10px 40px -8px hsla(212,100%,55%,0.55), 0 0 0 1px hsla(212,100%,75%,0.25) inset',
              }}
            >
              {/* Traveling sheen */}
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-16 -translate-x-full pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }}
                animate={{ x: ['-80px', '320px'] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              />
              {/* Glow halo on hover */}
              <span aria-hidden className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: '0 0 60px hsla(195,100%,70%,0.7)' }} />
              <span className="relative inline-flex items-center gap-2">
                {submitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : currentStep === 'account'
                    ? <>{user ? 'Continue' : 'Create account'} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                    : currentStep === 'verify'
                      ? <>{user ? 'Continue' : 'Verify & continue'} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                      : isLast
                        ? (accountType === 'enterprise'
                            ? <>Submit <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                            : <>Continue to checkout <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>)
                        : <>Continue <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>}
              </span>
            </motion.button>
          </div>

          {/* Trust microcopy */}
          <p className="text-[11px] text-white/30 mt-6">
            {currentStep === 'account' || currentStep === 'verify'
              ? 'Your details are encrypted in transit. We never share your email.'
              : currentStep === 'plan' || currentStep === 'billing'
                ? 'You won\u2019t be charged until you confirm payment in the next step.'
                : 'Your choices are saved as you go — you\u2019ll create your account before any payment.'}
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Small atoms
 * ──────────────────────────────────────────────────────────────────── */

const inputCls =
  'w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[hsla(212,100%,60%,0.55)] focus:bg-white/[0.05] transition-all';

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.22em] uppercase text-white/55 font-medium mb-2">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-rose-400 mt-1.5">{error}</span>}
    </label>
  );
}

function ChipGrid({
  options, selected, onToggle, error, multi,
}: {
  options: { id: string; label: string; Icon?: React.ComponentType<{ className?: string }> }[];
  selected: string[];
  onToggle: (id: string) => void;
  error?: string;
  multi?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {options.map(({ id, label, Icon }, i) => {
          const active = selected.includes(id);
          return (
            <motion.button
              key={id}
              onClick={() => onToggle(id)}
              initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.45, delay: 0.05 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'group relative h-28 rounded-2xl border flex flex-col items-center justify-center gap-2 overflow-hidden',
                active
                  ? 'border-[#0A84FF]/60 bg-[#0A84FF]/[0.10] shadow-[0_0_40px_-8px_hsla(212,100%,55%,0.5)]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              )}
            >
              {/* Ambient corner glow on active */}
              {active && (
                <motion.div aria-hidden className="absolute -top-10 -left-10 w-32 h-32 rounded-full pointer-events-none"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ background: 'radial-gradient(circle, hsla(212,100%,60%,0.35), transparent 70%)' }} />
              )}
              {/* Hover sheen */}
              <span aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out pointer-events-none"
                style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)' }} />
              {Icon && <Icon className={cn('w-5 h-5 transition-all duration-300', active ? 'text-[#9DCBFF] scale-110' : 'text-white/55 group-hover:text-white/80')} />}
              <span className="text-sm font-medium relative">{label}</span>
              <AnimatePresence>
                {active && (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #0A84FF, #5AC8FA)' }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3">{error}</p>}
      {multi && <p className="text-[11px] text-white/30 mt-3">Pick as many as apply.</p>}
    </div>
  );
}

function RadioGrid({
  options, selected, onSelect, error, compact,
}: {
  options: { id: string; label: string; desc?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  error?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className={cn('grid gap-3', compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
        {options.map(({ id, label, desc }, i) => {
          const active = selected === id;
          return (
            <motion.button
              key={id}
              onClick={() => onSelect(id)}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.45, delay: 0.04 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'group relative text-left p-4 md:p-5 rounded-2xl border overflow-hidden',
                active
                  ? 'border-[#0A84FF]/60 bg-[#0A84FF]/[0.10] shadow-[0_0_40px_-8px_hsla(212,100%,55%,0.5)]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              )}
            >
              {active && (
                <motion.div aria-hidden className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ background: 'radial-gradient(circle, hsla(212,100%,60%,0.3), transparent 70%)' }} />
              )}
              <span aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out pointer-events-none"
                style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)' }} />
              <div className="relative flex items-center justify-between">
                <p className="text-sm font-semibold">{label}</p>
                <AnimatePresence>
                  {active && (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0A84FF, #5AC8FA)' }}
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {desc && <p className="relative text-xs text-white/45 mt-1">{desc}</p>}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3">{error}</p>}
    </div>
  );
}

function PlanGrid({
  plans, selectedId, onSelect, error,
}: {
  plans: Plan[];
  selectedId: string;
  onSelect: (p: Plan) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((p, i) => {
          const active = selectedId === p.id;
          return (
            <motion.button
              key={p.id}
              onClick={() => onSelect(p)}
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, delay: 0.06 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className={cn(
                'group relative text-left rounded-2xl p-6 border overflow-hidden',
                active
                  ? 'border-[#0A84FF]/65 bg-[#0A84FF]/[0.10] shadow-[0_20px_60px_-12px_hsla(212,100%,55%,0.55)]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              )}
            >
              {/* Active radiant aura */}
              {active && (
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute -inset-px rounded-2xl pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at top left, hsla(212,100%,60%,0.22), transparent 60%)' }}
                />
              )}
              {/* Hover sheen */}
              <span aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1300ms] ease-out pointer-events-none"
                style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)' }} />
              {p.popular && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[0.18em] bg-white text-black font-semibold shadow-[0_0_18px_rgba(255,255,255,0.4)]"
                >
                  ★ Popular
                </motion.div>
              )}
              <div className="relative flex items-center gap-3 mb-4">
                <motion.div
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08]"
                  animate={active ? { scale: [1, 1.08, 1], rotate: [0, 4, 0] } : {}}
                  transition={{ duration: 0.6 }}
                >
                  <p.Icon className={cn('w-4 h-4 transition-colors', active ? 'text-[#9DCBFF]' : 'text-white/55 group-hover:text-white/80')} />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-white/45">{p.tagline}</p>
                </div>
              </div>
              <div className="relative flex items-baseline gap-1.5 mb-4">
                {p.kind === 'contact' ? (
                  <span className="text-2xl font-display font-bold">Talk to sales</span>
                ) : (
                  <>
                    <span className="text-3xl font-display font-bold tracking-tight">${p.price}</span>
                    {p.interval && <span className="text-xs text-white/45">/ {p.interval}</span>}
                    {p.credits && <span className="text-xs text-white/35 ml-2">· {p.credits.toLocaleString()} credits</span>}
                  </>
                )}
              </div>
              <ul className="relative space-y-1.5">
                {p.features.slice(0, 4).map((f, fi) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 + fi * 0.04 }}
                    className="flex items-start gap-2 text-[12px] text-white/65"
                  >
                    <Check className="w-3 h-3 mt-1 text-[#9DCBFF] shrink-0" /> {f}
                  </motion.li>
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
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute top-4 left-4 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0A84FF, #5AC8FA)', boxShadow: '0 0 16px hsla(212,100%,60%,0.6)' }}
                >
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-3">{error}</p>}
    </div>
  );
}

function BillingSummary({ audience, plan }: { audience: AccountType; plan?: Plan }) {
  if (!plan) return <p className="text-white/55 text-sm">Pick a plan first.</p>;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8">
      <p className="text-[10px] tracking-[0.28em] uppercase text-[#9DCBFF] mb-3">Order summary</p>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-2xl font-display font-bold">{plan.name}</h3>
        <p className="text-xl font-display font-bold">
          ${plan.price}{plan.interval ? <span className="text-xs text-white/45">/{plan.interval}</span> : null}
        </p>
      </div>
      <p className="text-sm text-white/55 mb-5">{plan.tagline}</p>
      <ul className="space-y-2 border-t border-white/[0.06] pt-4">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-white/70">
            <Check className="w-3.5 h-3.5 mt-0.5 text-[#9DCBFF] shrink-0" /> {f}
          </li>
        ))}
      </ul>
      <div className="mt-6 p-4 rounded-xl bg-[#0A84FF]/[0.06] border border-[#0A84FF]/20 text-[12px] text-white/70 flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#9DCBFF] mt-0.5 shrink-0" />
        <span>You'll create your account on the next step. Payment opens right after.</span>
      </div>
    </div>
  );
}

/* Lucide doesn't export FileCheck; alias for clarity. */
function FileCheckIcon({ className }: { className?: string }) {
  return <ShieldCheck className={className} />;
}

/* ─────────────────────────────────────────────────────────────────────
 * Cinematic Pane — left-side poster with parallax, ambient motion,
 * step-aware tagline, social proof and audience hero.
 * ──────────────────────────────────────────────────────────────────── */

const AUDIENCE_HERO: Record<AccountType, { img: string; eyebrow: string; title: string; body: string; stats: { k: string; v: string }[] }> = {
  personal: {
    img: heroPersonal,
    eyebrow: 'For Creators',
    title: 'Direct your\nown universe.',
    body: 'A private film studio in your pocket. Cinematic engines, synthetic actors and a render queue that ships at 4K.',
    stats: [
      { k: '4K', v: 'Ultra HD output' },
      { k: '60s', v: 'First clip in' },
      { k: '12+', v: 'Cinematic engines' },
    ],
  },
  business: {
    img: heroBusiness,
    eyebrow: 'For Teams',
    title: 'Your content\nengine, scaled.',
    body: 'Brand kits, multi-seat collaboration and an API that ships campaigns while your team sleeps.',
    stats: [
      { k: '15', v: 'Seats included' },
      { k: '99.9%', v: 'Render uptime' },
      { k: 'API', v: 'Webhooks & SDK' },
    ],
  },
  enterprise: {
    img: heroEnterprise,
    eyebrow: 'For Enterprise',
    title: 'Infinite scale.\nWhite-glove.',
    body: 'SAML SSO, dedicated render lanes, custom DPAs and a production team on standby for your largest moments.',
    stats: [
      { k: 'SSO', v: 'SAML & SCIM' },
      { k: 'SLA', v: '24/7 support' },
      { k: '∞', v: 'Render capacity' },
    ],
  },
};

const STEP_TAGLINE: Partial<Record<StepKey, string>> = {
  goals:   'Tell us what you want to build — we calibrate the engines.',
  usecase: 'Every choice tunes lighting, lensing and edit pace.',
  plan:    'Pick a tier — change anytime, no contracts.',
  profile: 'A name on the credits — yours.',
  company: 'Your team gets its own workspace and brand kit.',
  team:    'We size collaboration tools to your crew.',
  role:    'Tailored shortcuts based on how you work.',
  billing: 'Final review before you take the wheel.',
  scale:   'We pre-allocate render lanes for your volume.',
  needs:   'Compliance, security and integrations on tap.',
  contact: 'A senior partner reaches out within one business day.',
};

function CinematicPane({
  accountType, stepIdx, currentStep,
}: { accountType: AccountType; stepIdx: number; currentStep: StepKey }) {
  const data = AUDIENCE_HERO[accountType];
  const tagline = STEP_TAGLINE[currentStep] ?? '';

  return (
    <div className="relative hidden lg:block overflow-hidden border-r border-white/[0.06]">
      {/* Image stack with crossfade between audiences */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${accountType}`}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src={data.img}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'saturate(0.95) contrast(1.05)' }}
          />
          {/* Cinematic vignette + gradient mask */}
          <div className="absolute inset-0" style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.65) 100%), radial-gradient(ellipse at 30% 20%, hsla(212,100%,55%,0.18), transparent 55%)',
          }} />
          <div className="absolute inset-0" style={{
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.0) 55%, rgba(0,0,0,0.55) 100%)',
          }} />
          {/* Subtle film grain */}
          <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")",
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Floating ambient orb */}
      <motion.div
        aria-hidden
        className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsla(212,100%,55%,0.25), transparent 60%)' }}
        animate={{ x: [0, 40, 0], y: [0, 24, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Anamorphic flare line */}
      <motion.div
        aria-hidden
        className="absolute left-0 right-0 top-1/3 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, hsla(195,100%,75%,0.55), transparent)' }}
        animate={{ opacity: [0, 0.7, 0], scaleX: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Foreground content */}
      <div className="relative z-10 h-full min-h-screen flex flex-col justify-between p-12 xl:p-16">
        {/* Top eyebrow + meta */}
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            <motion.span
              key={`eb-${accountType}`}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-black/30 backdrop-blur text-[10px] tracking-[0.32em] uppercase text-white/80"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5AC8FA] shadow-[0_0_10px_#5AC8FA]" />
              {data.eyebrow}
            </motion.span>
          </AnimatePresence>
          <p className="text-[10px] tracking-[0.32em] uppercase text-white/45">Apex Studio</p>
        </div>

        {/* Headline + tagline */}
        <div className="max-w-[480px]">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`title-${accountType}`}
              initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[44px] xl:text-[60px] leading-[0.98] font-bold tracking-tight text-white whitespace-pre-line"
            >
              {data.title}
            </motion.h2>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={`body-${accountType}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-[15px] leading-relaxed text-white/70"
            >
              {data.body}
            </motion.p>
          </AnimatePresence>

          {/* Step-aware whisper */}
          <div className="h-6 mt-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={`tag-${currentStep}-${accountType}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45 }}
                className="text-[12px] tracking-[0.18em] uppercase text-[#9DCBFF]"
              >
                — {tagline}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom block: stats + social proof */}
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-[460px]">
            {data.stats.map((s, i) => (
              <motion.div
                key={`${accountType}-${s.k}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.08 }}
              >
                <p className="font-display text-2xl font-bold text-white">{s.k}</p>
                <p className="text-[11px] tracking-[0.18em] uppercase text-white/45 mt-1">{s.v}</p>
              </motion.div>
            ))}
          </div>

          {/* Testimonial card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`quote-${accountType}`}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-w-[460px] rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl p-5"
            >
              <Quote className="absolute -top-2.5 left-5 w-5 h-5 text-[#5AC8FA] bg-black rounded-sm p-0.5" />
              <p className="text-[13px] leading-relaxed text-white/85">
                {accountType === 'personal' && '"Made my first cinematic short on a Tuesday night. Friday it was on Netflix\'s creator showcase."'}
                {accountType === 'business' && '"We replaced a six-person video team with two operators and Apex. Output 4×, cost down 70%."'}
                {accountType === 'enterprise' && '"The dedicated render lane shipped our launch in 11 days. Their team felt like an extension of ours."'}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-[#9DCBFF] text-[#9DCBFF]" />
                  ))}
                </div>
                <p className="text-[11px] tracking-[0.18em] uppercase text-white/45">
                  {accountType === 'personal' && 'Maya R. · Filmmaker'}
                  {accountType === 'business' && 'Eli K. · Head of Brand'}
                  {accountType === 'enterprise' && 'Director · Fortune 100'}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────────────
 * OAuth provider glyphs
 * ──────────────────────────────────────────────────────────────────── */

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.99 6.99 0 0 1 5.46 12c0-.73.13-1.44.36-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.04c-.03-2.7 2.2-4 2.3-4.06-1.26-1.84-3.21-2.09-3.91-2.12-1.66-.17-3.24.98-4.09.98-.85 0-2.15-.95-3.54-.93-1.82.03-3.5 1.06-4.43 2.69-1.89 3.27-.48 8.11 1.36 10.78.9 1.31 1.97 2.78 3.36 2.73 1.36-.06 1.87-.88 3.51-.88 1.64 0 2.1.88 3.54.85 1.46-.03 2.39-1.34 3.28-2.66.62-.91 1.27-2.15 1.55-3.21-.04-.02-2.97-1.14-3-4.51zM14.42 4.04c.74-.9 1.24-2.15 1.1-3.39-1.06.04-2.35.71-3.12 1.6-.69.79-1.29 2.06-1.13 3.27 1.18.09 2.39-.6 3.15-1.48z" />
    </svg>
  );
}
