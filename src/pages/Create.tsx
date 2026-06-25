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
        <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-[#7aa2ff]">Create</div>
        <h1 className="mt-3 text-[36px] font-light leading-[1.03] tracking-[-0.01em]" style={{ fontFamily: 'Fraunces, serif' }}>
          What do you want to{' '}
          <span
            className="bg-gradient-to-r from-[#8fb4ff] via-[#b79bff] to-[#7adfff] bg-clip-text italic text-transparent"
            style={{ fontWeight: 500 }}
          >
            make?
          </span>
        </h1>

        {/* Mode hub — the comprehensive set of creation services */}
        <div className="-mx-5 mt-6 flex gap-2.5 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
          {MODES.map((m) => {
            const on = m.id === modeId;
            return (
              <button
                key={m.id}
                onClick={() => { void hapticTap(); setModeId(m.id); }}
                className={cn(
                  'flex w-[92px] flex-none flex-col items-start gap-2 rounded-[18px] p-3 text-left transition-all duration-200',
                  on ? 'surface-2' : 'surface-1 opacity-80',
                )}
              >
                <m.Icon className={cn('h-[20px] w-[20px]', on ? 'text-[#7aa2ff]' : 'text-white/70')} strokeWidth={1.8} />
                <span className="text-[13px] font-semibold leading-none">{m.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-wide text-white/40">{m.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Prompt — borderless lit-glass surface (modes that take a prompt) */}
        {mode.usesPrompt && (
          <div className="mt-5 rounded-[26px] surface-2 p-5 transition-shadow duration-300 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_28px_84px_-30px_rgba(60,90,255,.55)]">
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

        {/* Style — only for visual modes */}
        {mode.usesStyle && (
          <>
            <div className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Style</div>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => {
                const on = s.id === styleId;
                return (
                  <button
                    key={s.id}
                    onClick={() => { void hapticTap(); setStyleId(on ? null : s.id); }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-200',
                      on
                        ? 'bg-gradient-to-br from-[#3f78ff] to-[#7a3bff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_12px_30px_-8px_rgba(80,90,255,.75)]'
                        : 'surface-1 text-white/75',
                    )}
                  >
                    <span className="text-[14px]">{s.emoji}</span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Avatar/music modes get a short note instead of style */}
        {!mode.usesStyle && (
          <p className="mt-6 text-[14px] italic leading-relaxed text-white/40" style={{ fontFamily: 'Fraunces, serif' }}>
            {mode.id === 'avatar'
              ? 'Pick a face and a voice in the avatar studio — your script becomes a performance.'
              : 'Describe the mood; the composer scores it. Lands in your library, ready to drop on a film.'}
          </p>
        )}
      </div>

      {/* Generate — compact CTA */}
      <button
        onClick={generate}
        disabled={!canGenerate}
        className="absolute left-5 right-5 z-10 flex h-[52px] items-center justify-between rounded-[16px] bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] pl-5 pr-2.5 font-display text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_22px_44px_-12px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-55"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 16px)' }}
      >
        <span className="flex items-center gap-2 text-[15px] font-bold">
          <mode.Icon className="h-[18px] w-[18px]" strokeWidth={2} /> {mode.cta}
        </span>
        <span className="flex items-center gap-1.5 rounded-[11px] bg-black/25 px-3 py-1.5 font-mono text-[12px] font-semibold">
          {mode.id === 'music' ? 'from 4 ◇' : mode.id === 'image' ? 'from 1 ◇' : 'from 2 ◇'} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}
