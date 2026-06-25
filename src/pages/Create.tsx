/**
 * Create — a guided, step-by-step flow. The Create tab opens at "What do you
 * want to make?"; each step is a bottom sheet with one question + a few visual
 * choices that auto-advance, leading the user to the writing screen and the
 * action. Config-driven: a new creation type is one entry in FLOWS.
 *
 * Spend-only. The final action routes to the real Studio engine.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Sparkles, ArrowRight,
  RectangleHorizontal, RectangleVertical, Square,
  type LucideIcon,
} from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;

interface Opt { v: string; label: string; emoji?: string; icon?: LucideIcon }
interface Step { id: string; q: string; opts: Opt[]; skip?: boolean }
interface Flow {
  emoji: string; label: string; writeQ: string; placeholder: string; action: string;
  steps: Step[];
  route: (sel: Record<string, string>, prompt: string) => string;
}

const ASPECT_OPTS: Opt[] = [
  { v: '16:9', label: '16:9', icon: RectangleHorizontal },
  { v: '9:16', label: '9:16', icon: RectangleVertical },
  { v: '1:1', label: '1:1', icon: Square },
];
const LOOK_OPTS: Opt[] = [
  { v: 'cinematic', label: 'Cinematic', emoji: '🎬' },
  { v: 'anime', label: 'Anime', emoji: '🌸' },
  { v: 'noir', label: 'Noir', emoji: '🖤' },
  { v: 'vhs', label: 'VHS', emoji: '📼' },
  { v: 'vapor', label: 'Vapor', emoji: '🌈' },
];
const withLook = (p: string, look?: string) => (look ? `${p.trim()}, ${look} style` : p.trim());

const TYPES: Opt[] = [
  { v: 'video', label: 'Video', emoji: '🎬' },
  { v: 'image', label: 'Image', emoji: '🖼️' },
  { v: 'avatar', label: 'Avatar', emoji: '🗣️' },
  { v: 'music', label: 'Music', emoji: '🎵' },
  { v: 'photo', label: 'Edit photo', emoji: '✂️' },
];

const FLOWS: Record<string, Flow> = {
  video: {
    emoji: '🎬', label: 'Video', writeQ: 'Describe your scene', action: 'Generate',
    placeholder: 'A lone astronaut watching twin suns set over a glass desert…',
    steps: [
      { id: 'source', q: 'Start from', opts: [{ v: 'text', label: 'Text', emoji: '✍️' }, { v: 'photo', label: 'A photo', emoji: '🖼️' }, { v: 'template', label: 'Template', emoji: '🎞️' }] },
      { id: 'look', q: 'Pick a look', skip: true, opts: LOOK_OPTS },
      { id: 'aspect', q: 'Format', opts: ASPECT_OPTS },
    ],
    route: (s, p) => `/studio?tab=create&prompt=${enc(withLook(p, s.look))}`,
  },
  image: {
    emoji: '🖼️', label: 'Image', writeQ: 'Describe the image', action: 'Generate',
    placeholder: 'A portrait of a desert wanderer at golden hour, 85mm…',
    steps: [
      { id: 'look', q: 'Pick a style', skip: true, opts: [{ v: 'cinematic', label: 'Cinematic', emoji: '🎬' }, { v: 'anime', label: 'Anime', emoji: '🌸' }, { v: '3d', label: '3D', emoji: '🧊' }, { v: 'photo', label: 'Photo', emoji: '📷' }] },
      { id: 'aspect', q: 'Format', opts: ASPECT_OPTS },
    ],
    route: (s, p) => `/studio?tab=image&prompt=${enc(withLook(p, s.look))}`,
  },
  avatar: {
    emoji: '🗣️', label: 'Avatar', writeQ: 'What do they say?', action: 'Generate',
    placeholder: 'Hey everyone — welcome back to the channel…',
    steps: [
      { id: 'presenter', q: 'Pick a presenter', opts: [{ v: 'nova', label: 'Nova', emoji: '👩🏽' }, { v: 'kai', label: 'Kai', emoji: '🧑🏼' }, { v: 'mara', label: 'Mara', emoji: '👩🏼‍🦰' }, { v: 'own', label: 'Create own', emoji: '➕' }] },
      { id: 'voice', q: 'Pick a voice', opts: [{ v: 'warm', label: 'Warm', emoji: '🎙️' }, { v: 'bright', label: 'Bright', emoji: '✨' }, { v: 'deep', label: 'Deep', emoji: '🔊' }, { v: 'calm', label: 'Calm', emoji: '🌙' }] },
      { id: 'aspect', q: 'Format', opts: ASPECT_OPTS },
    ],
    route: () => `/avatars`,
  },
  music: {
    emoji: '🎵', label: 'Music', writeQ: 'Describe the track', action: 'Compose',
    placeholder: 'A tense orchestral build with low strings and a distant choir…',
    steps: [
      { id: 'genre', q: 'Genre', opts: [{ v: 'cinematic', label: 'Cinematic', emoji: '🎬' }, { v: 'electronic', label: 'Electronic', emoji: '🎛️' }, { v: 'orchestral', label: 'Orchestral', emoji: '🎻' }, { v: 'lofi', label: 'Lo-fi', emoji: '📻' }, { v: 'ambient', label: 'Ambient', emoji: '🌫️' }] },
      { id: 'mood', q: 'Mood', opts: [{ v: 'epic', label: 'Epic', emoji: '⚡' }, { v: 'calm', label: 'Calm', emoji: '🍃' }, { v: 'tense', label: 'Tense', emoji: '🌀' }, { v: 'uplifting', label: 'Uplifting', emoji: '☀️' }, { v: 'dreamy', label: 'Dreamy', emoji: '💭' }] },
    ],
    route: (_s, p) => (p.trim() ? `/music?prompt=${enc(p.trim())}` : '/music'),
  },
  photo: {
    emoji: '✂️', label: 'Edit photo', writeQ: 'Describe the edit', action: 'Apply',
    placeholder: 'Relight to golden hour, remove the background, add film grain…',
    steps: [
      { id: 'source', q: 'Add a photo', opts: [{ v: 'upload', label: 'Upload', emoji: '⬆️' }, { v: 'library', label: 'Library', emoji: '🗂️' }, { v: 'camera', label: 'Camera', emoji: '📸' }] },
      { id: 'op', q: 'What to do', opts: [{ v: 'relight', label: 'Relight', emoji: '💡' }, { v: 'restyle', label: 'Restyle', emoji: '🎨' }, { v: 'remove', label: 'Remove', emoji: '🧽' }, { v: 'upscale', label: 'Upscale', emoji: '🔍' }] },
    ],
    route: (_s, p) => `/studio?tab=photo&prompt=${enc(p.trim())}`,
  },
};

export default function Create() {
  const navigate = useNavigate();
  const [flow, setFlow] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');

  const def = flow ? FLOWS[flow] : null;
  const steps = def?.steps ?? [];
  const atWriting = !!def && step >= steps.length;
  const total = steps.length + 1; // choice steps + writing

  const start = (type: string) => { void hapticTap(); setFlow(type); setStep(0); setSel({}); setPrompt(''); };
  const pick = (id: string, v: string) => { void hapticTap(); setSel((s) => ({ ...s, [id]: v })); setStep((n) => n + 1); };
  const back = () => { void hapticTap(); if (!flow) return; if (step === 0) setFlow(null); else setStep((n) => n - 1); };
  const submit = () => { if (!def) return; void hapticTap(); navigate(def.route(sel, prompt)); };
  const canSubmit = flow === 'avatar' || prompt.trim().length > 0;

  return (
    <div className="fixed inset-0 text-white">
      <AuroraBackdrop />

      {/* faint context above the sheet */}
      {def && (
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center" style={{ paddingTop: 'calc(var(--safe-top,0px) + 56px)' }}>
          <div className="text-[44px]">{def.emoji}</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-white/35">{def.label}</div>
        </div>
      )}

      {/* ── Bottom sheet — the current step ── */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-[30px] bg-[#0c0c12]/95 px-5 pt-3 shadow-[0_-30px_80px_-30px_rgba(0,0,0,.9)] backdrop-blur-2xl"
        style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 20px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

        {/* top row: back + progress */}
        <div className="mb-4 flex h-6 items-center justify-between">
          {flow ? (
            <button onClick={back} aria-label="Back" className="text-white/70"><ChevronLeft className="h-6 w-6" /></button>
          ) : <span className="w-6" />}
          {flow && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-[#8fb4ff]' : i < step ? 'w-1.5 bg-[#8fb4ff]/60' : 'w-1.5 bg-white/15')} />
              ))}
            </div>
          )}
          <span className="w-6" />
        </div>

        <div key={`${flow}-${step}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {!flow ? (
            <Choice q="What do you want to make?" opts={TYPES} cols={3} onPick={(v) => start(v)} />
          ) : !atWriting ? (
            <Choice q={steps[step].q} opts={steps[step].opts} cols={steps[step].opts.length > 4 ? 3 : steps[step].opts.length} onPick={(v) => pick(steps[step].id, v)}
              onSkip={steps[step].skip ? () => pick(steps[step].id, '') : undefined} />
          ) : (
            <Write def={def!} sel={sel} prompt={prompt} setPrompt={setPrompt} canSubmit={canSubmit} onSubmit={submit} onJump={(i) => setStep(i)} />
          )}
        </div>
      </div>
    </div>
  );
}

function Choice({ q, opts, cols, onPick, onSkip }: { q: string; opts: Opt[]; cols: number; onPick: (v: string) => void; onSkip?: () => void }) {
  return (
    <div>
      <h2 className="mb-5 text-center text-[22px] font-light" style={{ fontFamily: 'Fraunces, serif' }}>{q}</h2>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0,1fr))` }}>
        {opts.map((o) => (
          <button key={o.v} onClick={() => onPick(o.v)}
            className="surface-1 flex flex-col items-center gap-2 rounded-[18px] py-4 transition-transform active:scale-95">
            {o.emoji ? <span className="text-[26px] leading-none">{o.emoji}</span> : o.icon ? <o.icon className="h-6 w-6 text-white/85" strokeWidth={1.6} /> : null}
            <span className="text-[12.5px] font-medium">{o.label}</span>
          </button>
        ))}
      </div>
      {onSkip && (
        <button onClick={onSkip} className="mx-auto mt-4 block text-[12px] font-light text-white/45">Skip</button>
      )}
    </div>
  );
}

