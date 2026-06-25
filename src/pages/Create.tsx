/**
 * Create — a full-screen media canvas with a transparent right-hand tool rail.
 *
 * The entire page is the playback player (a looping preview). Down the right
 * edge sits a borderless, transparent rail of tools; tapping one slides up a
 * popup sheet (Templates, Type, Style, Prompt). Generate hands the assembled
 * intent to the real surface that runs it (Studio tabs, /avatars, /music).
 *
 * Spend-only: no pricing/checkout here.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Palette, Pencil, ArrowRight, X, Check,
  Clapperboard, Image as ImageIcon, Wand2, UserRound, Music, Film,
  type LucideIcon,
} from 'lucide-react';
import { FILMS } from '@/data/filmsLibrary';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;
const withStyle = (p: string, s: string | null) => (s ? `${p.trim()}, ${s}` : p.trim());
const clip = (i: number) => FILMS[i]?.clips?.[0] ?? FILMS[0]?.clips?.[0] ?? '';

/* ── creation modes (the comprehensive set; routes to real surfaces) ── */
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

interface Template { id: string; name: string; emoji: string; mode: string; seed: string; src: string; grad: string; }
const TEMPLATES: Template[] = [
  { id: 'trailer', name: 'Cinematic Trailer', emoji: '🎬', mode: 'video', seed: 'epic cinematic movie trailer, dramatic', src: clip(3), grad: 'linear-gradient(150deg,#3a2a16,#0a0a0a)' },
  { id: 'musicvid', name: 'Music Video', emoji: '🎵', mode: 'video', seed: 'stylish music video with rhythmic cuts', src: clip(2), grad: 'linear-gradient(150deg,#2a163a,#0a0a0a)' },
  { id: 'anime', name: 'Anime Short', emoji: '🌸', mode: 'video', seed: 'anime short film', src: clip(4), grad: 'linear-gradient(150deg,#3a1640,#0a0a0a)' },
  { id: 'ad', name: 'Product Ad', emoji: '🛍️', mode: 'video', seed: 'sleek product commercial, studio lighting', src: clip(5), grad: 'linear-gradient(150deg,#16263a,#0a0a0a)' },
  { id: 'avatar', name: 'Talking Avatar', emoji: '🗣️', mode: 'avatar', seed: '', src: clip(0), grad: 'linear-gradient(150deg,#163a2a,#0a0a0a)' },
  { id: 'scifi', name: 'Sci-Fi Scene', emoji: '🚀', mode: 'video', seed: 'sci-fi space scene, neon', src: clip(1), grad: 'linear-gradient(150deg,#241a3a,#0a0a0a)' },
];

type Sheet = null | 'templates' | 'mode' | 'style' | 'prompt';

