/**
 * Create — make a NEW video. This is deliberately its OWN layout, distinct from
 * the Editor (which is a full-screen player + right rail for an existing clip).
 *
 * Creating is prompt-first: a big idea field on the Aurora canvas, the creation
 * type, a browseable gallery of starting templates, and a style — then Generate
 * hands the assembled intent to the real surface that runs it (Studio tabs /
 * avatars / music). Spend-only: no pricing here.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check,
  Clapperboard, Image as ImageIcon, Wand2, UserRound, Music, Film,
  type LucideIcon,
} from 'lucide-react';
import { FILMS } from '@/data/filmsLibrary';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;
const withStyle = (p: string, s: string | null) => (s ? `${p.trim()}, ${s}` : p.trim());
const clip = (i: number) => FILMS[i]?.clips?.[0] ?? FILMS[0]?.clips?.[0] ?? '';

interface Mode {
  id: string; label: string; Icon: LucideIcon; usesStyle: boolean; cta: string;
  build: (prompt: string, styleSuffix: string | null) => string;
}
const MODES: Mode[] = [
  { id: 'video', label: 'Video', Icon: Clapperboard, usesStyle: true, cta: 'Generate video', build: (p, s) => `/studio?tab=create&prompt=${enc(withStyle(p, s))}` },
  { id: 'image', label: 'Image', Icon: ImageIcon, usesStyle: true, cta: 'Generate image', build: (p, s) => `/studio?tab=image&prompt=${enc(withStyle(p, s))}` },
  { id: 'animate', label: 'Animate', Icon: Wand2, usesStyle: false, cta: 'Animate', build: (p) => `/studio?tab=create&prompt=${enc(p.trim())}` },
  { id: 'avatar', label: 'Avatar', Icon: UserRound, usesStyle: false, cta: 'Open avatar studio', build: () => `/avatars` },
  { id: 'music', label: 'Music', Icon: Music, usesStyle: false, cta: 'Compose', build: (p) => (p.trim() ? `/music?prompt=${enc(p.trim())}` : '/music') },
  { id: 'scenes', label: 'Scenes', Icon: Film, usesStyle: true, cta: 'Build scenes', build: (p, s) => `/studio?tab=scenes&prompt=${enc(withStyle(p, s))}` },
];

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', suffix: 'cinematic film still, shallow depth of field, dramatic lighting' },
  { id: 'anime', label: 'Anime', emoji: '🌸', suffix: 'anime style, vibrant cel shading' },
  { id: 'vhs', label: 'VHS', emoji: '📼', suffix: 'retro VHS camcorder look, grain and scanlines' },
  { id: 'noir', label: 'Noir', emoji: '🖤', suffix: 'high-contrast black and white film noir' },
  { id: 'vapor', label: 'Vapor', emoji: '🌈', suffix: 'vaporwave, neon magenta and cyan, dreamy haze' },
  { id: 'golden', label: 'Golden', emoji: '🌅', suffix: 'warm golden hour light, soft haze' },
];

interface Template { id: string; name: string; emoji: string; mode: string; seed: string; src: string; }
const TEMPLATES: Template[] = [
  { id: 'trailer', name: 'Cinematic Trailer', emoji: '🎬', mode: 'video', seed: 'epic cinematic movie trailer, dramatic', src: clip(3) },
  { id: 'musicvid', name: 'Music Video', emoji: '🎵', mode: 'video', seed: 'stylish music video with rhythmic cuts', src: clip(2) },
  { id: 'anime', name: 'Anime Short', emoji: '🌸', mode: 'video', seed: 'anime short film', src: clip(4) },
  { id: 'ad', name: 'Product Ad', emoji: '🛍️', mode: 'video', seed: 'sleek product commercial, studio lighting', src: clip(5) },
  { id: 'avatar', name: 'Talking Avatar', emoji: '🗣️', mode: 'avatar', seed: '', src: clip(0) },
  { id: 'scifi', name: 'Sci-Fi Scene', emoji: '🚀', mode: 'video', seed: 'sci-fi space scene, neon', src: clip(1) },
];

export default function Create() {
  const navigate = useNavigate();
  const [modeId, setModeId] = useState('video');
  const [styleId, setStyleId] = useState<string | null>('cinematic');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');

  const mode = useMemo(() => MODES.find((m) => m.id === modeId) ?? MODES[0], [modeId]);
  const canGenerate = mode.id === 'avatar' || prompt.trim().length > 0 || !!templateId;

  const pickTemplate = (t: Template) => {
    void hapticTap();
    setTemplateId((cur) => (cur === t.id ? null : t.id));
    setModeId(t.mode);
    if (t.seed && !prompt.trim()) setPrompt(t.seed);
  };

  const generate = () => {
    if (!canGenerate) return;
    void hapticTap();
    const suffix = mode.usesStyle ? STYLES.find((s) => s.id === styleId)?.suffix ?? null : null;
    let to = mode.build(prompt, suffix);
    if (templateId && to.includes('?')) to += `&template=${enc(templateId)}`;
    navigate(to);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div
        className="relative z-10 px-5"
        style={{
          paddingTop: 'calc(var(--safe-top,0px) + 30px)',
          paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 104px)',
        }}
      >
        {/* Prompt — the idea, front and centre */}
        <div className="rounded-[28px] surface-2 p-5 transition-shadow duration-300 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_28px_84px_-30px_rgba(60,90,255,.55)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Describe the video you want to create…"
            className="w-full resize-none bg-transparent text-[19px] leading-relaxed text-white outline-none placeholder:text-white/30"
            style={{ outline: 'none' }}
          />
        </div>

        {/* Type — pick what you're making */}
        <div className="-mx-5 mt-7 flex gap-1 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }} aria-label="Type">
          {MODES.map((m) => {
            const on = m.id === modeId;
            return (
              <button key={m.id} onClick={() => { void hapticTap(); setModeId(m.id); }} aria-label={m.label} title={m.label}
                className="flex w-[58px] flex-none flex-col items-center gap-1.5">
                <m.Icon className={cn('h-[24px] w-[24px] transition-colors', on ? 'text-[#8fb4ff]' : 'text-white/55')} strokeWidth={1.8} />
                <span className={cn('font-display text-[10px] font-medium', on ? 'text-[#8fb4ff]' : 'text-white/45')}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Templates — browse a starting point (live previews) */}
        <div className="-mx-5 mt-7 flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }} aria-label="Templates">
          {TEMPLATES.map((t) => {
            const on = templateId === t.id;
            return (
              <button key={t.id} onClick={() => pickTemplate(t)} aria-label={t.name} title={t.name}
                className={cn('relative aspect-video w-[150px] flex-none overflow-hidden rounded-[18px] transition-all', on ? 'ring-2 ring-[#3f78ff]' : 'ring-1 ring-white/10')}>
                <video src={t.src} muted loop autoPlay playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute right-2 top-2 text-[18px] drop-shadow">{t.emoji}</span>
                <span className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 font-display text-[12px] font-semibold drop-shadow">{t.name}</span>
                {on && (
                  <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#3f78ff] shadow-[0_3px_10px_-2px_rgba(47,107,255,.9)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Style — only for visual modes */}
        {mode.usesStyle && (
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-4">
            {STYLES.map((s) => {
              const on = s.id === styleId;
              return (
                <button key={s.id} onClick={() => { void hapticTap(); setStyleId(on ? null : s.id); }} aria-label={s.label} title={s.label}
                  className={cn('flex flex-col items-center gap-1.5 transition-opacity', on ? 'opacity-100' : 'opacity-45')}>
                  <span className="text-[24px] leading-none">{s.emoji}</span>
                  <span className={cn('font-display text-[10px] font-medium', on ? 'text-[#8fb4ff]' : 'text-white/55')}>{s.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate — prominent, bottom; lights up once there's an idea or template */}
      <button
        onClick={generate}
        disabled={!canGenerate}
        aria-label={mode.cta}
        title={mode.cta}
        className={cn(
          'absolute inset-x-5 z-20 flex h-[54px] items-center justify-center gap-2.5 rounded-[18px] font-display text-[15px] font-bold transition-all duration-300',
          canGenerate
            ? 'bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_22px_44px_-12px_rgba(80,80,255,.7)]'
            : 'border border-white/15 bg-white/[0.04] text-white/40',
        )}
        style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}
      >
        <mode.Icon className="h-[20px] w-[20px]" strokeWidth={2} />
        {mode.cta}
        <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </button>
    </div>
  );
}
