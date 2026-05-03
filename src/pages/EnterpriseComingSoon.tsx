import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Sparkles, ArrowRight, Mail, Shield, Zap } from 'lucide-react';
import { CinemaBackdrop } from '@/components/ui/CinemaBackdrop';
import logoImage from '@/assets/apex-studio-logo.png';

/**
 * Enterprise tier — coming-soon gate.
 * Shown to any user with `account_type = 'enterprise'` who tries to access
 * the workspace shell while the tier is still being rolled out.
 * Premium presentation: cinematic backdrop, serif display, single blue accent.
 */
export default function EnterpriseComingSoon() {
  useEffect(() => { document.title = 'Apex-Studio · Enterprise (Coming Soon)'; }, []);

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

      <div className="relative z-10 w-full max-w-3xl">
        {/* Brand */}
        <Link to="/projects" className="group inline-flex items-center gap-2.5 mb-12">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.015] flex items-center justify-center overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4),inset_0_1px_0_hsla(0,0%,100%,0.06)]">
            <img src={logoImage} alt="" className="w-[24px] h-[24px] object-contain opacity-90" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-white/95 tracking-[-0.03em] leading-none font-display">
              Apex<span className="text-white/85 mx-[1px]">-</span>Studio
            </span>
            <span className="text-[9px] font-light uppercase tracking-[0.22em] text-white/30 mt-[4px]">
              Enterprise Suite
            </span>
          </div>
        </Link>

        {/* Status pill */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
          style={{
            borderColor: 'hsla(215,100%,60%,0.28)',
            background:
              'linear-gradient(135deg, hsla(215,100%,55%,0.12), hsla(215,100%,55%,0.04))',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)',
          }}
        >
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full animate-ping bg-[hsl(215,100%,60%)] opacity-70" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,68%)]" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[hsl(215,100%,82%)]">
            Enterprise · In Production
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display font-light text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.02em] text-white/95">
          Something <em className="not-italic text-[hsl(215,100%,72%)]" style={{ fontStyle: 'italic' }}>monumental</em>
          <br />is being assembled.
        </h1>

        <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.55] text-white/55 font-light max-w-2xl">
          Apex-Studio Enterprise will deliver dedicated rendering capacity, single sign-on,
          private model fine-tuning, and a white-glove production team for studios
          shipping at scale. We&rsquo;re finishing the final mile.
        </p>

        {/* Capability grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Shield,    label: 'SSO & Audit',     sub: 'SAML, SCIM, regional logs' },
            { icon: Zap,       label: 'Dedicated GPUs',  sub: 'Reserved render lanes' },
            { icon: Sparkles,  label: 'Private Models',  sub: 'Fine-tuned to your IP' },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="rounded-2xl p-4 border border-white/[0.06]"
              style={{
                background:
                  'linear-gradient(180deg, hsla(220,18%,7%,0.6), hsla(220,16%,4%,0.6))',
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

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <a
            href="mailto:enterprise@apex-studio.ai?subject=Enterprise%20Early%20Access"
            className="group relative inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 text-[13px] font-medium tracking-[-0.005em] overflow-hidden transition-all duration-500 hover:scale-[1.015] active:scale-[0.985]"
            style={{
              background:
                'linear-gradient(180deg, hsla(215,100%,60%,0.95), hsla(215,100%,48%,0.95))',
              color: 'white',
              boxShadow:
                '0 12px 36px -10px hsla(215,100%,55%,0.65), inset 0 1px 0 hsla(0,0%,100%,0.18)',
            }}
          >
            <Mail className="w-4 h-4" strokeWidth={1.75} />
            Request Early Access
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.75} />
          </a>

          <Link
            to="/projects"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 text-[13px] font-light text-white/70 hover:text-white border border-white/[0.08] hover:border-white/[0.16] transition-colors"
          >
            <Building2 className="w-4 h-4" strokeWidth={1.5} />
            Continue to Studio
          </Link>
        </div>

        <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.32em] text-white/25">
          Estimated launch · Q3 2026
        </div>
      </div>
    </div>
  );
}