/**
 * Create — the web app's CreationStudio (rail + canvas + composition bar),
 * tailored to this app: borderless & floating, the app's blue accent, the Aurora
 * canvas, and every control is a TRANSPARENT ICON WITH A TEXT LABEL (no text-only
 * buttons, no filled pills). Compact enough to fit one screen.
 *
 * Generate is the default module; other rail modules swap the canvas. Create
 * routes to the real Studio engine. Spend-only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wand2, Image as ImageIcon, Scissors, Users, Mic, Music as MusicIcon, Globe2,
  Palette, PenLine, LayoutGrid, Sparkles, Lock, Cpu, Clock, Clapperboard, Film,
  RectangleHorizontal, RectangleVertical, Square, UserRound, Sliders, Drama,
  Dices, Rocket, Leaf, Heart,
  type LucideIcon,
} from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;

interface Module { id: string; label: string; icon: LucideIcon; group: 'create' | 'assets' | 'finish'; }
const MODULES: Module[] = [
  { id: 'generate', label: 'Video', icon: Film, group: 'create' },
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
  { id: 'cinematic', label: 'Cinematic', Icon: Clapperboard },
  { id: 'animate', label: 'Animate', Icon: Wand2 },
  { id: 'avatar', label: 'Avatar', Icon: UserRound },
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
const next = <T,>(arr: readonly T[], cur: T | null) => arr[(arr.indexOf(cur as T) + 1) % arr.length];

// One-tap inspiration — themed example prompts to beat the blank page.
const THEMES = [
  { id: 'surprise', label: 'Surprise', Icon: Dices, prompt: '' },
  { id: 'scifi', label: 'Sci-fi', Icon: Rocket, prompt: 'A lone astronaut watching twin suns set over a glass desert' },
  { id: 'nature', label: 'Nature', Icon: Leaf, prompt: 'Morning mist over an ancient redwood forest, sun rays piercing the canopy' },
  { id: 'noir', label: 'Noir', Icon: Drama, prompt: 'A detective lights a cigarette under a flickering neon sign on rain-slicked streets' },
  { id: 'fantasy', label: 'Fantasy', Icon: Sparkles, prompt: 'A dragon circles a floating castle at golden hour, banners snapping in the wind' },
  { id: 'romance', label: 'Romance', Icon: Heart, prompt: 'Two figures share an umbrella on a Paris bridge as the rain turns to gold' },
];

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
        {/* ── RAIL (transparent icons + labels) ── */}
        <nav className="flex w-[68px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {GROUPS.map((g, gi) => (
            <div key={g} className="flex w-full flex-col items-center gap-0.5">
              {gi > 0 && <span className="my-1 h-px w-6 bg-white/10" />}
              {MODULES.filter((m) => m.group === g).map((m) => (
                <Tool key={m.id} icon={m.icon} label={m.label} on={m.id === active} onClick={() => { void hapticTap(); setActive(m.id); }} full />
              ))}
            </div>
          ))}
        </nav>

        {/* ── CANVAS ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden pr-4">
          <div className="flex-1 overflow-y-auto pb-3 pt-2">
            {isCreateModule ? (
              <div className="flex flex-col gap-5">
                {/* mode — transparent icon + label */}
                {active === 'generate' && (
                  <div className="flex gap-6">
                    {SUBMODES.map((s) => (
                      <Tool key={s.id} icon={s.Icon} label={s.label} on={s.id === submode} onClick={() => { void hapticTap(); setSubmode(s.id); }} />
                    ))}
                  </div>
                )}

                {/* prompt — floating lit-glass (input) */}
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

                {/* inspiration — one-tap themed ideas (beat the blank page) */}
                {!(active === 'generate' && submode === 'avatar') && (
                  <div className="-mr-4 flex gap-5 overflow-x-auto pr-4" style={{ scrollbarWidth: 'none' }}>
                    {THEMES.map((t) => (
                      <Tool key={t.id} icon={t.Icon} label={t.label} onClick={() => {
                        void hapticTap();
                        const pick = t.id === 'surprise' ? THEMES.filter((x) => x.prompt)[Math.floor((Date.now() / 7) % (THEMES.length - 1))] : t;
                        setPrompt(pick.prompt);
                      }} />
                    ))}
                  </div>
                )}

                {/* format — the common, quick choice, stays visible */}
                <Section label="Format">
                  <div className="flex flex-wrap items-center gap-5">
                    {ASPECTS.map((a, i) => (
                      <Tool key={a.id} icon={a.Icon} label={a.id} on={i === aspect} onClick={() => { void hapticTap(); setAspect(i); }} />
                    ))}
                    <span className="h-7 w-px bg-white/10" />
                    {DURATIONS.map((d) => (
                      <Tool key={d} icon={Clock} label={d} on={d === duration} onClick={() => { void hapticTap(); setDuration(d); }} />
                    ))}
                  </div>
                </Section>

                {/* settings — engine + style tucked away; comprehensive on demand */}
                <div>
                  <Tool icon={Sliders} label="Settings" on={advanced} onClick={() => { void hapticTap(); setAdvanced((v) => !v); }} />
                  {advanced && (
                    <div className="mt-5 flex flex-col gap-5">
                      <Section label="Render engine">
                        <div className="-mr-4 flex gap-5 overflow-x-auto pr-4" style={{ scrollbarWidth: 'none' }}>
                          {ENGINES.map((e) => (
                            <Tool key={e.id} icon={e.locked ? Lock : Cpu} label={e.name} on={e.id === engineId} disabled={e.locked} onClick={() => { void hapticTap(); setEngineId(e.id); }} />
                          ))}
                        </div>
                      </Section>
                      <Section label="Style &amp; mood">
                        <div className="flex gap-6">
                          <Tool icon={Drama} label={genre ?? 'Genre'} on={!!genre} onClick={() => { void hapticTap(); setGenre(next(GENRES, genre)); }} />
                          <Tool icon={Sparkles} label={mood ?? 'Mood'} on={!!mood} onClick={() => { void hapticTap(); setMood(next(MOODS, mood)); }} />
                          <Tool icon={Palette} label={look ?? 'Look'} on={!!look} onClick={() => { void hapticTap(); setLook(next(LOOKS, look)); }} />
                        </div>
                      </Section>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h2 className="text-[24px] font-light italic" style={{ fontFamily: 'Fraunces, serif' }}>{MODULES.find((m) => m.id === active)?.label}</h2>
                <p className="text-[13px] leading-relaxed text-white/45">{SUBTITLE[active]}</p>
                <div className="mt-6">
                  {active === 'look' && (
                    <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                      {LOOKS.map((l) => <Tool key={l} icon={Palette} label={l} on={l === look} onClick={() => { void hapticTap(); setLook(l === look ? null : l); }} />)}
                    </div>
                  )}
                  {active === 'music' && (
                    <div className="flex gap-6">
                      <Tool icon={Drama} label={genre ?? 'Genre'} on={!!genre} onClick={() => { void hapticTap(); setGenre(next(GENRES, genre)); }} />
                      <Tool icon={Sparkles} label={mood ?? 'Mood'} on={!!mood} onClick={() => { void hapticTap(); setMood(next(MOODS, mood)); }} />
                    </div>
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
          <div className="mb-1 flex items-center gap-3">
            <div className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-white/45">
              {isCreateModule ? `${active === 'generate' ? submode : active} · ${engine.name} · ${ASPECTS[aspect].id}` : MODULES.find((m) => m.id === active)?.label}
              <span className="ml-2 text-[#8fb4ff]">◇{cost}</span>
            </div>
            {/* Create — transparent icon + label in an outlined boundary */}
            <button onClick={create} disabled={!canCreate} aria-label="Create" title="Create"
              className="flex flex-none flex-col items-center gap-1 rounded-[16px] border border-[#8fb4ff]/45 bg-transparent px-4 py-1.5 text-[#8fb4ff] transition-opacity disabled:opacity-40">
              <Sparkles className="h-[22px] w-[22px]" strokeWidth={1.7} />
              <span className="text-[10px] font-semibold">Create</span>
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
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      {children}
    </div>
  );
}

function Tool({ icon: Icon, label, on, onClick, disabled, full }: { icon: LucideIcon; label: string; on?: boolean; onClick: () => void; disabled?: boolean; full?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={cn('flex flex-none flex-col items-center gap-1 py-1 transition-colors', full && 'w-full', on ? 'text-[#8fb4ff]' : 'text-white/50', disabled && 'opacity-35')}>
      <span className="relative grid h-7 place-items-center">
        {on && <span className="pointer-events-none absolute h-8 w-8 rounded-full bg-[#3f78ff]/25 blur-md" />}
        <Icon className="relative h-[21px] w-[21px]" strokeWidth={1.7} />
      </span>
      <span className="max-w-[64px] truncate text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
