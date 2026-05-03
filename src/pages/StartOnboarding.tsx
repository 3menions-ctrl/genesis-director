import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  User, Briefcase, Building2, ArrowRight, ArrowLeft, Check, Sparkles,
  Film, Megaphone, Wand2, Crown, Gem,
  Loader2, X, Cpu, ShieldCheck, Star, Quote,
} from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
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

const PERSONAL_STEPS = ['goals', 'usecase', 'plan', 'profile'] as const;
const BUSINESS_STEPS = ['company', 'team', 'role', 'plan', 'billing'] as const;
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

/* ─────────────────────────────────────────────────────────────────────
 * Schemas
 * ──────────────────────────────────────────────────────────────────── */

const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Tell us your name').max(100),
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
  const initialType = (params.get('type') as AccountType) || 'personal';
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
  }, [currentStep, form]);

  const next = () => {
    if (!validate()) return;
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

  /* ── Finish: persist intent and route to signup ────────────────── */
  const finish = async () => {
    setSubmitting(true);
    try {
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
      if (error) throw error;

      try { sessionStorage.setItem('apex.intent_token', token); } catch {}
      try { localStorage.setItem('apex.audience', accountType); } catch {}

      // Route differently per audience
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

      const next = form.selected_plan_kind === 'contact'
        ? '/projects'
        : form.selected_plan_id
          ? `/welcome/checkout?plan=${form.selected_plan_id}`
          : '/create';

      navigate(`/auth?mode=signup&intent=${token}&audience=${accountType}&next=${encodeURIComponent(next)}`);
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
      {/* Background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background:
            'radial-gradient(ellipse at 20% 0%, hsla(212,100%,40%,0.18), transparent 55%), radial-gradient(ellipse at 80% 100%, hsla(195,100%,55%,0.12), transparent 55%), #000',
        }} />
        <motion.div aria-hidden
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsla(212,100%,55%,0.15), transparent 60%)' }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Close */}
      <button
        onClick={() => navigate('/')}
        aria-label="Close"
        className="absolute top-6 right-6 z-20 w-10 h-10 inline-flex items-center justify-center rounded-full text-white/55 hover:text-white hover:bg-white/[0.06] transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-12 pb-24">
        {/* Brand row */}
        <div className="flex items-center justify-center mb-8">
          <Logo size="lg" showText textClassName="text-lg font-display font-bold" />
        </div>

        {/* Audience switcher */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur">
            {(['personal','business','enterprise'] as AccountType[]).map(t => {
              const active = accountType === t;
              const Icon = t === 'personal' ? User : t === 'business' ? Briefcase : Building2;
              return (
                <button
                  key={t}
                  onClick={() => setAccountType(t)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-[0.18em] font-medium transition-all',
                    active
                      ? 'bg-white text-black shadow-[0_8px_30px_-8px_rgba(255,255,255,0.5)]'
                      : 'text-white/55 hover:text-white'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-10">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[#9DCBFF] font-medium mb-3">
            Step {stepIdx + 1} of {steps.length} · {STEP_META[currentStep].label}
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            {STEP_META[currentStep].copy}
          </h1>
        </div>

        {/* Progress */}
        <div className="relative h-px bg-white/[0.06] mb-10 max-w-xl mx-auto rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* Card */}
        <div
          className="relative rounded-3xl p-8 md:p-12 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
            border: '1px solid hsla(0,0%,100%,0.08)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.55)',
          }}
        >
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${accountType}-${currentStep}`}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
            </motion.div>
          </AnimatePresence>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-3 mt-10 pt-8 border-t border-white/[0.06]">
            <button
              onClick={back}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 h-11 px-4 text-sm text-white/65 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={next}
              disabled={submitting}
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
                boxShadow: '0 0 32px hsla(212,100%,55%,0.45)',
              }}
            >
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isLast
                  ? (accountType === 'enterprise' ? <>Submit <ArrowRight className="w-4 h-4" /></> : <>Continue to signup <ArrowRight className="w-4 h-4" /></>)
                  : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>

        {/* Trust microcopy */}
        <p className="text-center text-[11px] text-white/30 mt-8">
          You're not creating an account yet. We'll only ask for credentials at the end.
        </p>
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
        {options.map(({ id, label, Icon }) => {
          const active = selected.includes(id);
          return (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className={cn(
                'group relative h-28 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all',
                active
                  ? 'border-[#0A84FF]/55 bg-[#0A84FF]/[0.08] shadow-[0_0_30px_-8px_hsla(212,100%,55%,0.4)]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
              )}
            >
              {Icon && <Icon className={cn('w-5 h-5 transition', active ? 'text-[#9DCBFF]' : 'text-white/55')} />}
              <span className="text-sm font-medium">{label}</span>
              {active && <Check className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-[#9DCBFF]" />}
            </button>
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
        {options.map(({ id, label, desc }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={cn(
                'text-left p-4 md:p-5 rounded-2xl border transition-all',
                active
                  ? 'border-[#0A84FF]/55 bg-[#0A84FF]/[0.08] shadow-[0_0_30px_-8px_hsla(212,100%,55%,0.4)]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{label}</p>
                {active && <Check className="w-4 h-4 text-[#9DCBFF]" />}
              </div>
              {desc && <p className="text-xs text-white/45 mt-1">{desc}</p>}
            </button>
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
        {plans.map((p) => {
          const active = selectedId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={cn(
                'relative text-left rounded-2xl p-6 border transition-all overflow-hidden',
                active
                  ? 'border-[#0A84FF]/55 bg-[#0A84FF]/[0.08] shadow-[0_0_36px_-10px_hsla(212,100%,55%,0.5)]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
              )}
            >
              {p.popular && (
                <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.18em] bg-white text-black font-semibold">
                  Popular
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08]">
                  <p.Icon className="w-4 h-4 text-[#9DCBFF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-white/45">{p.tagline}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mb-4">
                {p.kind === 'contact' ? (
                  <span className="text-2xl font-display font-bold">Talk to sales</span>
                ) : (
                  <>
                    <span className="text-3xl font-display font-bold">${p.price}</span>
                    {p.interval && <span className="text-xs text-white/45">/ {p.interval}</span>}
                    {p.credits && <span className="text-xs text-white/35 ml-2">· {p.credits.toLocaleString()} credits</span>}
                  </>
                )}
              </div>
              <ul className="space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-white/65">
                    <Check className="w-3 h-3 mt-1 text-[#9DCBFF] shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {active && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#0A84FF] to-[#5AC8FA]" />
              )}
            </button>
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