export default function Create() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [modeId, setModeId] = useState('video');
  const [styleId, setStyleId] = useState<string | null>('cinematic');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [canvasSrc, setCanvasSrc] = useState(clip(0));

  const mode = useMemo(() => MODES.find((m) => m.id === modeId) ?? MODES[0], [modeId]);
  const canGenerate = mode.id === 'avatar' || prompt.trim().length > 0 || !!templateId;

  const open = (s: Sheet) => { void hapticTap(); setSheet(s); };
  const close = () => setSheet(null);

  const pickTemplate = (t: Template) => {
    void hapticTap();
    setTemplateId(t.id);
    setModeId(t.mode);
    setCanvasSrc(t.src);
    if (t.seed && !prompt.trim()) setPrompt(t.seed);
    close();
  };

  const generate = () => {
    if (!canGenerate) return;
    void hapticTap();
    const suffix = mode.usesStyle ? STYLES.find((s) => s.id === styleId)?.suffix ?? null : null;
    let to = mode.build(prompt, suffix);
    if (templateId && to.includes('?')) to += `&template=${enc(templateId)}`;
    navigate(to);
  };

  const TOOLS: { id: Exclude<Sheet, null>; Icon: LucideIcon; label: string }[] = [
    { id: 'templates', Icon: LayoutGrid, label: 'Templates' },
    { id: 'mode', Icon: mode.Icon, label: 'Type' },
    { id: 'style', Icon: Palette, label: 'Style' },
    { id: 'prompt', Icon: Pencil, label: 'Prompt' },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a] text-white">
      {/* ── Full-page playback canvas ── */}
      <video key={`bg-${canvasSrc}`} src={canvasSrc} muted loop autoPlay playsInline
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
      <video key={`fg-${canvasSrc}`} src={canvasSrc} muted loop autoPlay playsInline
        className="absolute inset-0 h-full w-full object-contain" />
      {/* legibility scrims */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/55 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 to-transparent" />

      {/* ── Right tool rail (transparent) — anchored above the tab bar ── */}
      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-6"
        style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 18px)' }}
      >
        {TOOLS.map((t) => {
          const active = (t.id === 'templates' && templateId) || (t.id === 'style' && styleId) || (t.id === 'prompt' && prompt.trim());
          return (
            <button key={t.id} onClick={() => open(t.id)} aria-label={t.label} title={t.label}
              className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors', active ? 'text-[#8fb4ff]' : 'text-white')}>
              <t.Icon className="h-[25px] w-[25px]" strokeWidth={1.8} />
              <span className="font-display text-[10px] font-medium">{t.label}</span>
            </button>
          );
        })}

        {/* Generate — transparent outlined boundary, like the editor's Save */}
        <button onClick={generate} disabled={!canGenerate} aria-label={mode.cta} title={mode.cta}
          className="flex flex-col items-center gap-1 rounded-[18px] border border-[#7aa2ff]/45 bg-transparent px-3.5 py-2 text-[#7aa2ff] drop-shadow-[0_2px_6px_rgba(0,0,0,.6)] transition-opacity disabled:opacity-35">
          <ArrowRight className="h-[24px] w-[24px]" strokeWidth={2.1} />
          <span className="font-display text-[10px] font-semibold">Generate</span>
        </button>
      </div>

      {/* ── Popup sheet ── */}
      <div className={cn('absolute inset-0 z-40', sheet ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div onClick={close} className={cn('absolute inset-0 bg-black/55 transition-opacity duration-300', sheet ? 'opacity-100' : 'opacity-0')} />
        <div
          className={cn('absolute inset-x-0 bottom-0 max-h-[72%] overflow-y-auto rounded-t-[28px] bg-[#101015]/95 px-5 pt-3 backdrop-blur-2xl transition-transform duration-300', sheet ? 'translate-y-0' : 'translate-y-full')}
          style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + 24px)' }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-white/50"><X className="h-5 w-5" /></button>

          {sheet === 'templates' && (
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => {
                const on = templateId === t.id;
                return (
                  <button key={t.id} onClick={() => pickTemplate(t)} aria-label={t.name}
                    className={cn('relative aspect-video overflow-hidden rounded-[18px] transition-all', on ? 'ring-2 ring-[#3f78ff]' : 'ring-1 ring-white/10')}>
                    <span className="absolute inset-0" style={{ background: t.grad }} />
                    <video src={t.src} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute right-2.5 top-2.5 text-[20px] drop-shadow">{t.emoji}</span>
                    <span className="absolute inset-x-0 bottom-0 px-2.5 py-2 font-display text-[12.5px] font-semibold drop-shadow">{t.name}</span>
                    {on && (
                      <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#3f78ff] shadow-[0_3px_10px_-2px_rgba(47,107,255,.9)]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {sheet === 'mode' && (
            <div className="grid grid-cols-3 gap-y-5">
              {MODES.map((m) => {
                const on = m.id === modeId;
                return (
                  <button key={m.id} onClick={() => { void hapticTap(); setModeId(m.id); close(); }}
                    className={cn('flex flex-col items-center gap-2', on ? 'text-[#8fb4ff]' : 'text-white/70')}>
                    <m.Icon className="h-7 w-7" strokeWidth={1.8} />
                    <span className="font-display text-[11px] font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {sheet === 'style' && (
            <div className="grid grid-cols-3 gap-y-6">
              {STYLES.map((s) => {
                const on = s.id === styleId;
                return (
                  <button key={s.id} onClick={() => { void hapticTap(); setStyleId(on ? null : s.id); close(); }}
                    className={cn('flex flex-col items-center gap-2 transition-opacity', on ? 'opacity-100' : 'opacity-55')}>
                    <span className="text-[30px] leading-none">{s.emoji}</span>
                    <span className={cn('font-display text-[11px] font-medium', on ? 'text-[#8fb4ff]' : 'text-white/60')}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {sheet === 'prompt' && (
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                autoFocus
                placeholder="Describe your scene…"
                className="w-full resize-none rounded-[20px] bg-white/[0.06] p-4 text-[17px] leading-relaxed text-white outline-none placeholder:text-white/30"
                style={{ outline: 'none' }}
              />
              <button onClick={close} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] py-3 font-display text-[15px] font-bold">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
