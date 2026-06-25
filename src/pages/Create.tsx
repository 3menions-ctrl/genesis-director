/**
 * Create — the web app's new CreationStudio (rail + canvas + composition bar),
 * tailored to THIS app: borderless, premium, floating tools on the Aurora
 * canvas (no rings/boxes — separation via spacing + soft glow), the app's blue
 * accent, and compact enough to fit on one screen.
 *
 * Generate is the default module; other rail modules swap the canvas. Create
 * routes to the real Studio engine. Spend-only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wand2, Image as ImageIcon, Scissors, Users, Mic, Music as MusicIcon, Globe2,
  Palette, PenLine, LayoutGrid, Sparkles, ArrowRight, ChevronDown, Lock,
  RectangleHorizontal, RectangleVertical, Square, UserRound,
  type LucideIcon,
} from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
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
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'animate', label: 'Animate' },
  { id: 'avatar', label: 'Avatar' },
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
const MOODS = ['Epic', 'Suspense', 'Emotional', 'Action', 'Mystery', 'Uplifting'];
const LOOKS = ['Kodak 2383', 'Teal & Orange', 'Bleach Bypass', 'Vintage 70s', 'Noir', 'Golden Hour', 'Cyberpunk', 'Pastel'];
const SUBTITLE: Record<string, string> = {
  cast: 'Pick a presenter — locks identity for Avatar mode.',
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
  const canCreate = active === 'music' || submode === 'avatar' || prompt.trim().length > 0;
  const cost = active === 'image' ? 1 : active === 'music' ? 4 : 2;

  const create = () => {
    if (!canCreate) return;
    void hapticTap();
    if (active === 'music') return navigate('/music');
    if (submode === 'avatar') return navigate('/avatars');
    const extras = [genre, mood, look].filter(Boolean).join(' ').toLowerCase();
    const seed = story.trim() && !prompt.trim() ? story.trim() : prompt.trim();
    const full = extras ? `${seed}, ${extras}` : seed;
    const tab = active === 'image' ? 'image' : active === 'photo' ? 'photo' : 'create';
    navigate(`/studio?tab=${tab}&prompt=${enc(full)}`);
  };

  const isCreateModule = active === 'generate' || active === 'image' || active === 'photo';

  return (
    <div className="fixed inset-0 text-white">
      <AuroraBackdrop />
      <div className="relative z-10 flex h-full" style={{ paddingTop: 'var(--safe-top,0px)', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px))', boxSizing: 'border-box' }}>
        {/* ── RAIL (borderless, floating) ── */}
        <nav className="flex w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {GROUPS.map((g, gi) => (
            <div key={g} className="flex w-full flex-col items-center gap-0.5">
              {gi > 0 && <span className="my-1 h-px w-6 bg-white/10" />}
              {MODULES.filter((m) => m.group === g).map((m) => {
                const on = m.id === active;
                return (
                  <button key={m.id} onClick={() => { void hapticTap(); setActive(m.id); }} title={m.label}
                    className={cn('flex w-full flex-col items-center gap-1 py-2 transition-colors', on ? 'text-[#8fb4ff]' : 'text-white/45')}>
                    <span className="relative grid place-items-center">
                      {on && <span className="pointer-events-none absolute h-8 w-8 rounded-full bg-[#3f78ff]/30 blur-md" />}
                      <m.icon className="relative h-[19px] w-[19px]" strokeWidth={1.7} />
                    </span>
                    <span className="text-[9px] font-medium leading-none">{m.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── CANVAS ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden pr-4">
          <div className="flex-1 overflow-y-auto pb-3 pt-2">
            {isCreateModule ? (
              <div className="flex flex-col gap-4">
                {/* mode toggle */}
                {active === 'generate' && (
                  <div className="surface-1 inline-flex w-max gap-1 rounded-full p-1">
                    {SUBMODES.map((s) => {
                      const on = s.id === submode;
                      return (
                        <button key={s.id} onClick={() => { void hapticTap(); setSubmode(s.id); }}
                          className={cn('rounded-full px-3.5 py-1.5 text-[12.5px] font-light transition-all', on ? 'bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]' : 'text-white/55')}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* prompt — floating lit-glass, no ring */}
                {!(active === 'generate' && submode === 'avatar') && (
                  <div className="surface-2 rounded-[22px] p-1 transition-shadow focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_24px_70px_-30px_rgba(60,90,255,.55)]">
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                      placeholder={active === 'image' ? 'A portrait at golden hour, 85mm…' : active === 'photo' ? 'Describe the edit — relight, restyle…' : submode === 'animate' ? 'Describe how the image should move…' : 'A lone astronaut watching twin suns set…'}
                      className="w-full resize-none bg-transparent px-4 py-3 text-[16px] font-light leading-relaxed text-white outline-none placeholder:text-white/25" style={{ outline: 'none' }} />
                  </div>
                )}

                {active === 'generate' && submode === 'avatar' && (
                  <button onClick={() => navigate('/avatars')} className="surface-1 flex items-center gap-3 rounded-[20px] p-3.5 text-left">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#9c8bff] to-[#6b3bff]"><UserRound className="h-5 w-5" /></span>
                    <div className="text-[13px]"><div className="font-medium">Pick a presenter</div><div className="text-white/45">Cast → choose an identity</div></div>
                  </button>
                )}

                {/* engine — compact floating chips */}
                <Section label="Render engine">
                  <div className="-mr-4 flex gap-2 overflow-x-auto pr-4" style={{ scrollbarWidth: 'none' }}>
                    {ENGINES.map((e) => (
                      <Chip key={e.id} on={e.id === engineId} disabled={e.locked} onClick={() => { void hapticTap(); setEngineId(e.id); }}>
                        {e.name}{e.locked && <Lock className="h-3 w-3 opacity-70" />}
                      </Chip>
                    ))}
                  </div>
                </Section>

                {/* format — compact floating pills */}
                <Section label="Format">
                  <div className="flex flex-wrap items-center gap-2">
                    {ASPECTS.map((a, i) => (
                      <Chip key={a.id} on={i === aspect} onClick={() => { void hapticTap(); setAspect(i); }}><a.Icon className="h-[14px] w-[14px]" strokeWidth={1.6} />{a.id}</Chip>
                    ))}
                    <span className="mx-1 h-5 w-px bg-white/10" />
                    {DURATIONS.map((d) => (
                      <Chip key={d} on={d === duration} onClick={() => { void hapticTap(); setDuration(d); }}>{d}</Chip>
                    ))}
                  </div>
                </Section>

                <div>
                  <button onClick={() => { void hapticTap(); setAdvanced((v) => !v); }} className="inline-flex items-center gap-1.5 text-[12px] font-light text-white/55">
                    Style &amp; sound <ChevronDown className={cn('h-[14px] w-[14px] transition-transform', advanced && 'rotate-180')} strokeWidth={1.5} />
                  </button>
                  {advanced && (
                    <div className="mt-3 flex flex-col gap-3">
                      <ChipField label="Genre" options={GENRES} value={genre} onPick={setGenre} />
                      <ChipField label="Mood" options={MOODS} value={mood} onPick={setMood} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h2 className="text-[24px] font-light italic" style={{ fontFamily: 'Fraunces, serif' }}>{MODULES.find((m) => m.id === active)?.label}</h2>
                <p className="text-[13px] leading-relaxed text-white/45">{SUBTITLE[active]}</p>
                <div className="mt-5">
                  {active === 'look' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {LOOKS.map((l) => <Chip key={l} block on={l === look} onClick={() => { void hapticTap(); setLook(l === look ? null : l); }}>{l}</Chip>)}
                    </div>
                  )}
                  {active === 'music' && (
                    <div className="flex flex-col gap-3"><ChipField label="Genre" options={GENRES} value={genre} onPick={setGenre} /><ChipField label="Mood" options={MOODS} value={mood} onPick={setMood} /></div>
                  )}
                  {active === 'story' && (
                    <div className="surface-2 rounded-[22px] p-1">
                      <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={7} placeholder="A washed-up pilot takes one last job across the dunes…"
                        className="w-full resize-none bg-transparent px-4 py-3 text-[15px] font-light leading-relaxed text-white outline-none placeholder:text-white/25" style={{ outline: 'none' }} />
                    </div>
                  )}
                  {['cast', 'voice', 'worlds', 'templates'].includes(active) && (
                    <div className="grid grid-cols-3 gap-2.5">
                      {Array.from({ length: 9 }).map((_, i) => <div key={i} className="surface-1 aspect-square rounded-2xl" />)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Composition bar (floating) ── */}
          <div className="surface-2 mb-1 flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5">
            <div className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-white/45">
              {isCreateModule ? `${active === 'generate' ? submode : active} · ${engine.name} · ${ASPECTS[aspect].id}` : MODULES.find((m) => m.id === active)?.label}
              <span className="ml-2 text-[#8fb4ff]">◇{cost}</span>
            </div>
            <button onClick={create} disabled={!canCreate}
              className="inline-flex flex-none items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_14px_32px_-12px_rgba(80,90,255,.7)] transition-opacity disabled:opacity-40">
              <Sparkles className="h-[15px] w-[15px]" /> Create <ArrowRight className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      {children}
    </div>
  );
}

function Chip({ on, disabled, onClick, children, block }: { on?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; block?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-full px-3.5 text-[12px] font-light transition-all',
        block && 'w-full',
        on ? 'bg-[#2f6bff]/25 text-[#cdddff] shadow-[0_8px_22px_-10px_rgba(80,110,255,.8)]' : 'surface-1 text-white/60',
        disabled && 'opacity-35')}
      style={on ? { textShadow: '0 0 12px rgba(120,160,255,.5)' } : undefined}>
      {children}
    </button>
  );
}

function ChipField({ label, options, value, onPick }: { label: string; options: string[]; value: string | null; onPick: (v: string | null) => void }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o} on={o === value} onClick={() => { void hapticTap(); onPick(o === value ? null : o); }}>{o}</Chip>)}
      </div>
    </div>
  );
}
