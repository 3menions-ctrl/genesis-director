import { memo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, KeyRound, Lock, FileCheck2, ServerCog, Globe2 } from 'lucide-react';

const BADGES = [
  { icon: ShieldCheck, label: 'SOC 2 Type II' },
  { icon: KeyRound,    label: 'SSO / SAML' },
  { icon: Lock,        label: 'SCIM provisioning' },
  { icon: FileCheck2,  label: 'Audit logs' },
  { icon: ServerCog,   label: 'Region pinning' },
  { icon: Globe2,      label: 'GDPR · CCPA' },
];

export const B2BSecurityBar = memo(function B2BSecurityBar() {
  return (
    <section className="relative z-10 py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden p-8 md:p-10"
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 14%, 6%, 0.65), hsla(220, 14%, 3%, 0.9))',
            border: '1px solid hsla(0,0%,100%,0.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 1px 0 hsla(0,0%,100%,0.05) inset, 0 30px 80px -30px rgba(0,0,0,0.6)',
          }}
        >
          <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
            <div>
              <p className="text-[11px] font-medium text-primary tracking-[0.22em] uppercase mb-3">
                Enterprise-ready
              </p>
              <h3 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight leading-[1.1]">
                Built for the security review.
              </h3>
              <p className="mt-3 text-sm text-white/50 font-light leading-relaxed">
                Your creative, your customer data, your control plane — all
                governed by enterprise-grade controls.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BADGES.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-glass"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <b.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-white/75 tracking-tight">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

B2BSecurityBar.displayName = 'B2BSecurityBar';
