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
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0a] text-white">
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{
          paddingTop: 'calc(var(--safe-top, 0px) + 26px)',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 96px)',
        }}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#7aa2ff]">Create</div>
        <h1 className="mt-2 font-display text-[34px] font-light leading-[1.05] tracking-tight">
          What do you want to <span className="italic" style={{ fontFamily: 'Fraunces, serif', fontWeight: 500 }}>see?</span>
        </h1>

        {/* Prompt */}
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.05] p-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            autoFocus
            placeholder="A neon-soaked Tokyo alley in the rain, a lone figure with a glowing umbrella…"
            className="w-full resize-none bg-transparent text-[18px] leading-relaxed text-white outline-none placeholder:text-white/35"
          />
        </div>

        {/* Style */}
        <div className="mt-6 mb-3 text-[12px] font-semibold uppercase tracking-wide text-white/55">Style</div>
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
                  'flex items-center gap-2 rounded-2xl border px-4 py-2.5 font-display text-[13px] font-semibold transition-colors',
                  on
                    ? 'border-[#7a8cff]/60 bg-gradient-to-br from-[#2f6bff]/25 to-[#7a3bff]/20 text-white'
                    : 'border-white/10 bg-white/[0.05] text-white/80',
                )}
              >
                <span className="text-[15px]">{s.emoji}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        <p className="mt-7 text-[13px] leading-relaxed text-white/45">
          Your clip generates in the studio, then lands in your feed where anyone can remix it.
        </p>
      </div>

      {/* Generate bar */}
      <button
        onClick={generate}
        disabled={!canGenerate}
        className={cn(
          'absolute left-5 right-5 flex h-[58px] items-center justify-between rounded-[18px] pl-6 pr-2.5 shadow-[0_18px_36px_-10px_rgba(80,80,255,.6)] transition-opacity',
          canGenerate
            ? 'bg-gradient-to-r from-[#2f6bff] to-[#7a3bff]'
            : 'bg-white/10 opacity-60',
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
