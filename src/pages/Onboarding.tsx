import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Sparkles, ArrowRight, ArrowLeft, Check,
  Building2, Rocket, Palette, Loader2, Users, Mail, Plus, X,
  Megaphone, ShoppingBag, Globe, Film, BarChart3, Users2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { Logo } from '@/components/ui/Logo';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

// ─────────────────────────────────────────────────────────────────────
// Static config
// ─────────────────────────────────────────────────────────────────────

const TEAM_SIZES = [
  { id: '1',     label: 'Just me' },
  { id: '2-10',  label: '2–10' },
  { id: '11-50', label: '11–50' },
  { id: '51-200',label: '51–200' },
  { id: '200+',  label: '200+' },
];

const INDUSTRIES = [
  'SaaS / Technology', 'E-commerce / DTC', 'Marketing Agency',
  'Media & Entertainment', 'Education', 'Finance', 'Healthcare',
  'Real Estate', 'Other',
];

const USE_CASES = [
  { id: 'paid_ads',    label: 'Performance Ads',  icon: Megaphone,  desc: 'Meta, TikTok, YouTube creative at scale' },
  { id: 'launches',    label: 'Product Launches', icon: ShoppingBag,desc: 'Hero films, social cuts, lifecycle' },
  { id: 'localization',label: 'Localization',     icon: Globe,      desc: 'Multilingual ads from one source' },
  { id: 'sales',       label: 'Sales Outreach',   icon: Users2,     desc: 'Personalized prospect videos' },
  { id: 'brand',       label: 'Brand Storytelling', icon: Film,     desc: 'Cinematic explainers and case studies' },
  { id: 'social',      label: 'Always-on Social', icon: BarChart3,  desc: 'Weekly content engine' },
];

const BRAND_PRESETS = [
  { primary: '#0A84FF', accent: '#0EA5E9', label: 'Apple Blue' },
  { primary: '#7C3AED', accent: '#EC4899', label: 'Vibrant' },
  { primary: '#10B981', accent: '#84CC16', label: 'Nature' },
  { primary: '#F59E0B', accent: '#EF4444', label: 'Bold' },
  { primary: '#1E293B', accent: '#64748B', label: 'Mono' },
  { primary: '#F43F5E', accent: '#A855F7', label: 'Sunset' },
];

const STEPS = [
  { title: 'Tell us about you',     subtitle: 'Your name and role',           badge: 'Profile',   icon: User },
  { title: 'Create your workspace', subtitle: 'Set up your team workspace',   badge: 'Workspace', icon: Building2 },
  { title: 'Brand basics',          subtitle: 'Lock your colors from day one', badge: 'Brand',    icon: Palette },
  { title: 'Primary use case',      subtitle: 'What will your team ship?',     badge: 'Focus',    icon: Rocket },
  { title: 'Invite your team',      subtitle: 'Bring producers and reviewers', badge: 'Team',     icon: Users },
];

const sanitizeText = (text: string): string =>
  text.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '').trim();

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name contains invalid characters'),
  jobTitle: z.string().trim().max(80, 'Title is too long').optional(),
});