function Write({ def, sel, prompt, setPrompt, canSubmit, onSubmit, onJump }: {
  def: Flow; sel: Record<string, string>; prompt: string; setPrompt: (v: string) => void; canSubmit: boolean; onSubmit: () => void; onJump: (i: number) => void;
}) {
  return (
    <div>
      {/* chosen settings as chips (tap to revise) */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <span className="rounded-full bg-[#8fb4ff]/15 px-3 py-1 text-[11px] font-medium text-[#cdddff]">{def.emoji} {def.label}</span>
        {def.steps.map((s, i) => sel[s.id] ? (
          <button key={s.id} onClick={() => onJump(i)} className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-light text-white/70">
            {def.steps[i].opts.find((o) => o.v === sel[s.id])?.label ?? sel[s.id]}
          </button>
        ) : null)}
      </div>

      <h2 className="mb-3 text-center text-[22px] font-light" style={{ fontFamily: 'Fraunces, serif' }}>{def.writeQ}</h2>

      <div className="surface-2 rounded-[22px] p-1 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_24px_70px_-30px_rgba(60,90,255,.55)]">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} autoFocus placeholder={def.placeholder}
          className="w-full resize-none bg-transparent px-4 py-3 text-[16px] font-light leading-relaxed text-white outline-none placeholder:text-white/25" style={{ outline: 'none' }} />
      </div>

      <button onClick={onSubmit} disabled={!canSubmit}
        className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_22px_44px_-12px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-40">
        <Sparkles className="h-[18px] w-[18px]" /> {def.action} <ArrowRight className="h-[17px] w-[17px]" />
      </button>
    </div>
  );
}
