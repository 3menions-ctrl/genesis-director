/**
 * Create — mobile adaptation of the web app's NEW creation surface
 * (src/components/studio/CreationStudio.tsx): a Runway/Canva-style RAIL + CANVAS
 * + composition-bar layout.
 *
 *   ┌──────┬───────────────────────────────┐
 *   │ RAIL │  CANVAS (active module)        │
 *   │      ├───────────────────────────────┤
 *   │      │  composition bar  ·  Create    │
 *   └──────┴───────────────────────────────┘
 *
 * Generate is the default module; the other rail modules configure or pick
 * assets/finish. Create routes to the real Studio engine. Spend-only.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wand2, Image as ImageIcon, Scissors, Users, Mic, Music as MusicIcon, Globe2,
  Palette, PenLine, LayoutGrid, Cpu, Lock, Sparkles, ArrowRight, ChevronDown,
  RectangleHorizontal, RectangleVertical, Square, Clock, UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;

interface Module { id: string; label: string; icon: LucideIcon; group: 'create' | 'assets' | 'finish'; }
const MODULES: Module[] = [
  { id: 'generate', label: 'Generate', icon: Wand2, group: 'create' },
  { id: 'image', label: 'Image', icon: ImageIcon, group: 'create' },
  { id: 'photo', label: 'Photo', icon: Scissors, group: 'create' },
  { id: 'cast', label: 'Cast', icon: Users, group: 'assets' },
  { id: 'voice', label: 'Voice', icon: Mic, group: 'assets' },
  { id: 'music', label: 'Music', icon: MusicIcon, group: 'assets' },
  { id: 'worlds', label: 'Worlds', icon: Globe2, group: 'assets' },
  { id: 'look', label: 'Look', icon: Palette, group: 'finish' },
  { id: 'story', label: 'Story', icon: PenLine, group: 'finish' },
  { id: 'templates', label: 'Templates', icon: LayoutGrid, group: 'finish' },
];
const GROUPS: Module['group'][] = ['create', 'assets', 'finish'];

const SUBMODES = [
  { id: 'cinematic', label: 'Cinematic', Icon: Wand2 },
  { id: 'animate', label: 'Animate', Icon: ImageIcon },
  { id: 'avatar', label: 'Avatar', Icon: UserRound },
];

const ENGINES = [
  { id: 'wan', provider: 'Alibaba', name: 'Wan 2.5' },
  { id: 'kling', provider: 'Kuaishou', name: 'Kling V3' },
  { id: 'seedance', provider: 'ByteDance', name: 'Seedance' },
  { id: 'veo', provider: 'Google', name: 'Veo 3', locked: true },
  { id: 'sora', provider: 'OpenAI', name: 'Sora 2', locked: true },
];

const ASPECTS = [
  { id: '16:9', Icon: RectangleHorizontal },
  { id: '9:16', Icon: RectangleVertical },
  { id: '1:1', Icon: Square },
] as const;
const DURATIONS = ['5s', '10s'] as const;
const GENRES = ['Cinematic', 'Documentary', 'Commercial', 'Narrative', 'Motivational'];
const MOODS = ['Epic', 'Suspense', 'Emotional', 'Action', 'Mystery', 'Uplifting'];
const LOOKS = ['Kodak 2383', 'Teal & Orange', 'Bleach Bypass', 'Vintage 70s', 'Noir', 'Golden Hour', 'Cyberpunk', 'Pastel'];

const SUBTITLE: Record<string, string> = {
  cast: 'Pick a presenter — locks identity for Avatar mode and breakouts.',
  voice: 'Choose a narration or character voice.',
  music: 'Score your film — pick a genre and mood.',
  worlds: 'Pick an environment that folds into the scene.',
  look: 'A film grade applied to the whole render.',
  story: 'A logline that seeds the prompt.',
  templates: '4th-wall breakouts & crossover effects.',
  image: 'Text to image — describe the frame.',
  photo: 'Edit and restyle an existing image.',
};

export default function Create() {
  const navigate = useNavigate();
  const { available } = useCredits();
  const [active, setActive] = useState('generate');
  const [submode, setSubmode] = useState('cinematic');
  const [engineId, setEngineId] = useState('wan');
  const [aspect, setAspect] = useState(0);
  const [duration, setDuration] = useState<string>('5s');
  const [advanced, setAdvanced] = useState(false);
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [look, setLook] = useState<string | null>(null);
  const [story, setStory] = useState('');
  const [prompt, setPrompt] = useState('');

  const engine = ENGINES.find((e) => e.id === engineId) ?? ENGINES[0];
  const canCreate = submode === 'avatar' || prompt.trim().length > 0;
  const cost = active === 'image' ? 1 : active === 'music' ? 4 : 2;

  const create = () => {
    void hapticTap();
    if (active === 'music') return navigate('/music');
    if (submode === 'avatar') return navigate('/avatars');
    if (!canCreate) return;
    const extras = [genre, mood, look].filter(Boolean).join(' ').toLowerCase();
    const seed = story.trim() && !prompt.trim() ? story.trim() : prompt.trim();
    const full = extras ? `${seed}, ${extras}` : seed;
    const tab = active === 'image' ? 'image' : active === 'photo' ? 'photo' : 'create';
    navigate(`/studio?tab=${tab}&prompt=${enc(full)}`);
  };

  return (
    <div className="fixed inset-0 bg-[hsl(220_22%_4%)] text-foreground">
      <div
        className="flex h-full"
        style={{ paddingTop: 'var(--safe-top,0px)', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px))', boxSizing: 'border-box' }}
      >
        {/* ── RAIL ── */}
        <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 overflow-y-auto bg-gradient-to-r from-[hsl(220_30%_9%/0.5)] to-transparent py-3" style={{ scrollbarWidth: 'none' }}>
          {GROUPS.map((g, gi) => (
            <div key={g} className="flex w-full flex-col items-center gap-1">
              {gi > 0 && <span className="my-1.5 h-px w-7 bg-foreground/10" />}
              {MODULES.filter((m) => m.group === g).map((m) => {
                const on = m.id === active;
                return (
                  <button key={m.id} onClick={() => { void hapticTap(); setActive(m.id); }} title={m.label}
                    className={cn('group relative flex w-full flex-col items-center gap-1 px-1 py-2 transition-colors', on ? 'text-foreground' : 'text-muted-foreground')}>
                    {on && <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-accent" />}
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl transition-colors', on ? 'bg-accent/15' : 'group-hover:bg-foreground/5')}>
                      <m.icon className={cn('h-[18px] w-[18px]', on && 'text-accent')} strokeWidth={1.6} />
                    </span>
                    <span className="text-[9.5px] font-medium leading-none">{m.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── CANVAS ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {active === 'generate' || active === 'image' || active === 'photo' ? (
              <div className="mx-auto max-w-2xl">
                {active === 'generate' && (
                  <div className="inline-flex gap-1 rounded-full bg-foreground/5 p-1 ring-1 ring-inset ring-white/5">
                    {SUBMODES.map((s) => {
                      const on = s.id === submode;
                      return (
                        <button key={s.id} onClick={() => { void hapticTap(); setSubmode(s.id); }}
                          className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-light transition-colors', on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
                          <s.Icon className="h-[14px] w-[14px]" strokeWidth={1.6} /> {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(active !== 'generate' || submode !== 'avatar') && (
                  <div className="mt-5 rounded-2xl bg-foreground/[0.035] p-1 shadow-[0_18px_44px_-26px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/5 focus-within:ring-accent/40">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      placeholder={
                        active === 'image' ? 'A portrait of a desert wanderer at golden hour, 85mm…'
                          : active === 'photo' ? 'Describe the edit — relight, restyle, remove…'
                          : submode === 'animate' ? 'Describe how the image should move…'
                          : 'A lone astronaut watching twin suns set over a glass desert…'
                      }
                      className="w-full resize-none bg-transparent px-4 py-3 text-[16px] font-light leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
                      style={{ outline: 'none' }}
                    />
                  </div>
                )}

                {submode === 'avatar' && active === 'generate' && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-foreground/[0.035] p-4 ring-1 ring-inset ring-white/5">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#9c8bff] to-[#6b3bff]"><UserRound className="h-6 w-6" /></span>
                    <div className="text-[13px]"><div className="font-medium">Pick a presenter</div><div className="text-muted-foreground">Cast → choose an avatar identity</div></div>
                  </div>
                )}

                {/* Engine cards */}
                <div className="mb-2.5 mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5" strokeWidth={1.5} /> Render engine
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ENGINES.map((e) => {
                    const on = e.id === engineId;
                    return (
                      <button key={e.id} disabled={e.locked} onClick={() => { void hapticTap(); setEngineId(e.id); }}
                        className={cn('relative rounded-2xl p-3.5 text-left ring-1 ring-inset transition-all', on ? 'bg-accent/[0.08] ring-accent/50' : 'bg-foreground/[0.03] ring-white/5', e.locked && 'cursor-not-allowed opacity-40')}>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{e.provider}</div>
                        <div className="mt-1 flex items-center gap-1.5 font-display text-[15px] font-semibold">{e.name}{e.locked && <Lock className="h-3 w-3 text-muted-foreground" />}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Format */}
                <div className="mt-6 space-y-3 rounded-2xl bg-foreground/[0.03] p-4 ring-1 ring-inset ring-white/5">
                  <Row label="Aspect">
                    {ASPECTS.map((a, i) => {
                      const on = i === aspect;
                      return (
                        <Pill key={a.id} on={on} onClick={() => { void hapticTap(); setAspect(i); }}>
                          <a.Icon className="h-[14px] w-[14px]" strokeWidth={1.6} /> {a.id}
                        </Pill>
                      );
                    })}
                  </Row>
                  <Row label="Length">
                    <Clock className="mr-1 h-[14px] w-[14px] text-muted-foreground" strokeWidth={1.5} />
                    {DURATIONS.map((d) => (
                      <Pill key={d} on={d === duration} onClick={() => { void hapticTap(); setDuration(d); }}>{d}</Pill>
                    ))}
                  </Row>
                </div>

                {/* Advanced */}
                <button onClick={() => { void hapticTap(); setAdvanced((v) => !v); }}
                  className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-light text-muted-foreground">
                  Style & sound <ChevronDown className={cn('h-[14px] w-[14px] transition-transform', advanced && 'rotate-180')} strokeWidth={1.5} />
                </button>
                {advanced && (
                  <div className="mt-4 space-y-4">
                    <ChipField label="Genre" options={GENRES} value={genre} onPick={setGenre} />
                    <ChipField label="Mood" options={MOODS} value={mood} onPick={setMood} />
                  </div>
                )}
              </div>
            ) : (
              <ModuleScroll title={MODULES.find((m) => m.id === active)?.label ?? ''} subtitle={SUBTITLE[active] ?? ''}>
                {active === 'look' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {LOOKS.map((l) => (
                      <Pill key={l} block on={l === look} onClick={() => { void hapticTap(); setLook(l === look ? null : l); }}>{l}</Pill>
                    ))}
                  </div>
                )}
                {active === 'music' && (
                  <div className="space-y-4">
                    <ChipField label="Genre" options={GENRES} value={genre} onPick={setGenre} />
                    <ChipField label="Mood" options={MOODS} value={mood} onPick={setMood} />
                  </div>
                )}
                {active === 'story' && (
                  <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={9} placeholder="A washed-up pilot takes one last job across the dunes…"
                    className="w-full resize-none rounded-2xl bg-foreground/[0.035] p-4 text-[15px] font-light leading-relaxed text-foreground outline-none ring-1 ring-inset ring-white/5 placeholder:text-muted-foreground/50 focus:ring-accent/40" style={{ outline: 'none' }} />
                )}
                {['cast', 'voice', 'worlds', 'templates'].includes(active) && (
                  <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-2xl bg-foreground/[0.04] ring-1 ring-inset ring-white/5" />
                    ))}
                  </div>
                )}
              </ModuleScroll>
            )}
          </div>

          {/* ── Composition bar ── */}
          <div className="flex items-center justify-between gap-3 bg-gradient-to-t from-[hsl(220_22%_4%/0.85)] to-[hsl(220_22%_4%/0.4)] px-5 py-3.5 shadow-[0_-24px_48px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted-foreground">
              {active === 'generate' ? `${submode} · ${engine.name} · ${ASPECTS[aspect].id} · ${duration}` : MODULES.find((m) => m.id === active)?.label}
            </div>
            <div className="flex flex-none items-center gap-3">
              <span className="font-mono text-[11px] text-accent">◇{cost}</span>
              <button onClick={create} disabled={!canCreate && submode !== 'avatar' && active !== 'music'}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-foreground transition-opacity disabled:opacity-40">
                <Sparkles className="h-[15px] w-[15px]" /> Create <ArrowRight className="h-[15px] w-[15px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children, block }: { on?: boolean; onClick: () => void; children: React.ReactNode; block?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn('inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12px] font-light ring-1 ring-inset transition-colors',
        block && 'w-full',
        on ? 'bg-accent/15 text-foreground ring-accent/50' : 'bg-foreground/[0.04] text-muted-foreground ring-white/5')}>
      {children}
    </button>
  );
}

function ChipField({ label, options, value, onPick }: { label: string; options: string[]; value: string | null; onPick: (v: string | null) => void }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Pill key={o} on={o === value} onClick={() => { void hapticTap(); onPick(o === value ? null : o); }}>{o}</Pill>
        ))}
      </div>
    </div>
  );
}

function ModuleScroll({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-display text-[1.5rem] font-semibold">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