const workspaceSchema = z.object({
  workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(60, 'Too long')
    .regex(/^[a-zA-Z0-9\s\-'.&]+$/, 'Invalid characters'),
  industry: z.string().min(1, 'Please pick an industry'),
  teamSize: z.string().min(1, 'Please pick a team size'),
});

const emailSchema = z.string().trim().toLowerCase().email('Invalid email').max(255);

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, refreshProfile, loading: authLoading, isSessionVerified } = useAuth();
  const { refresh: refreshWorkspaces, switchOrg } = useWorkspace();
  const { navigate } = useSafeNavigation();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    jobTitle: '',
    workspaceName: '',
    industry: '',
    teamSize: '',
    brandPrimary: '#0A84FF',
    brandAccent: '#0EA5E9',
    useCase: '',
  });

  const [invites, setInvites] = useState<{ email: string; role: 'admin' | 'producer' | 'reviewer' }[]>([
    { email: '', role: 'producer' },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  // ─── Auth gate ─────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !isSessionVerified) return;
    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth', { replace: true });
      return;
    }
    setSessionChecked(true);
  }, [user, authLoading, isSessionVerified, navigate]);

  // ─── Step navigation ───────────────────────────────────────────────
  const validateStep = useCallback((): boolean => {
    if (step === 1) {
      const r = profileSchema.safeParse({ fullName: form.fullName, jobTitle: form.jobTitle });
      if (!r.success) {
        setErrors({ [r.error.errors[0].path[0] as string]: r.error.errors[0].message });
        return false;
      }
    }
    if (step === 2) {
      const r = workspaceSchema.safeParse({
        workspaceName: form.workspaceName,
        industry: form.industry,
        teamSize: form.teamSize,
      });
      if (!r.success) {
        const errs: Record<string, string> = {};
        r.error.errors.forEach(e => { if (e.path[0]) errs[e.path[0] as string] = e.message; });
        setErrors(errs);
        return false;
      }
    }
    if (step === 4 && !form.useCase) {
      setErrors({ useCase: 'Please pick a primary use case' });
      return false;
    }
    setErrors({});
    return true;
  }, [step, form]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    setDirection(1);
    setStep(s => s + 1);
  }, [validateStep]);

  const handleBack = () => {
    if (step > 1) { setDirection(-1); setStep(s => s - 1); }
  };

  // ─── Workspace creation (between step 4 and 5) ─────────────────────
  const createWorkspace = async (): Promise<string | null> => {
    if (!user) return null;
    const slug = `${form.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: sanitizeText(form.workspaceName),
        slug,
        industry: form.industry,
        team_size: form.teamSize,
        brand_primary_color: form.brandPrimary,
        brand_accent_color: form.brandAccent,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (error) {
      toast.error(`Could not create workspace: ${error.message}`);
      return null;
    }
    return data.id;
  };

  const sendInvites = async (orgId: string) => {
    const valid = invites.filter(i => i.email.trim() && emailSchema.safeParse(i.email).success);
    if (!valid.length || !user) return;
    const rows = valid.map(i => ({
      organization_id: orgId,
      email: i.email.trim().toLowerCase(),
      role: i.role,
      invited_by: user.id,
    }));
    const { error } = await supabase.from('organization_invites').insert(rows);
    if (error) {
      toast.error(`Some invites failed: ${error.message}`);
    } else if (rows.length > 0) {
      toast.success(`Sent ${rows.length} invite${rows.length > 1 ? 's' : ''}`);
    }
  };

  // ─── Final commit ──────────────────────────────────────────────────
  const handleComplete = async (skipInvites = false) => {
    if (!validateStep()) return;
    if (!user) { toast.error('Session expired.'); navigate('/auth', { replace: true }); return; }
    setLoading(true);
    try {
      // 1. Save profile
      const sanitized = {
        full_name: sanitizeText(form.fullName),
        display_name: sanitizeText(form.fullName).split(' ')[0],
        job_title: form.jobTitle ? sanitizeText(form.jobTitle) : null,
        company: sanitizeText(form.workspaceName),
        use_case: form.useCase,
        onboarding_completed: true,
      };
      const { error: pErr } = await supabase.from('profiles').update(sanitized).eq('id', user.id);
      if (pErr) console.error('[Onboarding] profile update warn:', pErr);

      // 2. Create workspace if not already
      let orgId = createdOrgId;
      if (!orgId) {
        orgId = await createWorkspace();
        if (!orgId) { setLoading(false); return; }
        setCreatedOrgId(orgId);
        // Mark workspace onboarding done
        await supabase
          .from('organizations')
          .update({ onboarding_completed: true })
          .eq('id', orgId);
      }

      // 3. Send invites
      if (!skipInvites) {
        await sendInvites(orgId);
      }

      // 4. Refresh contexts and route
      await refreshProfile();
      await refreshWorkspaces();
      switchOrg(orgId);

      toast.success('Workspace ready');
      const next = new URLSearchParams(window.location.search).get('next');
      navigate(next || '/create', { replace: true });
    } catch (err) {
      console.error('[Onboarding] completion error:', err);
      toast.error('Failed to finish setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Loading state ─────────────────────────────────────────────────
  if (authLoading || !isSessionVerified || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,14%,2%)]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Logo size="xl" />
          <p className="text-white/60 text-sm">Setting up your workspace…</p>
          <div className="w-6 h-6 border-2 border-[#0A84FF]/30 border-t-[#0A84FF] rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  const currentStep = STEPS[step - 1];
  const totalSteps = STEPS.length;
  const isLast = step === totalSteps;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex relative overflow-hidden bg-[hsl(220,14%,2%)] text-white">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-[0.12] pointer-events-none"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(10,132,255,0.08), transparent 60%)' }}
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Left rail — step list */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-12 xl:p-14 relative z-10 border-r border-white/[0.04]">
        <Logo size="lg" showText textClassName="text-xl font-display font-bold" />

        <div className="space-y-6">
          <div>
            <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-3">
              Workspace setup
            </p>
            <h2 className="font-display text-4xl xl:text-5xl font-bold text-white leading-[1.05] tracking-tight">
              Let's get<br/>your team<br/>shipping.
            </h2>
            <p className="mt-5 text-white/45 text-sm max-w-sm leading-relaxed">
              Five quick steps. You'll have a branded workspace and invitations
              out before your coffee gets cold.
            </p>
          </div>

          <div className="space-y-2 max-w-sm pt-4">
            {STEPS.map((s, i) => {
              const stepNum = i + 1;
              const done = step > stepNum;
              const active = step === stepNum;
              return (
                <div
                  key={s.title}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300',
                    done
                      ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                      : active
                        ? 'border-[#0A84FF]/30 bg-[#0A84FF]/[0.06]'
                        : 'border-white/[0.04] bg-white/[0.01]'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 transition-all',
                    done ? 'bg-emerald-500/15 text-emerald-400'
                      : active ? 'bg-[#0A84FF]/15 text-[#0A84FF]'
                      : 'bg-white/[0.03] text-white/25'
                  )}>
                    {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      'text-sm font-medium transition-colors truncate',
                      done ? 'text-emerald-400/80' : active ? 'text-white' : 'text-white/30'
                    )}>{s.title}</p>
                    <p className={cn(
                      'text-[11px] transition-colors truncate',
                      done ? 'text-emerald-400/40' : active ? 'text-white/40' : 'text-white/15'
                    )}>{s.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-white/20 tracking-wide">
          Need help? <a href="/contact" className="text-white/40 hover:text-white underline underline-offset-2">Contact sales</a>
        </p>
      </div>

      {/* Right pane — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10 overflow-y-auto">
        <motion.div
          className="w-full max-w-[560px] relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <Logo size="lg" />
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/30 font-medium">Step {step} of {totalSteps}</span>
              <span className="text-xs text-[#0A84FF]/80 font-medium">{currentStep.badge}</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#0EA5E9]"
                initial={false}
                animate={{ width: `${(step / totalSteps) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl p-7 sm:p-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={`hdr-${step}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="mb-7"
              >
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight mb-1.5">
                  {currentStep.title}
                </h2>
                <p className="text-white/40 text-sm">{currentStep.subtitle}</p>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {/* ─── STEP 1: Profile ─── */}
                {step === 1 && (
                  <div className="space-y-5">
                    <FieldText
                      id="fullName" label="Full name" icon={User}
                      placeholder="Jane Cooper" value={form.fullName}
                      onChange={v => { setForm({ ...form, fullName: v }); if (errors.fullName) setErrors({}); }}
                      error={errors.fullName} autoFocus maxLength={100}
                    />
                    <FieldText
                      id="jobTitle" label="Job title" icon={Building2} optional
                      placeholder="Head of Marketing" value={form.jobTitle}
                      onChange={v => setForm({ ...form, jobTitle: v })}
                      maxLength={80}
                    />
                  </div>
                )}

                {/* ─── STEP 2: Workspace ─── */}
                {step === 2 && (
                  <div className="space-y-5">
                    <FieldText
                      id="workspaceName" label="Workspace name" icon={Building2}
                      placeholder="Acme Marketing"
                      hint="This is what your team will see in the app."
                      value={form.workspaceName}
                      onChange={v => { setForm({ ...form, workspaceName: v }); if (errors.workspaceName) setErrors({}); }}
                      error={errors.workspaceName} autoFocus maxLength={60}
                    />

                    <div className="space-y-2">
                      <Label className="text-white/55 text-xs font-medium uppercase tracking-wider">Industry</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {INDUSTRIES.map(ind => (
                          <button
                            key={ind} type="button"
                            onClick={() => { setForm({ ...form, industry: ind }); setErrors(e => ({ ...e, industry: '' })); }}
                            className={cn(
                              'px-3.5 py-2.5 rounded-xl text-xs font-medium text-left transition-all border',
                              form.industry === ind
                                ? 'bg-[#0A84FF]/10 border-[#0A84FF]/40 text-white'
                                : 'bg-white/[0.02] border-white/[0.05] text-white/55 hover:bg-white/[0.04] hover:text-white/80'
                            )}
                          >{ind}</button>
                        ))}
                      </div>
                      {errors.industry && <p className="text-destructive text-xs">{errors.industry}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/55 text-xs font-medium uppercase tracking-wider">Team size</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {TEAM_SIZES.map(t => (
                          <button
                            key={t.id} type="button"
                            onClick={() => { setForm({ ...form, teamSize: t.id }); setErrors(e => ({ ...e, teamSize: '' })); }}
                            className={cn(
                              'px-2 py-2.5 rounded-xl text-xs font-medium text-center transition-all border',
                              form.teamSize === t.id
                                ? 'bg-[#0A84FF]/10 border-[#0A84FF]/40 text-white'
                                : 'bg-white/[0.02] border-white/[0.05] text-white/55 hover:bg-white/[0.04]'
                            )}
                          >{t.label}</button>
                        ))}
                      </div>
                      {errors.teamSize && <p className="text-destructive text-xs">{errors.teamSize}</p>}
                    </div>
                  </div>
                )}

                {/* ─── STEP 3: Brand ─── */}
                {step === 3 && (
                  <div className="space-y-6">
                    <p className="text-white/40 text-sm leading-relaxed">
                      Pick brand colors so every video your workspace renders feels on-brand from the first generation. You can fine-tune this later in settings.
                    </p>

                    <div className="space-y-3">
                      <Label className="text-white/55 text-xs font-medium uppercase tracking-wider">Quick palettes</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {BRAND_PRESETS.map(p => {
                          const active = form.brandPrimary === p.primary && form.brandAccent === p.accent;
                          return (
                            <button
                              key={p.label} type="button"
                              onClick={() => setForm({ ...form, brandPrimary: p.primary, brandAccent: p.accent })}
                              className={cn(
                                'group rounded-xl p-3 border text-left transition-all',
                                active ? 'border-white/30 bg-white/[0.05]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                              )}
                            >
                              <div className="flex gap-1.5 mb-2">
                                <div className="w-6 h-6 rounded-md" style={{ background: p.primary }} />
                                <div className="w-6 h-6 rounded-md" style={{ background: p.accent }} />
                              </div>
                              <p className="text-[11px] font-medium text-white/60">{p.label}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <ColorField
                        label="Primary"
                        value={form.brandPrimary}
                        onChange={v => setForm({ ...form, brandPrimary: v })}
                      />
                      <ColorField
                        label="Accent"
                        value={form.brandAccent}
                        onChange={v => setForm({ ...form, brandAccent: v })}
                      />
                    </div>

                    {/* Live preview */}
                    <div className="rounded-2xl border border-white/[0.06] p-5 bg-white/[0.02]">
                      <p className="text-[11px] font-medium text-white/35 uppercase tracking-[0.18em] mb-3">Preview</p>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl shadow-lg shrink-0"
                          style={{ background: `linear-gradient(135deg, ${form.brandPrimary}, ${form.brandAccent})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold tracking-tight truncate">{form.workspaceName || 'Your Workspace'}</p>
                          <p className="text-xs text-white/45 truncate">Renders will use these colors as accents.</p>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white shrink-0"
                          style={{ background: form.brandPrimary }}
                        >
                          Render
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 4: Use case ─── */}
                {step === 4 && (
                  <div className="space-y-3">
                    <p className="text-white/40 text-sm">
                      We'll tune templates and starter prompts to match.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {USE_CASES.map(uc => {
                        const active = form.useCase === uc.id;
                        return (
                          <button
                            key={uc.id} type="button"
                            onClick={() => { setForm({ ...form, useCase: uc.id }); setErrors({}); }}
                            className={cn(
                              'flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all',
                              active
                                ? 'border-[#0A84FF]/40 bg-[#0A84FF]/[0.07]'
                                : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]'
                            )}
                          >
                            <div className={cn(
                              'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                              active ? 'bg-[#0A84FF]/20 text-[#0A84FF]' : 'bg-white/[0.04] text-white/40'
                            )}>
                              <uc.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm">{uc.label}</p>
                              <p className="text-[11px] text-white/35 leading-tight mt-0.5">{uc.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {errors.useCase && <p className="text-destructive text-xs">{errors.useCase}</p>}
                  </div>
                )}

                {/* ─── STEP 5: Invites ─── */}
                {step === 5 && (
                  <div className="space-y-5">
                    <p className="text-white/40 text-sm leading-relaxed">
                      Invite teammates to your <span className="text-white/70 font-medium">{form.workspaceName}</span> workspace. They'll get an email link to join. You can always do this later.
                    </p>

                    <div className="space-y-2.5">
                      {invites.map((inv, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                            <Input
                              type="email"
                              placeholder="teammate@company.com"
                              value={inv.email}
                              onChange={e => {
                                const next = [...invites];
                                next[idx] = { ...next[idx], email: e.target.value };
                                setInvites(next);
                              }}
                              className="h-11 pl-10 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/25 rounded-xl focus:border-[#0A84FF]/50 focus:ring-2 focus:ring-[#0A84FF]/15"
                              maxLength={255}
                            />
                          </div>
                          <select
                            value={inv.role}
                            onChange={e => {
                              const next = [...invites];
                              next[idx] = { ...next[idx], role: e.target.value as 'admin' | 'producer' | 'reviewer' };
                              setInvites(next);
                            }}
                            className="h-11 px-3 bg-white/[0.03] border border-white/[0.06] text-white text-sm rounded-xl focus:outline-none focus:border-[#0A84FF]/50 cursor-pointer"
                          >
                            <option value="admin">Admin</option>
                            <option value="producer">Producer</option>
                            <option value="reviewer">Reviewer</option>
                          </select>
                          {invites.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                              className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06]"
                              aria-label="Remove invite row"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setInvites([...invites, { email: '', role: 'producer' }])}
                        className="flex items-center gap-2 text-xs text-white/45 hover:text-white pt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-[11px] text-white/45 leading-relaxed">
                      <span className="text-white/70 font-medium">Roles:</span> Admins manage the workspace and brand. Producers generate and edit videos. Reviewers comment and approve.
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.04]">
              <div>
                {step > 1 && (
                  <Button onClick={handleBack} variant="ghost" size="sm"
                    className="gap-1.5 text-white/40 hover:text-white hover:bg-white/[0.04]">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                )}
              </div>

              {!isLast ? (
                <Button onClick={handleNext}
                  className="h-11 px-7 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm gap-2 transition-all">
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleComplete(true)} variant="ghost" size="sm"
                    disabled={loading}
                    className="text-white/45 hover:text-white hover:bg-white/[0.04]"
                  >
                    Skip invites
                  </Button>
                  <Button
                    onClick={() => handleComplete(false)} disabled={loading}
                    className="h-11 px-7 bg-[#0A84FF] text-white hover:bg-[#0A84FF]/90 rounded-xl font-semibold text-sm gap-2 transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Finish setup</>}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-white/15 mt-5">
            Press Enter to continue
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

interface FieldTextProps {
  id: string;
  label: string;
  icon: typeof User;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

function FieldText({ id, label, icon: Icon, value, onChange, placeholder, hint, error, optional, autoFocus, maxLength }: FieldTextProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white/55 text-xs font-medium uppercase tracking-wider">
        {label} {optional && <span className="text-white/20 normal-case">(optional)</span>}
      </Label>
      <div className="relative group">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-[#0A84FF] transition-colors" />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={cn(
            'h-12 pl-10 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/25',
            'focus:border-[#0A84FF]/50 focus:ring-2 focus:ring-[#0A84FF]/15 focus:bg-white/[0.05]',
            'rounded-xl transition-all duration-300 hover:border-white/[0.12]',
            error && 'border-destructive/60'
          )}
        />
      </div>
      {hint && !error && <p className="text-[11px] text-white/30">{hint}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-white/55 text-xs font-medium uppercase tracking-wider">{label}</Label>
      <div className="flex items-center gap-2 h-12 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="h-9 bg-transparent border-0 text-white text-sm font-mono px-2 focus:ring-0 focus:outline-none"
        />
      </div>
    </div>
  );
}
