/**
 * Create — the mobile-first "one prompt" creation screen.
 *
 * Deliberately minimal vs. the desktop Studio: describe the scene, tap a style,
 * Generate. It does NOT run generation itself (that would duplicate the engine
 * and spend credits) — it hands the assembled prompt to the existing Studio
 * pipeline via `/studio?prompt=…`, which prefills and runs the real flow (and
 * gates auth). Style choice is folded into the prompt so it actually affects
 * the result.
 *
 * Spend-only safe: this screen never shows pricing/checkout. Credit cost is a
 * read-only hint.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface StyleOption {
  id: string;
  label: string;
  emoji: string;
  /** Appended to the prompt so the style genuinely shapes the output. */
  suffix: string;
}

const STYLES: StyleOption[] = [
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', suffix: 'cinematic film still, shallow depth of field, dramatic lighting' },
  { id: 'anime', label: 'Anime', emoji: '🌸', suffix: 'anime style, vibrant cel shading' },
  { id: 'vhs', label: 'VHS', emoji: '📼', suffix: 'retro VHS camcorder look, grain and scanlines' },
  { id: 'noir', label: 'Noir', emoji: '🖤', suffix: 'high-contrast black and white film noir' },
  { id: 'vapor', label: 'Vapor', emoji: '🌈', suffix: 'vaporwave, neon magenta and cyan, dreamy haze' },
];

export default function Create() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [styleId, setStyleId] = useState<string | null>('cinematic');

  const canGenerate = prompt.trim().length > 0;

  const generate = () => {
    if (!canGenerate) return;
    void hapticTap();
    const style = STYLES.find((s) => s.id === styleId);
    const full = style ? `${prompt.trim()}, ${style.suffix}` : prompt.trim();
    navigate(`/studio?prompt=${encodeURIComponent(full)}`);
  };

  return (
    <div className="fixed inset-0 flex flex-col text-white">
      <AuroraBackdrop />
      <div
        className="relative z-10 flex-1 overflow-y-auto px-5"
        style={{
          paddingTop: 'calc(var(--safe-top, 0px) + 30px)',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 96px)',
        }}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-[#7aa2ff]/90">Create</div>
        <h1 className="mt-3 text-[37px] font-light leading-[1.03] tracking-[-0.01em]" style={{ fontFamily: 'Fraunces, serif' }}>
          What do you want to{' '}
          <span
            className="bg-gradient-to-r from-[#8fb4ff] via-[#b79bff] to-[#7adfff] bg-clip-text italic text-transparent"
            style={{ fontWeight: 500 }}
          >
            see?
          </span>
        </h1>

        {/* Prompt — borderless lit-glass surface; focus lifts it with a soft
            blue bloom rather than a hard ring. */}
        <div className="mt-6 rounded-[28px] surface-2 p-5 transition-shadow duration-300 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_28px_84px_-30px_rgba(60,90,255,.6)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            autoFocus
            placeholder="A neon-soaked Tokyo alley in the rain, a lone figure with a glowing umbrella…"
            className="w-full resize-none bg-transparent text-[18px] leading-relaxed text-white outline-none focus:outline-none focus-visible:outline-none placeholder:text-white/30"
            style={{ outline: 'none', boxShadow: 'none' }}
          />
        </div>

        {/* Style */}
        <div className="mb-3.5 mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Style</div>
        <div className="flex flex-wrap gap-2.5">
          {STYLES.map((s) => {
            const on = s.id === styleId;
            return (
              <button
                key={s.id}
                onClick={() => {
                  void hapticTap();
                  setStyleId(on ? null : s.id);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-all duration-200',
                  on
                    ? 'bg-gradient-to-br from-[#3f78ff] to-[#7a3bff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_12px_30px_-8px_rgba(80,90,255,.75)]'
                    : 'surface-1 text-white/75',
                )}
              >
                <span className="text-[15px]">{s.emoji}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-[14px] italic leading-relaxed text-white/40" style={{ fontFamily: 'Fraunces, serif' }}>
          Your clip generates in the studio, then lands in your feed — where anyone can remix it.
        </p>
      </div>

      {/* Generate bar */}
      <button
        onClick={generate}
        disabled={!canGenerate}
        className={cn(
          'absolute left-5 right-5 z-10 flex h-[62px] items-center justify-between rounded-[22px] pl-6 pr-2.5 transition-all duration-300',
          canGenerate
            ? 'bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_24px_48px_-12px_rgba(80,80,255,.7)]'
            : 'surface-1 opacity-60',
        )}
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 16px)' }}
      >
        <span className="flex items-center gap-2.5 font-display text-[16px] font-bold">
          <Sparkles className="h-5 w-5" /> Generate
        </span>
        <span className="flex items-center gap-2 rounded-[13px] bg-black/25 px-3.5 py-2.5 font-mono text-[13px] font-semibold">
          from 2 ◇ <ArrowRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
