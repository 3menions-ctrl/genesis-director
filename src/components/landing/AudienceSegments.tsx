import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Building2,
  ShieldCheck,
  ArrowRight,
  Type,
  ImageIcon,
  Film,
  Layers,
  Mic2,
  Music2,
  ScanFace,
  Wand2,
  Activity,
} from 'lucide-react';
import { ContactSalesDialog } from '@/components/sales/ContactSalesDialog';

export interface AudienceSegmentsProps {
  onStart: () => void;
}

type FeatureKey =
  | 't2v'
  | 'i2v'
  | 'script'
  | 'continuity'
  | 'stitch'
  | 'dialogue'
  | 'score'
  | 'facelock'
  | 'sceneDna'
  | 'pipeline';

const SEGMENTS = [
  {
    id: 'personal' as const,
    icon: User,
    eyebrow: 'For creators',
    title: 'Personal',
    pitch: 'Type a script or drop a photo and direct full cinematic scenes — no shoot, no crew, no timeline wrestling.',
    features: [
      { key: 't2v' as FeatureKey,        icon: Type,      label: 'Text-to-Video',          detail: 'Type the scene. Get the shot.' },
      { key: 'i2v' as FeatureKey,        icon: ImageIcon, label: 'Image-to-Video',         detail: 'Any still becomes a directed clip.' },
      { key: 'script' as FeatureKey,     icon: Wand2,     label: 'AI Screenwriter',        detail: 'Idea → shot-ready screenplay.' },
      { key: 'continuity' as FeatureKey, icon: Layers,    label: 'Frame-Chained Continuity', detail: 'Characters stay on-model, shot to shot.' },
    ],
    cta: { label: 'Start free', kind: 'primary' as const },
  },
  {
    id: 'business' as const,
    icon: Building2,
    eyebrow: 'For brands & agencies',
    title: 'Business',
    pitch: 'Stitch multi-shot ads, launches and lifecycle creative end-to-end — from script to a finished long-form cut.',
    features: [
      { key: 'stitch' as FeatureKey,   icon: Film,    label: 'Long-Form Stitching',  detail: 'Chain clips into 30s · 60s · multi-minute cuts.' },
      { key: 'dialogue' as FeatureKey, icon: Mic2,    label: 'Multi-Character Dialogue', detail: 'Synced lip-sync + cinematic camera switches.' },
      { key: 'score' as FeatureKey,    icon: Music2,  label: 'Native Score & Mix',  detail: 'Music + auto dialogue-ducking on export.' },
      { key: 'continuity' as FeatureKey, icon: Layers, label: 'Brand-Locked Continuity', detail: 'Same look. Same cast. Every render.' },
    ],
    cta: { label: 'Talk to sales', kind: 'sales' as const, tier: 'business' as const },
    featured: true,
  },
  {
    id: 'enterprise' as const,
    icon: ShieldCheck,
    eyebrow: 'For organizations',
    title: 'Enterprise',
    pitch: 'Industrial-grade generation pipeline — character lock, scene continuity and stitched long-form output at scale.',
    features: [
      { key: 'facelock' as FeatureKey,  icon: ScanFace, label: 'Face-Lock Identity',     detail: 'Zero drift across every shot.' },
      { key: 'sceneDna' as FeatureKey,  icon: ImageIcon,label: 'Scene-DNA I2V',          detail: 'Extend any still into a directed sequence.' },
      { key: 'pipeline' as FeatureKey,  icon: Activity, label: 'Resilient Pipeline',     detail: 'Watchdog recovery for unattended bulk renders.' },
      { key: 'stitch' as FeatureKey,    icon: Film,     label: 'Stitched Long-Form',     detail: 'Industrial output, frame-perfect joins.' },
    ],
    cta: { label: 'Contact us', kind: 'sales' as const, tier: 'enterprise' as const },
  },
];

