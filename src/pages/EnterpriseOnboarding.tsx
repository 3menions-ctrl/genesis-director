import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  Building2, Briefcase, Palette, ShieldCheck, ArrowRight, ArrowLeft,
  Check, Upload, Loader2, Sparkles, Mail, Lock, User, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

type StepKey = 'account' | 'company' | 'usecase' | 'brand' | 'security' | 'done';

const STEPS: { key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'usecase', label: 'Use case', icon: Briefcase },
  { key: 'brand', label: 'Brand kit', icon: Palette },
  { key: 'security', label: 'Security', icon: ShieldCheck },
];

const accountSchema = z.object({
  email: z.string().trim().email('Enter a valid work email').max(255),
  password: z.string().min(8, 'Use at least 8 characters').max(120),
  fullName: z.string().trim().min(2, 'Tell us your name').max(120),
});
const companySchema = z.object({
  company_name: z.string().trim().min(2, 'Company name is required').max(160),
  company_size: z.string().min(1, 'Select a size'),
  industry: z.string().trim().max(120).optional().or(z.literal('')),
  website: z.string().trim().url('Enter a valid URL').max(255).optional().or(z.literal('')),
  role: z.string().trim().max(120).optional().or(z.literal('')),
});
const usecaseSchema = z.object({
  primary_use_case: z.string().min(1, 'Pick a primary use case'),
  expected_videos_per_month: z.string().min(1, 'Pick an expected volume'),
  target_launch_date: z.string().optional().or(z.literal('')),
});

const SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const INDUSTRY_OPTIONS = ['Marketing & Ads', 'Media & Entertainment', 'E-commerce', 'Education', 'Gaming', 'Tech / SaaS', 'Other'];
const USECASE_OPTIONS = ['Brand campaigns', 'Product launches', 'Social content at scale', 'Training & internal comms', 'Localized creative', 'Other'];
const VOLUME_OPTIONS = ['< 50 / mo', '50–250 / mo', '250–1,000 / mo', '1,000–5,000 / mo', '5,000+ / mo'];
const RESIDENCY_OPTIONS = ['No preference', 'United States', 'European Union', 'United Kingdom', 'APAC'];

