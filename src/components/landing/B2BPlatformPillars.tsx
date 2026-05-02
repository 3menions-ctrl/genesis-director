import { memo } from 'react';
import { Layers, ShieldCheck, Workflow, Plug } from 'lucide-react';

const PILLARS = [
  {
    icon: Layers,
    title: 'Brand Kit Engine',
    desc: 'Lock fonts, colors, logos, voice and disclaimers across every render. No off-brand asset ever leaves the workspace.',
  },
  {
    icon: Workflow,
    title: 'Approval Workflows',
    desc: 'Producers draft, reviewers comment, brand managers approve. Every video has an audit trail before it ships.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    desc: 'SSO/SAML, role-based access, audit logs and SOC 2-ready controls. Your assets stay in your workspace.',
  },
  {
    icon: Plug,
    title: 'API & Integrations',
    desc: 'Generate videos from a Webhook, CSV or REST call. Connect HubSpot, Salesforce, Zapier and your CDP.',
  },
];

export const B2BPlatformPillars = memo(function B2BPlatformPillars() {
  return (
    <section className="relative z-10 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Platform
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
            Built for teams,<br className="md:hidden" /> not solo creators.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-7 md:p-8"
            >
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 flex items-center justify-center shrink-0">
                  <p.icon className="w-5 h-5 text-[#0A84FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white tracking-tight mb-2">
                    {p.title}
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed font-light">{p.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

B2BPlatformPillars.displayName = 'B2BPlatformPillars';