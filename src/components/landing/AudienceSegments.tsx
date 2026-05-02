import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Building2, ShieldCheck, Check, ArrowRight } from 'lucide-react';
import { ContactSalesDialog } from '@/components/sales/ContactSalesDialog';

export interface AudienceSegmentsProps {
  onStart: () => void;
}

const SEGMENTS = [
  {
    id: 'personal' as const,
    icon: User,
    eyebrow: 'For creators',
    title: 'Personal',
    pitch: 'Bring an idea to a finished cinematic clip in minutes. Pay only for what you generate.',
    points: [
      'Pay-as-you-go credits — $0.10 each, never expire',
      'Full access to the creative toolkit',
      '60 free credits to start',
    ],
    cta: { label: 'Start free', kind: 'primary' as const },
  },
  {
    id: 'business' as const,
    icon: Building2,
    eyebrow: 'For brands & agencies',
    title: 'Business',
    pitch: 'Ship paid-social, launches and lifecycle creative on a single workspace your whole team can use.',
    points: [
      'Team workspaces with roles and review',
      'Brand kit: locked colors, fonts, logos',
      'Volume credit packs and shared library',
    ],
    cta: { label: 'Talk to sales', kind: 'sales' as const, tier: 'business' as const },
    featured: true,
  },
  {
    id: 'enterprise' as const,
    icon: ShieldCheck,
    eyebrow: 'For organizations',
    title: 'Enterprise',
    pitch: 'A secured deployment of Apex-Studio for global teams — with SSO, residency controls and a dedicated partner.',
    points: [
      'SAML SSO + admin audit trail',
      'Custom data residency & retention',
      'Priority support and onboarding partner',
    ],
    cta: { label: 'Contact us', kind: 'sales' as const, tier: 'enterprise' as const },
  },
];

export function AudienceSegments({ onStart }: AudienceSegmentsProps) {
  const [salesOpen, setSalesOpen] = useState(false);
  const [salesTier, setSalesTier] = useState<'business' | 'enterprise'>('enterprise');

  const openSales = (tier: 'business' | 'enterprise') => {
    setSalesTier(tier);
    setSalesOpen(true);
  };

  return (
    <section id="audiences" className="relative py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16 md:mb-20"
        >
          <p className="text-[11px] font-medium tracking-[0.28em] uppercase text-[#0A84FF] mb-4">
            Built for every stage
          </p>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-[-0.02em] text-white leading-[1.05]">
            One studio.<br className="md:hidden" /> Three audiences.
          </h2>
          <p className="mt-5 text-white/55 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Whether you're a single creator, a marketing team, or a global organization —
            Apex-Studio scales with you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {SEGMENTS.map((s, idx) => {
            const Icon = s.icon;
            const featured = (s as any).featured;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.6, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={`relative rounded-3xl p-7 md:p-8 flex flex-col ${
                  featured
                    ? 'border-[#0A84FF]/40 bg-gradient-to-b from-[#0A84FF]/[0.08] to-white/[0.02]'
                    : 'border-white/[0.06] bg-white/[0.015]'
                } border`}
                style={featured ? {
                  boxShadow: '0 30px 80px -30px rgba(10,132,255,0.35), 0 0 0 1px hsla(212,100%,60%,0.18) inset',
                } : undefined}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#0A84FF] text-white text-[10px] font-semibold tracking-[0.18em] uppercase">
                    Most popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    featured ? 'bg-[#0A84FF]/15 text-[#0A84FF]' : 'bg-white/[0.04] text-white/70'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.22em] uppercase text-white/40">{s.eyebrow}</p>
                    <h3 className="text-2xl font-display font-semibold text-white tracking-tight">{s.title}</h3>
                  </div>
                </div>

                <p className="text-white/65 text-sm leading-relaxed mb-6">{s.pitch}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {s.points.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-white/75">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? 'text-[#0A84FF]' : 'text-white/40'}`} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    if (s.cta.kind === 'primary') onStart();
                    else openSales(s.cta.tier);
                  }}
                  className={`group/cta inline-flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    featured
                      ? 'bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white shadow-[0_10px_40px_-10px_rgba(10,132,255,0.5)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.07]'
                  }`}
                >
                  {s.cta.label}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-0.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <ContactSalesDialog
        open={salesOpen}
        onOpenChange={setSalesOpen}
        tier={salesTier}
        source="landing_audiences"
      />
    </section>
  );
}

export default AudienceSegments;