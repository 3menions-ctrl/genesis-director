import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Sparkles, ArrowRight, Mail, Shield, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { CinemaBackdrop } from '@/components/ui/CinemaBackdrop';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoImage from '@/assets/small-bridges-logo.webp';

import { usePageMeta } from '@/hooks/usePageMeta';
/**
 * Enterprise tier — coming-soon gate + lead-capture form.
 * Single entry point for any user landing on enterprise. No signup;
 * we collect contact details and notify the team.
 */
const leadSchema = z.object({
  contact_name: z.string().trim().min(2, 'Name required').max(120),
  email: z.string().trim().toLowerCase().email('Valid work email required').max(255),
  company_name: z.string().trim().min(2, 'Company required').max(160),
  company_size: z.string().min(1, 'Pick a size'),
  primary_use_case: z.string().trim().max(500).optional().or(z.literal('')),
});

const COMPANY_SIZES = [
  { id: '1-10',     label: '1–10' },
  { id: '11-50',    label: '11–50' },
  { id: '51-200',   label: '51–200' },
  { id: '201-1000', label: '201–1,000' },
  { id: '1000+',    label: '1,000+' },
];

export default function EnterpriseComingSoon() {
  usePageMeta({ title: "Enterprise — Small Bridges", description: "Enterprise-grade cinematic AI for production studios. Coming soon." });

  useEffect(() => { document.title = 'Small Bridges · Enterprise (Coming Soon)'; }, []);

  const [form, setForm] = useState({
    contact_name: '',
    email: '',
    company_name: '',
    company_size: '',
    primary_use_case: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = leadSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(e => { if (e.path[0]) errs[e.path[0] as string] = e.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { error } = await supabase.from('enterprise_leads').insert({
        user_id: null,
        email: form.email.trim().toLowerCase(),
        company_name: form.company_name.trim(),
        company_size: form.company_size,
        primary_use_case: form.primary_use_case?.trim() || null,
        role: form.contact_name.trim(), // store contact name in role field
        status: 'new',
      });
      if (error) {
        console.warn('[enterprise-lead]', error);
        toast.error('Could not submit. Please email smallbridges.co@smallbridges.co directly.');
        return;
      }
      setSubmitted(true);
      toast.success('Request received — we will reach out within one business day.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-16 text-foreground">
      <CinemaBackdrop />

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(800px 500px at 50% 20%, hsla(215,100%,55%,0.18), transparent 70%), radial-gradient(600px 400px at 80% 90%, hsla(212,100%,50%,0.10), transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-[1.1fr_1fr] gap-12 items-start">
        {/* ───────── Left: brand + headline + capabilities ───────── */}
        <div>
          <Link to="/" className="group inline-flex items-center gap-2.5 mb-12">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.015] flex items-center justify-center overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4),inset_0_1px_0_hsla(0,0%,100%,0.06)]">
              <img src={logoImage} alt="" className="w-[24px] h-[24px] object-contain opacity-90" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-white/95 tracking-[-0.03em] leading-none font-display">
                Small Bridges<span className="text-white/85 mx-[1px]">-</span>Studio
              </span>
              <span className="text-[9px] font-light uppercase tracking-[0.22em] text-white/65 mt-[4px]">
                Enterprise Suite
              </span>
            </div>
          </Link>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
            style={{
              borderColor: 'hsla(215,100%,60%,0.28)',
              background: 'linear-gradient(135deg, hsla(215,100%,55%,0.12), hsla(215,100%,55%,0.04))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)',
            }}
          >
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full animate-ping bg-[hsl(215,100%,60%)] opacity-70" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,68%)]" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[hsl(215,100%,82%)]">
              Enterprise · Coming Soon
            </span>
          </div>

          <h1 className="font-display font-light text-[42px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] text-white/95">
            Built for studios shipping at <em className="not-italic text-[hsl(215,100%,72%)]" style={{ fontStyle: 'italic' }}>scale</em>.
          </h1>

          <p className="mt-6 text-[15px] sm:text-[16px] leading-[1.6] text-white/55 font-light max-w-xl">
            Dedicated rendering capacity, single sign-on, private model fine-tuning,
            and a white-glove production team. Tell us about your studio and we&rsquo;ll be in touch.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
            {[
              { icon: Shield,   label: 'SSO & Audit',    sub: 'SAML, SCIM, regional logs' },
              { icon: Zap,      label: 'Dedicated GPUs', sub: 'Reserved render lanes' },
              { icon: Sparkles, label: 'Private Models', sub: 'Fine-tuned to your IP' },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="rounded-2xl p-4 border border-white/[0.06]"
                style={{
                  background: 'linear-gradient(180deg, hsla(220,18%,7%,0.6), hsla(220,16%,4%,0.6))',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)',
                }}
              >
                <Icon className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
                <div className="mt-3 text-[13px] font-display text-white/90">{label}</div>
                <div className="mt-0.5 text-[11px] text-white/45 font-light">{sub}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.28em] text-white/35">
            <span>Estimated launch · Q3 2026</span>
            <span aria-hidden>·</span>
            <a href="mailto:smallbridges.co@smallbridges.co" className="hover:text-white/70 transition-colors">
              smallbridges.co@smallbridges.co
            </a>
          </div>
        </div>

        {/* ───────── Right: contact form ───────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-8 border border-white/[0.07] relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsla(220,18%,7%,0.85), hsla(220,16%,3%,0.85))',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.85), inset 0 1px 0 hsla(0,0%,100%,0.06)',
          }}
        >
          {submitted ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                style={{ background: 'radial-gradient(circle at center, hsla(215,100%,60%,0.4) 0%, transparent 70%)' }}>
                <CheckCircle2 className="w-7 h-7 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
              </div>
              <h2 className="font-display text-[22px] tracking-[-0.01em] text-white/95">
                Request received
              </h2>
              <p className="mt-3 text-[14px] text-white/55 font-light max-w-sm leading-relaxed">
                Our enterprise team will reach out within one business day.
                In the meantime, feel free to explore the consumer studio.
              </p>
              <Link
                to="/"
                className="mt-8 inline-flex items-center gap-2 rounded-full px-5 h-11 text-[13px] font-light text-white/70 hover:text-white border border-white/[0.08] hover:border-white/[0.16] transition-colors"
              >
                <Building2 className="w-4 h-4" strokeWidth={1.5} />
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Mail className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.75} />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
                  Request Early Access
                </span>
              </div>

              <h2 className="font-display text-[24px] tracking-[-0.01em] text-white/95 leading-tight">
                Tell us about your studio.
              </h2>
              <p className="mt-2 text-[13px] text-white/45 font-light">
                We&rsquo;ll reach out within one business day.
              </p>

              <div className="mt-7 space-y-4">
                <Field
                  label="Your name"
                  value={form.contact_name}
                  onChange={v => setForm(f => ({ ...f, contact_name: v }))}
                  error={errors.contact_name}
                  placeholder="Jane Director"
                  autoComplete="name"
                />
                <Field
                  label="Work email"
                  value={form.email}
                  onChange={v => setForm(f => ({ ...f, email: v }))}
                  error={errors.email}
                  placeholder="jane@studio.com"
                  type="email"
                  autoComplete="email"
                />
                <Field
                  label="Company"
                  value={form.company_name}
                  onChange={v => setForm(f => ({ ...f, company_name: v }))}
                  error={errors.company_name}
                  placeholder="Studio Inc."
                  autoComplete="organization"
                />

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.22em] text-white/75 mb-2">
                    Team size
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COMPANY_SIZES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, company_size: s.id }))}
                        className={`h-10 rounded-lg text-[11px] font-medium transition-all border ${
                          form.company_size === s.id
                            ? 'border-[hsl(215,100%,60%)]/50 bg-[hsl(215,100%,55%)]/[0.12] text-white shadow-[0_0_20px_hsla(215,100%,55%,0.2)]'
                            : 'border-white/[0.06] bg-glass text-white/55 hover:border-white/[0.12] hover:text-white/80'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {errors.company_size && (
                    <p className="mt-1.5 text-[11px] text-rose-400/90 font-light">{errors.company_size}</p>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-[0.22em] text-white/75 mb-2">
                    What will you build? <span className="text-white/25 normal-case tracking-normal">(optional)</span>
                  </label>
                  <textarea
                    value={form.primary_use_case}
                    onChange={e => setForm(f => ({ ...f, primary_use_case: e.target.value }))}
                    rows={3}
                    maxLength={500}
                    placeholder="Brand films, performance ads, sales videos at scale…"
                    className="w-full rounded-xl bg-glass border border-white/[0.06] px-4 py-3 text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-[hsl(215,100%,60%)]/40 focus:bg-glass-hover transition-all resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="group mt-7 w-full inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 text-[13px] font-medium tracking-[-0.005em] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(180deg, hsla(215,100%,60%,0.95), hsla(215,100%,48%,0.95))',
                  color: 'white',
                  boxShadow: '0 12px 36px -10px hsla(215,100%,55%,0.65), inset 0 1px 0 hsla(0,0%,100%,0.18)',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                    Sending…
                  </>
                ) : (
                  <>
                    Request access
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.75} />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-[11px] text-white/65 font-light">
                By submitting you agree to be contacted by our enterprise team.
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, error, placeholder, type = 'text', autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.22em] text-white/75 mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={255}
        className={`w-full h-12 rounded-xl bg-glass border px-4 text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none focus:bg-glass-hover transition-all ${
          error
            ? 'border-rose-400/40 focus:border-rose-400/60'
            : 'border-white/[0.06] focus:border-[hsl(215,100%,60%)]/40'
        }`}
      />
      {error && <p className="mt-1.5 text-[11px] text-rose-400/90 font-light">{error}</p>}
    </div>
  );
}