/* ── Animated visual that previews each card's hero feature ─────────── */
function FeatureCanvas({ id, featured }: { id: 'personal' | 'business' | 'enterprise'; featured?: boolean }) {
  const accent = '#0A84FF';

  if (id === 'personal') {
    // Text prompt → frame chain morph
    return (
      <div className="relative h-32 rounded-2xl overflow-hidden bg-black/40 border border-white/[0.06] mb-6">
        <div className="absolute inset-0 opacity-40"
          style={{ background: `radial-gradient(120% 80% at 0% 50%, ${accent}33, transparent 60%)` }} />
        {/* typing prompt */}
        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
          <Type className="w-3 h-3 text-white/40" />
          <motion.span
            className="text-[11px] text-white/80 font-mono tracking-tight overflow-hidden whitespace-nowrap"
            initial={{ width: 0 }}
            whileInView={{ width: 'auto' }}
            viewport={{ once: true }}
            transition={{ duration: 2.2, ease: 'easeOut' }}
          >
            astronaut walks toward sunrise…
          </motion.span>
          <motion.span
            className="w-1 h-3 bg-white/70"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        </div>
        {/* frame chain */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="flex-1 h-10 rounded-md border border-white/[0.08] overflow-hidden relative"
              style={{
                background: `linear-gradient(135deg, hsl(${210 + i * 8}, 80%, ${20 + i * 4}%), hsl(${200 + i * 6}, 70%, ${10 + i * 3}%))`,
              }}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 1.6 + i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="absolute inset-0"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.18, ease: 'linear' }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (id === 'business') {
    // Long-form stitching ribbon + waveform
    return (
      <div className="relative h-32 rounded-2xl overflow-hidden bg-black/40 border border-[#0A84FF]/25 mb-6">
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(100% 80% at 50% 0%, ${accent}26, transparent 60%)` }} />
        {/* timeline ribbon */}
        <div className="absolute top-4 left-3 right-3 flex items-center gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-6 rounded-sm"
              style={{
                flex: i % 4 === 0 ? 2.5 : 1,
                background: i % 4 === 0
                  ? `linear-gradient(180deg, ${accent}, ${accent}88)`
                  : 'rgba(255,255,255,0.08)',
                boxShadow: i % 4 === 0 ? `0 0 18px ${accent}66` : undefined,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>
        {/* playhead */}
        <motion.div
          className="absolute top-2 bottom-12 w-px bg-white"
          style={{ boxShadow: `0 0 12px #fff, 0 0 24px ${accent}` }}
          initial={{ left: '4%' }}
          animate={{ left: ['4%', '96%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
        {/* waveform */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end gap-[2px] h-8">
          {Array.from({ length: 56 }).map((_, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-full"
              style={{ background: i % 7 === 0 ? accent : 'rgba(255,255,255,0.5)' }}
              animate={{
                height: [
                  `${20 + Math.sin(i) * 18 + 14}%`,
                  `${50 + Math.cos(i * 1.7) * 30}%`,
                  `${20 + Math.sin(i) * 18 + 14}%`,
                ],
              }}
              transition={{
                duration: 1.4 + (i % 5) * 0.15,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.02,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // enterprise: face-lock + scene continuity grid
  return (
    <div className="relative h-32 rounded-2xl overflow-hidden bg-black/40 border border-white/[0.06] mb-6">
      <div className="absolute inset-0"
        style={{ background: `radial-gradient(120% 80% at 100% 50%, ${accent}26, transparent 60%)` }} />
      {/* identity scan */}
      <div className="absolute inset-3 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="relative rounded-lg border border-white/[0.08] overflow-hidden"
            style={{ background: `linear-gradient(135deg, hsl(220, 30%, ${14 + i * 3}%), hsl(220, 20%, ${8 + i * 2}%))` }}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* face silhouette */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-7 h-7 rounded-full"
                style={{ background: `radial-gradient(circle at 50% 40%, rgba(255,255,255,0.18), transparent 70%)` }}
              />
            </div>
            {/* lock corners */}
            {[
              'top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1',
            ].map((pos, k) => (
              <span
                key={k}
                className={`absolute ${pos} w-1.5 h-1.5 border-[#0A84FF]`}
                style={{
                  borderTopWidth: pos.includes('top') ? 1 : 0,
                  borderBottomWidth: pos.includes('bottom') ? 1 : 0,
                  borderLeftWidth: pos.includes('left') ? 1 : 0,
                  borderRightWidth: pos.includes('right') ? 1 : 0,
                }}
              />
            ))}
            {/* scan line */}
            <motion.div
              className="absolute left-0 right-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 8px ${accent}` }}
              animate={{ top: ['10%', '90%', '10%'] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
            />
          </motion.div>
        ))}
      </div>
      {/* status bar */}
      <div className="absolute bottom-1.5 left-3 right-3 flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#0A84FF] animate-pulse" />
          Identity Locked
        </span>
        <span>4/4 Shots · Drift 0.00</span>
      </div>
    </div>
  );
}

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

                <p className="text-white/65 text-sm leading-relaxed mb-5">{s.pitch}</p>

                {/* Animated feature canvas — sells the unique tech */}
                <FeatureCanvas id={s.id} featured={featured} />

                <ul className="space-y-3 mb-8 flex-1">
                  {s.features.map((f, i) => {
                    const FIcon = f.icon;
                    return (
                      <motion.li
                        key={f.key + i}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-10%' }}
                        transition={{ delay: 0.1 + i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="group/feat flex items-start gap-3 text-sm"
                      >
                        <div
                          className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                            featured
                              ? 'bg-[#0A84FF]/15 text-[#0A84FF] group-hover/feat:bg-[#0A84FF]/25'
                              : 'bg-white/[0.04] text-white/70 group-hover/feat:bg-white/[0.08] group-hover/feat:text-white'
                          }`}
                        >
                          <FIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/90 font-medium leading-tight">{f.label}</p>
                          <p className="text-[12px] text-white/45 mt-0.5 leading-snug">{f.detail}</p>
                        </div>
                      </motion.li>
                    );
                  })}
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