/**
 * Create — the comprehensive creation hub.
 *
 * NOT just text→video. A config-driven set of creation MODES (video, image,
 * animate, avatar, music, scenes…) each declares its own inputs, CTA and
 * destination, so adding a new creation service is a one-line entry in MODES.
 * The screen adapts (prompt / style shown per mode) and hands off to the real
 * surface that runs it (Studio tabs, /avatars, /music), carrying the prompt.
 *
 * It never runs generation itself and never shows pricing/checkout
 * (spend-only): the credit cost is a read-only hint.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clapperboard, Image as ImageIcon, Wand2, UserRound, Music, Film, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', suffix: 'cinematic film still, shallow depth of field, dramatic lighting' },
  { id: 'anime', label: 'Anime', emoji: '🌸', suffix: 'anime style, vibrant cel shading' },
  { id: 'vhs', label: 'VHS', emoji: '📼', suffix: 'retro VHS camcorder look, grain and scanlines' },
  { id: 'noir', label: 'Noir', emoji: '🖤', suffix: 'high-contrast black and white film noir' },
  { id: 'vapor', label: 'Vapor', emoji: '🌈', suffix: 'vaporwave, neon magenta and cyan, dreamy haze' },
];

interface CreationMode {
  id: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  usesPrompt: boolean;
  usesStyle: boolean;
  cta: string;
  placeholder: string;
  /** Build the destination for the real surface that runs this mode. */
  build: (prompt: string, styleSuffix: string | null) => string;
}

const enc = encodeURIComponent;
const withStyle = (p: string, s: string | null) => (s ? `${p.trim()}, ${s}` : p.trim());

// ── The creation services. Add a mode here and it appears in the hub. ──────────
const MODES: CreationMode[] = [
  {
    id: 'video', label: 'Video', sub: 'Text → video', Icon: Clapperboard, usesPrompt: true, usesStyle: true,
    cta: 'Generate video', placeholder: 'A neon-soaked Tokyo alley in the rain, a lone figure with a glowing umbrella…',
    build: (p, s) => `/studio?tab=create&prompt=${enc(withStyle(p, s))}`,
  },
  {
    id: 'image', label: 'Image', sub: 'Text → image', Icon: ImageIcon, usesPrompt: true, usesStyle: true,
    cta: 'Generate image', placeholder: 'A portrait of a desert wanderer at golden hour, 85mm…',
    build: (p, s) => `/studio?tab=image&prompt=${enc(withStyle(p, s))}`,
  },
  {
    id: 'animate', label: 'Animate', sub: 'Image → video', Icon: Wand2, usesPrompt: true, usesStyle: false,
    cta: 'Animate an image', placeholder: 'Describe the motion — slow push-in, hair drifting in the wind…',
    build: (p) => `/studio?tab=create&prompt=${enc(p.trim())}`,
  },
  {
    id: 'avatar', label: 'Avatar', sub: 'Talking character', Icon: UserRound, usesPrompt: false, usesStyle: false,
    cta: 'Open avatar studio', placeholder: '',
    build: () => `/avatars`,
  },
  {
    id: 'music', label: 'Music', sub: 'Score & audio', Icon: Music, usesPrompt: true, usesStyle: false,
    cta: 'Compose', placeholder: 'A tense orchestral build with low strings and a distant choir…',
    build: (p) => (p.trim() ? `/music?prompt=${enc(p.trim())}` : '/music'),
  },
  {
    id: 'scenes', label: 'Scenes', sub: 'Multi-shot film', Icon: Film, usesPrompt: true, usesStyle: true,
    cta: 'Build scenes', placeholder: 'A three-shot chase: rooftop, alley, then the harbour at dawn…',
    build: (p, s) => `/studio?tab=scenes&prompt=${enc(withStyle(p, s))}`,
  },
];

export default function Create() {
  const navigate = useNavigate();
  const [modeId, setModeId] = useState('video');
  const [prompt, setPrompt] = useState('');
  const [styleId, setStyleId] = useState<string | null>('cinematic');

  const mode = useMemo(() => MODES.find((m) => m.id === modeId) ?? MODES[0], [modeId]);
  const canGenerate = !mode.usesPrompt || prompt.trim().length > 0;

  const generate = () => {
    if (!canGenerate) return;
    void hapticTap();
    const suffix = mode.usesStyle ? STYLES.find((s) => s.id === styleId)?.suffix ?? null : null;
    navigate(mode.build(prompt, suffix));
  };

  return (
    <div className="fixed inset-0 flex flex-col text-white">
      <AuroraBackdrop />
      <div
        className="relative z-10 flex-1 overflow-y-auto px-5"
        style={{
          paddingTop: 'calc(var(--safe-top, 0px) + 30px)',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 88px)',
        }}
      >
        {/* Mode hub — borderless transparent icons with small labels */}
        <div className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: 'none' }} aria-label="Creation mode">
          {MODES.map((m) => {
            const on = m.id === modeId;
            return (
              <button
                key={m.id}
                onClick={() => { void hapticTap(); setModeId(m.id); }}
                aria-label={m.label}
                title={m.label}
                className="flex w-[58px] flex-none flex-col items-center gap-1.5 transition-all duration-200"
              >
                <m.Icon className={cn('h-[24px] w-[24px] transition-colors', on ? 'text-[#8fb4ff]' : 'text-white/55')} strokeWidth={1.8} />
                <span className={cn('font-display text-[10px] font-medium', on ? 'text-[#8fb4ff]' : 'text-white/45')}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Prompt — borderless lit-glass surface (modes that take a prompt) */}
        {mode.usesPrompt && (
          <div className="mt-6 rounded-[26px] surface-2 p-5 transition-shadow duration-300 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_28px_84px_-30px_rgba(60,90,255,.55)]">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={mode.placeholder}
              className="w-full resize-none bg-transparent text-[18px] leading-relaxed text-white outline-none placeholder:text-white/30"
              style={{ outline: 'none', boxShadow: 'none' }}
            />
          </div>
        )}

        {/* Style — borderless transparent emoji with small labels */}
        {mode.usesStyle && (
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-4">
            {STYLES.map((s) => {
              const on = s.id === styleId;
              return (
                <button
                  key={s.id}
                  onClick={() => { void hapticTap(); setStyleId(on ? null : s.id); }}
                  aria-label={s.label}
                  title={s.label}
                  className={cn('flex flex-col items-center gap-1.5 transition-all duration-200', on ? 'opacity-100' : 'opacity-45')}
                >
                  <span className="text-[24px] leading-none">{s.emoji}</span>
                  <span className={cn('font-display text-[10px] font-medium', on ? 'text-[#8fb4ff]' : 'text-white/55')}>{s.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate — borderless transparent action with a small label */}
      <button
        onClick={generate}
        disabled={!canGenerate}
        aria-label={mode.cta}
        title={mode.cta}
        className="absolute inset-x-0 z-10 mx-auto flex w-max flex-col items-center gap-1.5 text-[#7aa2ff] transition-opacity disabled:opacity-35"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 22px)' }}
      >
        <span className="flex items-center gap-1.5">
          <mode.Icon className="h-[28px] w-[28px]" strokeWidth={1.9} />
          <ArrowRight className="h-[20px] w-[20px]" strokeWidth={2.2} />
        </span>
        <span className="font-display text-[11px] font-semibold tracking-[0.04em]">{mode.cta}</span>
      </button>
    </div>
  );
}