export default function EnterpriseOnboarding() {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx]?.key ?? 'done';
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Form state
  const [account, setAccount] = useState({ email: user?.email ?? '', password: '', fullName: '' });
  const [company, setCompany] = useState({ company_name: '', company_size: '', industry: '', website: '', role: '' });
  const [usecase, setUsecase] = useState({ primary_use_case: '', expected_videos_per_month: '', target_launch_date: '' });
  const [brand, setBrand] = useState({ logoFile: null as File | null, logoPreview: '', primary: '#0A84FF', secondary: '#0F172A', font: '', notes: '' });
  const [security, setSecurity] = useState({ needs_sso: false, needs_dpa: false, data_residency: 'No preference', security_questionnaire_requested: false, nda_requested: false });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Skip account step if already signed in
  useEffect(() => {
    if (user && stepIdx === 0) setStepIdx(1);
  }, [user, stepIdx]);

  const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIdx(i => Math.max(i - 1, 0));

  const validateStep = useCallback((): boolean => {
    setErrors({});
    if (step === 'account' && !user) {
      const r = accountSchema.safeParse(account);
      if (!r.success) {
        const fe = r.error.flatten().fieldErrors;
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0] ?? ''])));
        return false;
      }
    }
    if (step === 'company') {
      const r = companySchema.safeParse(company);
      if (!r.success) {
        const fe = r.error.flatten().fieldErrors;
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0] ?? ''])));
        return false;
      }
    }
    if (step === 'usecase') {
      const r = usecaseSchema.safeParse(usecase);
      if (!r.success) {
        const fe = r.error.flatten().fieldErrors;
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0] ?? ''])));
        return false;
      }
    }
    return true;
  }, [step, account, company, usecase, user]);

  const onContinue = async () => {
    if (!validateStep()) return;
    if (step === 'account' && !user) {
      // Create the account inline so brand kit upload (which needs auth.uid folder) works in step 'brand'.
      setSubmitting(true);
      try {
        const { error } = await supabase.auth.signUp({
          email: account.email.trim().toLowerCase(),
          password: account.password,
          options: {
            emailRedirectTo: `${window.location.origin}/enterprise/onboarding`,
            data: { display_name: account.fullName.trim() },
          },
        });
        if (error) throw error;
        toast.success('Account created — continuing onboarding');
      } catch (e: any) {
        const msg = e?.message ?? 'Could not create your account';
        if (/already registered|exists/i.test(msg)) {
          toast.error('That email already has an account. Please sign in first.');
          navigate('/auth?mode=login&redirect=/enterprise/onboarding');
        } else {
          toast.error(msg);
        }
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }
    next();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      const email = session?.user?.email ?? account.email.trim().toLowerCase();
      if (!uid) {
        toast.error('Please verify your email and sign in to finish.');
        navigate('/auth?mode=login&redirect=/enterprise/onboarding');
        return;
      }

      // Upload brand logo if provided
      let brand_logo_url: string | null = null;
      if (brand.logoFile) {
        const ext = brand.logoFile.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${uid}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('enterprise-brand-kits')
          .upload(path, brand.logoFile, { cacheControl: '3600', upsert: false });
        if (upErr) {
          console.warn('Brand logo upload failed', upErr);
        } else {
          const { data } = supabase.storage.from('enterprise-brand-kits').getPublicUrl(path);
          brand_logo_url = data.publicUrl;
        }
      }

      const payload = {
        user_id: uid,
        email,
        company_name: company.company_name.trim(),
        company_size: company.company_size || null,
        industry: company.industry?.trim() || null,
        website: company.website?.trim() || null,
        role: company.role?.trim() || null,
        primary_use_case: usecase.primary_use_case || null,
        expected_videos_per_month: usecase.expected_videos_per_month || null,
        target_launch_date: usecase.target_launch_date || null,
        brand_logo_url,
        brand_color_primary: brand.primary || null,
        brand_color_secondary: brand.secondary || null,
        brand_font: brand.font?.trim() || null,
        brand_notes: brand.notes?.trim() || null,
        needs_sso: security.needs_sso,
        needs_dpa: security.needs_dpa,
        data_residency: security.data_residency || null,
        security_questionnaire_requested: security.security_questionnaire_requested,
        nda_requested: security.nda_requested,
        status: 'new',
      };

      const { error: insErr } = await supabase.from('enterprise_leads').insert(payload);
      if (insErr) throw insErr;

      setDone(true);
      toast.success('Welcome to Apex Enterprise');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save your details');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = useMemo(() => Math.round(((stepIdx + 1) / STEPS.length) * 100), [stepIdx]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Cinematic background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, hsla(212,100%,40%,0.18), transparent 55%), radial-gradient(ellipse at 80% 100%, hsla(195,100%,55%,0.14), transparent 55%), #000',
          }}
        />
        <motion.div
          aria-hidden
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsla(212,100%,55%,0.15), transparent 60%)' }}
          animate={{ scale: [1, 1.08, 1] }}
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

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-16 pb-24">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 border border-white/10 bg-white/[0.03] backdrop-blur">
            <Sparkles className="w-3 h-3 text-[#9DCBFF]" />
            <span className="text-[10px] tracking-[0.32em] uppercase text-white/65 font-medium">
              Apex Enterprise
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
            A studio built around{' '}
            <span style={{ background: 'linear-gradient(90deg,#fff,#9DCBFF,#0A84FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              your brand
            </span>
          </h1>
          <p className="text-white/55 text-base font-light mt-4 max-w-xl mx-auto">
            Five short steps. We'll set up your account, your brand kit, and brief our team.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 md:gap-3 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === stepIdx;
            const complete = i < stepIdx || done;
            return (
              <div key={s.key} className="flex items-center gap-2 md:gap-3">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all"
                  style={{
                    borderColor: active ? 'hsla(212,100%,60%,0.55)' : complete ? 'hsla(212,100%,55%,0.3)' : 'hsla(0,0%,100%,0.08)',
                    background: active ? 'hsla(212,100%,55%,0.10)' : complete ? 'hsla(212,100%,55%,0.05)' : 'transparent',
                  }}
                >
                  {complete ? (
                    <Check className="w-3.5 h-3.5 text-[#9DCBFF]" />
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-white/45'}`} />
                  )}
                  <span className={`text-[10px] tracking-[0.22em] uppercase font-medium ${active ? 'text-white' : complete ? 'text-white/70' : 'text-white/40'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="relative h-px bg-white/[0.06] mb-12 max-w-xl mx-auto rounded-full overflow-hidden">
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
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
          }}
        >
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <AnimatePresence mode="wait">
            <motion.div
              key={done ? 'done' : step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {done ? (
                <DoneStep onPrimary={() => navigate('/projects')} onSecondary={() => navigate('/contact?topic=enterprise')} />
              ) : step === 'account' ? (
                <AccountStep value={account} onChange={setAccount} errors={errors} />
              ) : step === 'company' ? (
                <CompanyStep value={company} onChange={setCompany} errors={errors} />
              ) : step === 'usecase' ? (
                <UsecaseStep value={usecase} onChange={setUsecase} errors={errors} />
              ) : step === 'brand' ? (
                <BrandStep value={brand} onChange={setBrand} />
              ) : (
                <SecurityStep value={security} onChange={setSecurity} />
              )}
            </motion.div>
          </AnimatePresence>

          {!done && (
            <div className="flex items-center justify-between gap-3 mt-10 pt-8 border-t border-white/[0.06]">
              <button
                onClick={prev}
                disabled={stepIdx === 0 || submitting}
                className="inline-flex items-center gap-1.5 h-11 px-4 text-sm text-white/65 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              {step === 'security' ? (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-sm font-medium text-white transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
                    boxShadow: '0 0 28px hsla(212,100%,55%,0.45)',
                  }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Finish onboarding
                </button>
              ) : (
                <button
                  onClick={onContinue}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-sm font-medium text-white transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
                    boxShadow: '0 0 28px hsla(212,100%,55%,0.4)',
                  }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Continue
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Step components ---------- */

function Field({
  label, children, hint, error,
}: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.22em] uppercase text-white/55 font-medium mb-2">{label}</span>
      {children}
      {hint && !error && <span className="block text-[11px] text-white/35 mt-1.5">{hint}</span>}
      {error && <span className="block text-[11px] text-rose-400 mt-1.5">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[hsla(212,100%,60%,0.55)] focus:bg-white/[0.05] transition-all';

function StepHeader({ icon: Icon, kicker, title, copy }: { icon: React.ComponentType<{ className?: string }>; kicker: string; title: string; copy: string }) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', border: '1px solid hsla(0,0%,100%,0.08)' }}>
        <Icon className="w-5 h-5 text-[#9DCBFF]" />
      </div>
      <p className="text-[10px] tracking-[0.28em] uppercase text-white/45 font-medium mb-2">{kicker}</p>
      <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="text-white/55 text-sm font-light mt-2 max-w-lg">{copy}</p>
    </div>
  );
}

function AccountStep({ value, onChange, errors }: any) {
  return (
    <div>
      <StepHeader icon={User} kicker="Step 1" title="Create your account" copy="Use your work email so we can route your access correctly." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full name" error={errors.fullName}>
          <input className={inputCls} placeholder="Jane Director" value={value.fullName} onChange={e => onChange({ ...value, fullName: e.target.value })} />
        </Field>
        <Field label="Work email" error={errors.email}>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input className={inputCls + ' pl-10'} type="email" placeholder="jane@studio.com" value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} />
          </div>
        </Field>
        <Field label="Password" hint="At least 8 characters" error={errors.password}>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input className={inputCls + ' pl-10'} type="password" placeholder="••••••••" value={value.password} onChange={e => onChange({ ...value, password: e.target.value })} />
          </div>
        </Field>
      </div>
    </div>
  );
}

function CompanyStep({ value, onChange, errors }: any) {
  return (
    <div>
      <StepHeader icon={Building2} kicker="Step 2" title="Tell us about your company" copy="Helps us assign the right success manager and tier." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Company name" error={errors.company_name}>
          <input className={inputCls} value={value.company_name} onChange={e => onChange({ ...value, company_name: e.target.value })} placeholder="Apex-Studio" />
        </Field>
        <Field label="Your role">
          <input className={inputCls} value={value.role} onChange={e => onChange({ ...value, role: e.target.value })} placeholder="Head of Creative" />
        </Field>
        <Field label="Company size" error={errors.company_size}>
          <Chips options={SIZE_OPTIONS} value={value.company_size} onChange={v => onChange({ ...value, company_size: v })} />
        </Field>
        <Field label="Industry">
          <Chips options={INDUSTRY_OPTIONS} value={value.industry} onChange={v => onChange({ ...value, industry: v })} />
        </Field>
        <Field label="Website" error={errors.website}>
          <input className={inputCls} value={value.website} onChange={e => onChange({ ...value, website: e.target.value })} placeholder="https://yourbrand.com" />
        </Field>
      </div>
    </div>
  );
}

function UsecaseStep({ value, onChange, errors }: any) {
  return (
    <div>
      <StepHeader icon={Briefcase} kicker="Step 3" title="What will you create?" copy="A quick read on volume so we can size the right plan." />
      <div className="space-y-6">
        <Field label="Primary use case" error={errors.primary_use_case}>
          <Chips options={USECASE_OPTIONS} value={value.primary_use_case} onChange={v => onChange({ ...value, primary_use_case: v })} />
        </Field>
        <Field label="Expected volume per month" error={errors.expected_videos_per_month}>
          <Chips options={VOLUME_OPTIONS} value={value.expected_videos_per_month} onChange={v => onChange({ ...value, expected_videos_per_month: v })} />
        </Field>
        <Field label="Target launch date" hint="Optional — when do you want to be live?">
          <input type="date" className={inputCls} value={value.target_launch_date} onChange={e => onChange({ ...value, target_launch_date: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function BrandStep({ value, onChange }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error('Logo must be under 4MB'); return; }
    const url = URL.createObjectURL(f);
    onChange({ ...value, logoFile: f, logoPreview: url });
  };
  return (
    <div>
      <StepHeader icon={Palette} kicker="Step 4" title="Bring your brand" copy="We'll lock these into your generations so every output stays on-brand." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Brand logo" hint="PNG or SVG, up to 4MB">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-full h-32 rounded-xl border border-dashed border-white/15 hover:border-[hsla(212,100%,60%,0.55)] bg-white/[0.02] hover:bg-white/[0.04] transition-all flex items-center justify-center overflow-hidden"
          >
            {value.logoPreview ? (
              <img src={value.logoPreview} alt="Brand logo preview" className="max-h-24 max-w-[80%] object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/45">
                <Upload className="w-5 h-5" />
                <span className="text-[11px] tracking-[0.2em] uppercase">Upload logo</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </button>
        </Field>

        <Field label="Brand fonts" hint="Optional, e.g. Sora / Söhne">
          <input className={inputCls} value={value.font} onChange={e => onChange({ ...value, font: e.target.value })} placeholder="Söhne, Inter…" />
        </Field>

        <Field label="Primary color">
          <ColorInput value={value.primary} onChange={v => onChange({ ...value, primary: v })} />
        </Field>
        <Field label="Secondary color">
          <ColorInput value={value.secondary} onChange={v => onChange({ ...value, secondary: v })} />
        </Field>

        <div className="md:col-span-2">
          <Field label="Brand notes" hint="Voice, tone, do's and don'ts">
            <textarea
              rows={4}
              className={inputCls + ' h-auto py-3 leading-relaxed resize-none'}
              value={value.notes}
              onChange={e => onChange({ ...value, notes: e.target.value })}
              placeholder="Confident, premium, never playful. Avoid neon colors…"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function SecurityStep({ value, onChange }: any) {
  return (
    <div>
      <StepHeader icon={ShieldCheck} kicker="Step 5" title="Security & compliance" copy="Tell us what your team needs in place before going live." />
      <div className="space-y-3">
        <Toggle label="SAML / SSO required" desc="Single sign-on via Okta, Azure AD, Google Workspace." checked={value.needs_sso} onChange={v => onChange({ ...value, needs_sso: v })} />
        <Toggle label="Data Processing Agreement (DPA)" desc="GDPR-compliant DPA before launch." checked={value.needs_dpa} onChange={v => onChange({ ...value, needs_dpa: v })} />
        <Toggle label="Send me the security questionnaire" desc="SOC 2, encryption, sub-processors, audit." checked={value.security_questionnaire_requested} onChange={v => onChange({ ...value, security_questionnaire_requested: v })} />
        <Toggle label="Mutual NDA" desc="We'll send a standard mutual NDA for signature." checked={value.nda_requested} onChange={v => onChange({ ...value, nda_requested: v })} />
        <div className="pt-3">
          <Field label="Preferred data residency">
            <Chips options={RESIDENCY_OPTIONS} value={value.data_residency} onChange={v => onChange({ ...value, data_residency: v })} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function DoneStep({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <div className="text-center py-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6"
        style={{ background: 'linear-gradient(135deg,#0A84FF,#5AC8FA)', boxShadow: '0 0 40px hsla(212,100%,55%,0.5)' }}
      >
        <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
      </motion.div>
      <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3">You're in.</h2>
      <p className="text-white/60 text-base font-light max-w-md mx-auto mb-8">
        Your dedicated Apex team will reach out within one business day. In the meantime, your studio is ready.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button onClick={onPrimary} className="h-12 px-7 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-all">
          Open my studio
        </button>
        <button onClick={onSecondary} className="h-12 px-7 rounded-full text-white/70 hover:text-white text-sm font-medium hover:bg-white/[0.06] transition-all">
          Book a kickoff call
        </button>
      </div>
    </div>
  );
}

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="h-9 px-3.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: active ? 'hsla(212,100%,55%,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? 'hsla(212,100%,60%,0.55)' : 'hsla(0,0%,100%,0.08)'}`,
              color: active ? '#fff' : 'rgba(255,255,255,0.65)',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-11 h-11 rounded-xl border border-white/10 bg-transparent cursor-pointer" />
      <input className={inputCls} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-4 rounded-xl text-left transition-all"
      style={{
        background: checked ? 'hsla(212,100%,55%,0.07)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${checked ? 'hsla(212,100%,60%,0.4)' : 'hsla(0,0%,100%,0.07)'}`,
      }}
    >
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/50 mt-0.5">{desc}</div>
      </div>
      <div
        className="relative w-10 h-6 rounded-full flex-shrink-0 transition-all"
        style={{ background: checked ? 'linear-gradient(90deg,#0A84FF,#5AC8FA)' : 'rgba(255,255,255,0.12)' }}
      >
        <motion.span
          animate={{ x: checked ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
        />
      </div>
    </button>
  );
}
