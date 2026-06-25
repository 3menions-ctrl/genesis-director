/**
 * Create — make a NEW video, styled to match the web app's Studio create surface
 * (glassmorphism, blue accent, light type, the prompt "stage", a render-engine
 * rail, compact control pills, and a Create bar) — adapted to a single mobile
 * scroll column.
 *
 * Distinct from the Editor (which is a full-screen player + right rail).
 * Generate hands the assembled intent to the real Studio engine. Spend-only:
 * the credit count is shown, never a buy button.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wand2, Image as ImageIcon, UserRound, Clapperboard, Music, Film,
  Cpu, RectangleHorizontal, RectangleVertical, Square, Clock, Mic,
  Settings2, ChevronDown, Sparkles, ArrowRight, Layers,
  type LucideIcon,
} from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;

interface Mode { id: string; label: string; Icon: LucideIcon; cta: string; placeholder: string; tab: string; }
const MODES: Mode[] = [
  { id: 'video', label: 'Cinematic', Icon: Clapperboard, cta: 'Create', tab: 'create', placeholder: 'A lone astronaut watching twin suns set over a glass desert…' },
  { id: 'animate', label: 'Animate', Icon: Wand2, cta: 'Animate', tab: 'create', placeholder: 'Describe how the image should move…' },
  { id: 'image', label: 'Image', Icon: ImageIcon, cta: 'Create', tab: 'image', placeholder: 'A portrait of a desert wanderer at golden hour, 85mm…' },
  { id: 'avatar', label: 'Avatar', Icon: UserRound, cta: 'Create', tab: 'create', placeholder: 'What should the presenter say?' },
  { id: 'scenes', label: 'Scenes', Icon: Film, cta: 'Build', tab: 'scenes', placeholder: 'A three-shot chase: rooftop, alley, then the harbour at dawn…' },
  { id: 'music', label: 'Music', Icon: Music, cta: 'Compose', tab: 'create', placeholder: 'A tense orchestral build with low strings and a distant choir…' },
];

const ENGINES = [
  { id: 'wan', name: 'Wan 2.5' },
  { id: 'kling', name: 'Kling V3' },
  { id: 'seedance', name: 'Seedance' },
  { id: 'veo', name: 'Veo 3', locked: true },
  { id: 'sora', name: 'Sora 2', locked: true },
];

const ASPECTS = [
  { id: '16:9', Icon: RectangleHorizontal },
  { id: '9:16', Icon: RectangleVertical },
  { id: '1:1', Icon: Square },
] as const;

const DURATIONS = ['5s', '10s'] as const;
const GENRES = ['Cinematic', 'Documentary', 'Commercial', 'Narrative', 'Motivational'];
const MOODS = ['Epic', 'Suspense', 'Emotional', 'Action', 'Mystery', 'Uplifting', 'Dark', 'Romantic'];

// Active-accent spotlight used on selected pills (matches the web Studio).
const ACTIVE = {
  background: 'linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)',
  boxShadow: '0 0 24px hsla(215,100%,60%,0.35), inset 0 1px 0 hsla(0,0%,100%,0.10)',
};

export default function Create() {
  const navigate = useNavigate();
  const { available } = useCredits();
  const [modeId, setModeId] = useState('video');
  const [engineId, setEngineId] = useState('wan');
  const [aspect, setAspect] = useState(0);
  const [duration, setDuration] = useState<string>('5s');
  const [narration, setNarration] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');

  const mode = useMemo(() => MODES.find((m) => m.id === modeId) ?? MODES[0], [modeId]);
  const engine = ENGINES.find((e) => e.id === engineId) ?? ENGINES[0];
  const canGenerate = mode.id === 'avatar' || prompt.trim().length > 0;
  const cost = mode.id === 'music' ? 4 : mode.id === 'image' ? 1 : 2;

  const generate = () => {
    if (!canGenerate) return;
    void hapticTap();
    const extras = [genre, mood].filter(Boolean).join(' ');
    const full = extras ? `${prompt.trim()}, ${extras.toLowerCase()}` : prompt.trim();
    if (mode.id === 'avatar') return navigate('/avatars');
    if (mode.id === 'music') return navigate(full ? `/music?prompt=${enc(full)}` : '/music');
    navigate(`/studio?tab=${mode.tab}&prompt=${enc(full)}`);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      {/* Studio-style backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, hsl(220 16% 7%) 0%, hsl(222 18% 3%) 62%)' }} />
        <div className="absolute -top-1/4 left-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, hsl(215 100% 55% / 0.18) 0%, transparent 60%)' }} />
      </div>

      <div
        className="relative z-10 mx-auto max-w-[640px] px-4"
        style={{ paddingTop: 'calc(var(--safe-top,0px) + 22px)', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 96px)' }}
      >
        {/* Mode rail + credits */}
        <div className="flex items-center justify-between gap-3">
          <div className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto rounded-full p-1" style={{ background: 'hsla(0,0%,100%,0.025)', backdropFilter: 'blur(48px) saturate(180%)', scrollbarWidth: 'none' }}>
            {MODES.map((m) => {
              const on = m.id === modeId;
              return (
                <button key={m.id} onClick={() => { void hapticTap(); setModeId(m.id); }}
                  className={cn('inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-light transition-colors', on ? 'text-white' : 'text-white/45')}
                  style={on ? ACTIVE : undefined}>
                  <m.Icon className="h-[15px] w-[15px]" strokeWidth={1.5} /> {m.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-none items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-light" style={{ background: 'hsla(0,0%,100%,0.03)' }}>
            <Sparkles className="h-[15px] w-[15px] text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
            <span className="tabular-nums text-white/85">{available}</span>
          </div>
        </div>

        {/* Render engine rail */}
        <div className="mb-3 mt-6 flex items-center gap-2 text-[10px] font-light uppercase tracking-[0.24em] text-white/40">
          <Cpu className="h-3.5 w-3.5" strokeWidth={1.5} /> Render engine
        </div>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
          {ENGINES.map((e) => {
            const on = e.id === engineId;
            return (
              <button key={e.id} disabled={e.locked} onClick={() => { void hapticTap(); setEngineId(e.id); }}
                className={cn('inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-3.5 text-[12px] font-light transition-all', on ? 'text-white' : 'text-white/55', e.locked && 'cursor-not-allowed opacity-35')}
                style={on ? ACTIVE : { background: 'hsla(0,0%,100%,0.03)' }}>
                <Cpu className="h-[14px] w-[14px]" strokeWidth={1.5} /> {e.name}
              </button>
            );
          })}
        </div>

        {/* The Stage — prompt */}
        <div
          className="relative mt-6 overflow-hidden rounded-3xl p-5"
          style={{
            background: 'linear-gradient(180deg, hsla(0,0%,100%,0.04) 0%, hsla(0,0%,100%,0.01) 50%, hsla(0,0%,100%,0.02) 100%)',
            backdropFilter: 'blur(56px) saturate(180%)',
            boxShadow: '0 50px 120px -30px rgba(0,0,0,0.75), inset 0 1px 0 hsla(0,0%,100%,0.06)',
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(215,100%,65%)]/40 to-transparent" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, hsl(215 100% 60% / 0.14), transparent 70%)' }} />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
            rows={5}
            placeholder={mode.placeholder}
            className="relative w-full resize-none border-0 bg-transparent text-[19px] font-light leading-[1.45] tracking-[-0.015em] text-white outline-none placeholder:text-white/25"
            style={{ outline: 'none' }}
          />
          <div className="relative mt-3 flex items-center justify-between text-[10px] font-light uppercase tracking-[0.22em] text-white/30">
            <span>Prompt</span>
            <span className="tabular-nums">{prompt.length} / 1000</span>
          </div>
        </div>

        {/* Controls rail */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button onClick={() => { void hapticTap(); setAspect((a) => (a + 1) % ASPECTS.length); }}
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[12px] font-light text-white/75" style={{ background: 'hsla(0,0%,100%,0.035)' }}>
            {(() => { const A = ASPECTS[aspect]; return <A.Icon className="h-[15px] w-[15px]" strokeWidth={1.5} />; })()}
            {ASPECTS[aspect].id}
          </button>

          <div className="inline-flex h-10 items-center gap-0.5 rounded-full pl-3 pr-1" style={{ background: 'hsla(0,0%,100%,0.035)' }}>
            <Clock className="mr-1 h-[15px] w-[15px] text-white/55" strokeWidth={1.5} />
            {DURATIONS.map((d) => {
              const on = d === duration;
              return (
                <button key={d} onClick={() => { void hapticTap(); setDuration(d); }}
                  className={cn('h-8 rounded-full px-3 text-[11.5px] font-light transition-colors', on ? 'text-white' : 'text-white/55')}
                  style={on ? ACTIVE : undefined}>{d}</button>
              );
            })}
          </div>

          <button onClick={() => { void hapticTap(); setNarration((n) => !n); }} aria-label="Narration"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={narration ? ACTIVE : { background: 'hsla(0,0%,100%,0.035)' }}>
            <Mic className={cn('h-[16px] w-[16px]', narration ? 'text-white' : 'text-white/55')} strokeWidth={1.5} />
          </button>

          <button onClick={() => { void hapticTap(); setAdvanced((v) => !v); }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-light text-white/75" style={{ background: 'hsla(0,0%,100%,0.035)' }}>
            <Settings2 className="h-[15px] w-[15px]" strokeWidth={1.5} /> Advanced
            <ChevronDown className={cn('h-[14px] w-[14px] transition-transform', advanced && 'rotate-180')} strokeWidth={1.5} />
          </button>
        </div>

        {/* Advanced drawer */}
        {advanced && (
          <div className="mt-5 space-y-4">
            <ChipField label="Genre" options={GENRES} value={genre} onPick={setGenre} />
            <ChipField label="Mood" options={MOODS} value={mood} onPick={setMood} />
          </div>
        )}

        {/* Meta strip */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-[10px] font-light uppercase tracking-[0.2em] text-white/40">
          <span className="tabular-nums">{duration} runtime</span>
          <span>·</span>
          <span className="tabular-nums">{cost} credits</span>
          <span>·</span>
          <span>{ASPECTS[aspect].id}</span>
          <span>·</span>
          <span className="text-[hsl(215,100%,72%)]">{engine.name}</span>
        </div>

        {/* Quiet footer links */}
        <div className="mt-9 flex items-center justify-center gap-6 text-[13px] font-light text-white/45">
          <button onClick={() => navigate('/templates')} className="inline-flex items-center gap-1.5"><Layers className="h-4 w-4" strokeWidth={1.5} /> Templates</button>
          <button onClick={() => navigate('/library')} className="inline-flex items-center gap-1.5"><Film className="h-4 w-4" strokeWidth={1.5} /> Library</button>
        </div>
      </div>

      {/* Create bar (sticky) */}
      <div
        className="absolute inset-x-0 z-20 px-4"
        style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 14px)' }}
      >
        <button
          onClick={generate}
          disabled={!canGenerate}
          className={cn('flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[14px] font-light transition-all duration-300', !canGenerate && 'opacity-40')}
          style={canGenerate ? {
            background: 'linear-gradient(180deg, hsl(215,100%,62%) 0%, hsl(215,100%,48%) 100%)',
            boxShadow: '0 16px 48px -12px hsla(215,100%,55%,0.7), 0 0 24px hsla(215,100%,60%,0.25), inset 0 1px 0 hsla(215,100%,85%,0.45)',
          } : { background: 'hsla(0,0%,100%,0.05)' }}
        >
          <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.6} />
          <span className="font-normal">{mode.cta}</span>
          <span className="mx-1 h-4 w-px bg-white/25" />
          <span className="tabular-nums opacity-90">{cost} credits</span>
          <ArrowRight className="h-[16px] w-[16px]" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function ChipField({ label, options, value, onPick }: { label: string; options: string[]; value: string | null; onPick: (v: string | null) => void }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-light uppercase tracking-[0.22em] text-white/40">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o === value;
          return (
            <button key={o} onClick={() => { void hapticTap(); onPick(on ? null : o); }}
              className={cn('h-9 rounded-full px-3.5 text-[12px] font-light transition-colors', on ? 'text-white' : 'text-white/60')}
              style={on ? ACTIVE : { background: 'hsla(0,0%,100%,0.035)' }}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}
