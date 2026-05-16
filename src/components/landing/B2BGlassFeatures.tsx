import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Layers, ShieldCheck, Workflow, Palette, Globe2, Rocket,
  Wand2, GitBranch, BarChart3,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Wand2,
    title: 'Brief to first cut in minutes',
    desc: 'Paste a creative brief or product URL. The director model writes the script, picks shots and renders a first cut you can actually review.',
    accent: '#0A84FF',
  },
  {
    icon: Palette,
    title: 'Brand kits at the workspace level',
    desc: 'Pin colors, fonts, logos and tone-of-voice once. Every render in the workspace inherits them — no per-asset policing.',
    accent: '#7DD3FC',
  },
  {
    icon: Workflow,
    title: 'Review on the timeline',
    desc: 'Reviewers leave timestamped comments. Approvals are role-gated and versioned, so you always know which cut shipped.',
    accent: '#22D3EE',
  },
  {
    icon: Globe2,
    title: 'Localize from one master',
    desc: 'Translate dialogue, swap on-screen text and re-voice avatars in 30+ languages without re-shooting the source cut.',
    accent: '#0A84FF',
  },
  {
    icon: GitBranch,
    title: 'Variants for every placement',
    desc: 'Resize one hero into 9:16, 1:1 and 16:9 cuts with hooks, captions and CTAs adjusted per surface.',
    accent: '#60A5FA',
  },
  {
    icon: ShieldCheck,
    title: 'Built for security reviews',
    desc: 'SSO, SCIM, audit logs and row-level isolation per workspace. Private projects stay inside your tenant.',
    accent: '#34D399',
  },
];

function GlassCard({ icon: Icon, title, desc, accent, index }: typeof FEATURES[number] & { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-3xl overflow-hidden"
    >
      {/* Glass base */}
      <div
        className="absolute inset-0 backdrop-blur-2xl"
        style={{
          background:
            'linear-gradient(180deg, hsla(220, 14%, 8%, 0.55) 0%, hsla(220, 14%, 4%, 0.85) 100%)',
          border: '1px solid hsla(0,0%,100%,0.06)',
          borderRadius: 24,
          boxShadow:
            '0 1px 0 hsla(0,0%,100%,0.05) inset, 0 30px 80px -30px rgba(0,0,0,0.6)',
        }}
      />
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full blur-[80px] opacity-0 group-hover:opacity-60 transition-opacity duration-700"
        style={{ background: `radial-gradient(circle, ${accent}66, transparent 70%)` }}
      />
      {/* Top hairline */}
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative p-7 lg:p-8">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5 border"
          style={{
            background: `linear-gradient(135deg, ${accent}25, ${accent}05)`,
            borderColor: `${accent}40`,
            boxShadow: `0 0 30px -8px ${accent}55`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <h3 className="font-display text-xl font-semibold text-white tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-[13.5px] text-white/55 leading-relaxed font-light">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

export const B2BGlassFeatures = memo(function B2BGlassFeatures() {
  return (
    <section id="features" className="relative z-10 py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Platform
          </p>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.05] max-w-3xl mx-auto">
            One workspace.{' '}
            <span className="text-white/75">A complete</span>{' '}
            video production studio.
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-white/55 text-lg font-light leading-relaxed">
            Everything your marketing org needs to brief, generate, review and
            ship video at the cadence of paid media.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <GlassCard key={f.title} {...f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
});

B2BGlassFeatures.displayName = 'B2BGlassFeatures';

// ─── Secondary: workflow timeline ───────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Brief',
    desc: 'Paste a creative brief, product URL or campaign ticket. The director model extracts goals, audience, tone and CTAs.',
    icon: Layers,
  },
  {
    n: '02',
    title: 'Generate',
    desc: 'Cinema-grade scenes are composed shot-by-shot with your locked brand kit, talent and voice.',
    icon: Rocket,
  },
  {
    n: '03',
    title: 'Review',
    desc: 'Reviewers leave timestamped comments. Producers iterate in the editor with one-click re-renders.',
    icon: Workflow,
  },
  {
    n: '04',
    title: 'Ship',
    desc: 'Export to every platform aspect ratio, push to ad accounts, or hand off to your DAM.',
    icon: BarChart3,
  },
];

export const B2BWorkflow = memo(function B2BWorkflow() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            Workflow
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
            From brief to broadcast in four steps.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className="relative rounded-2xl p-6 backdrop-blur-2xl border border-white/[0.06]"
              style={{
                background:
                  'linear-gradient(180deg, hsla(220, 14%, 8%, 0.5), hsla(220, 14%, 4%, 0.8))',
                boxShadow: '0 1px 0 hsla(0,0%,100%,0.04) inset',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-[10px] font-mono text-white/65 tracking-[0.2em]">{s.n}</span>
                <s.icon className="w-4 h-4 text-[#0A84FF]" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white tracking-tight mb-2">
                {s.title}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed font-light">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

B2BWorkflow.displayName = 'B2BWorkflow';
