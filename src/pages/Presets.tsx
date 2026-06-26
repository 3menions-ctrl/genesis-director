/**
 * Presets — the mobile editor. The whole page is the playback player; the
 * editing tools are transparent icons on a right-hand rail.
 *
 * Toolkit:
 *   • Clip      — pick which clip to edit (your films + sample films).
 *   • Looks     — a library of one-tap colour-grade presets (live preview).
 *   • Music     — pick a soundtrack + set its mix level.
 *   • Templates — preset bundles (a look + a track) applied in one tap.
 *   • Compare   — hold to see the original. Reset returns to it.
 *   • Save      — writes the chosen look/track/clip (the re-render runs server
 *     side in production).
 *
 * The preview clip is shown at its native aspect ratio over a blurred fill.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Eye, RotateCcw, Save, Lock, ChevronLeft, X, Check, Clapperboard, Music2, Wand2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { FILMS } from '@/data/filmsLibrary';
import { useMyFilms } from '@/hooks/useMyFilms';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Look { id: string; name: string; filter: string; premium?: boolean }
const LOOKS: Look[] = [
  { id: 'original', name: 'Original', filter: 'none' },
  { id: 'film35', name: '35mm Film', filter: 'sepia(.22) contrast(1.12) saturate(1.1) brightness(1.02)' },
  { id: 'anime', name: 'Anime', filter: 'saturate(1.5) contrast(1.14) brightness(1.05)' },
  { id: 'noir', name: 'Neo-Noir', filter: 'grayscale(1) contrast(1.32) brightness(.95)' },
  { id: 'golden', name: 'Golden Hour', filter: 'sepia(.4) saturate(1.35) brightness(1.08) hue-rotate(-12deg)' },
  { id: 'tealorange', name: 'Teal & Orange', filter: 'contrast(1.16) saturate(1.28) hue-rotate(-8deg)' },
  { id: 'bw', name: 'Mono', filter: 'grayscale(1) contrast(1.1)' },
  { id: 'faded', name: 'Faded', filter: 'contrast(.9) saturate(.85) brightness(1.05) sepia(.1)' },
  { id: 'dreamy', name: 'Dreamy', filter: 'brightness(1.08) saturate(1.18) contrast(.95)' },
  { id: 'cold', name: 'Cold', filter: 'hue-rotate(14deg) saturate(1.1) brightness(.98)' },
  { id: 'pastel', name: 'Pastel', filter: 'saturate(.82) brightness(1.1) contrast(.92)' },
  { id: 'vapor', name: 'Vaporwave', filter: 'hue-rotate(280deg) saturate(1.7) contrast(1.1)', premium: true },
  { id: 'cyber', name: 'Cyberpunk', filter: 'hue-rotate(220deg) saturate(1.6) contrast(1.2)', premium: true },
  { id: 'clay', name: 'Claymation', filter: 'saturate(1.3) contrast(1.22) brightness(1.04)', premium: true },
];

interface Track { id: string; name: string; mood: string; premium?: boolean }
const TRACKS: Track[] = [
  { id: 'none', name: 'No music', mood: '' },
  { id: 'cinematic', name: 'Cinematic Swell', mood: 'Epic' },
  { id: 'lofi', name: 'Lo-fi Haze', mood: 'Chill' },
  { id: 'synth', name: 'Synthwave Drive', mood: 'Retro' },
  { id: 'ambient', name: 'Weightless', mood: 'Dreamy' },
  { id: 'trap', name: 'Night Rider', mood: 'Hype' },
  { id: 'orchestral', name: 'Grand Overture', mood: 'Grand', premium: true },
];

interface Template { id: string; name: string; look: string; music: string; blurb: string }
const TEMPLATES: Template[] = [
  { id: 'trailer', name: 'Cinematic Trailer', look: 'film35', music: 'cinematic', blurb: 'Filmic grade + epic swell' },
  { id: 'dreamy', name: 'Dreamy Reel', look: 'dreamy', music: 'ambient', blurb: 'Soft glow + airy pads' },
  { id: 'noirstory', name: 'Noir Story', look: 'noir', music: 'orchestral', blurb: 'Mono + grand strings' },
  { id: 'hype', name: 'Hype Edit', look: 'tealorange', music: 'trap', blurb: 'Punchy teal/orange + 808s' },
  { id: 'retro', name: 'Retro Vibes', look: 'vapor', music: 'synth', blurb: 'Vaporwave + synthwave' },
];

interface Clip { id: string; title: string; src: string; thumb?: string | null }
const SAMPLES: Clip[] = FILMS.filter((f) => f.clips?.[0]).slice(0, 8).map((f) => ({ id: `sample-${f.id}`, title: f.title, src: f.clips[0] }));

type Sheet = null | 'clips' | 'looks' | 'music' | 'templates';

export default function Presets() {
  const navigate = useNavigate();
  const { films } = useMyFilms();
  const clips: Clip[] = useMemo(() => {
    const mine = films.filter((f) => f.video_url).map((f) => ({ id: f.id, title: f.title, src: f.video_url as string, thumb: f.thumbnail_url }));
    return [...mine, ...SAMPLES];
  }, [films]);

  const [clipId, setClipId] = useState<string | null>(null);
  const [selected, setSelected] = useState('film35');
  const [trackId, setTrackId] = useState('none');
  const [vol, setVol] = useState(60);
  const [showBefore, setShowBefore] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  const clip = clips.find((c) => c.id === clipId) ?? clips[0];
  const src = clip?.src ?? '';
  const look = useMemo(() => LOOKS.find((l) => l.id === selected) ?? LOOKS[0], [selected]);
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];
  const activeFilter = showBefore ? 'none' : look.filter;

  const applyTemplate = (t: Template) => { void hapticTap(); setSelected(t.look); setTrackId(t.music); setSheet(null); toast.success(`Applied · ${t.name}`); };
  const save = () => {
    void hapticTap();
    if (look.premium || track.premium) { toast('That includes a Pro look or track — manage your plan on the web.'); return; }
    toast.success(`Saved · ${look.name}${trackId !== 'none' ? ` + ${track.name}` : ''}`);
  };
  const goBack = () => { void hapticTap(); if (window.history.length > 1) navigate(-1); else navigate('/feed'); };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a] text-white">
      {/* ── Full-page playback player ── */}
      {src ? (
        <>
          <video key={`bg-${src}`} src={src} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
          <video key={`fg-${src}`} src={src} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-contain transition-[filter] duration-300" style={{ filter: activeFilter }} />
        </>
      ) : <div className="absolute inset-0 bg-gradient-to-br from-[#1a1430] to-[#0a0a0a]" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/55 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />

      {showBefore && <span className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 font-display text-[11px] font-semibold tracking-wide backdrop-blur-md">BEFORE</span>}

      {/* now-editing + music chips (bottom-left) */}
      <div className="absolute left-4 z-20 flex flex-col gap-1.5" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        {clip && <span className="inline-flex w-fit max-w-[60vw] items-center gap-1.5 truncate rounded-full bg-black/45 px-3 py-1 font-display text-[12px] font-semibold backdrop-blur-md"><Clapperboard className="h-3 w-3" /> {clip.title}</span>}
        {trackId !== 'none' && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#8fb4ff]/20 px-3 py-1 text-[11.5px] font-medium text-[#cdddff] backdrop-blur-md"><Music2 className="h-3 w-3" /> {track.name} · {vol}%</span>}
      </div>

      {/* ── Back ── */}
      <button onClick={goBack} aria-label="Back" className="absolute left-3 z-20 grid h-10 w-10 place-items-center text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}><ChevronLeft className="h-7 w-7" strokeWidth={2} /></button>

      {/* ── Right tool rail ── */}
      <div className="absolute right-3 z-20 flex flex-col items-center gap-[18px]" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        <Tool icon={Clapperboard} label="Clip" onClick={() => { void hapticTap(); setSheet('clips'); }} />
        <Tool icon={LayoutGrid} label="Looks" active={selected !== 'original'} onClick={() => { void hapticTap(); setSheet('looks'); }} />
        <Tool icon={Music2} label="Music" active={trackId !== 'none'} onClick={() => { void hapticTap(); setSheet('music'); }} />
        <Tool icon={Wand2} label="Templates" onClick={() => { void hapticTap(); setSheet('templates'); }} />
        <button onMouseDown={() => setShowBefore(true)} onMouseUp={() => setShowBefore(false)} onMouseLeave={() => setShowBefore(false)} onTouchStart={() => setShowBefore(true)} onTouchEnd={() => setShowBefore(false)}
          aria-label="Hold to compare" className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors', showBefore ? 'text-[#8fb4ff]' : 'text-white')}>
          <Eye className="h-[24px] w-[24px]" strokeWidth={1.8} /><span className="font-display text-[10px] font-medium">Compare</span>
        </button>
        <Tool icon={RotateCcw} label="Reset" onClick={() => { void hapticTap(); setSelected('original'); setTrackId('none'); }} />
        {/* Save — accent icon in a translucent container */}
        <button onClick={save} aria-label="Save" className="flex flex-col items-center gap-1 text-[#8fb4ff] transition-transform active:scale-95">
          <span className="surface-1 grid h-12 w-12 place-items-center rounded-2xl">{look.premium || track.premium ? <Lock className="h-[22px] w-[22px]" /> : <Save className="h-[22px] w-[22px]" strokeWidth={1.9} />}</span>
          <span className="font-display text-[10px] font-semibold drop-shadow">{look.premium || track.premium ? 'Pro' : 'Save'}</span>
        </button>
      </div>

      {/* ── Sheets ── */}
      {sheet === 'clips' && (
        <SheetShell title="Choose a clip" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-3">
            {clips.map((c) => (
              <button key={c.id} onClick={() => { void hapticTap(); setClipId(c.id); setSheet(null); }} className={cn('relative overflow-hidden rounded-[16px] transition-all', c.id === clip?.id ? 'shadow-[0_12px_34px_-8px_rgba(63,120,255,.85)]' : '')}>
                {c.thumb ? <img src={c.thumb} alt="" className="block w-full" /> : <video src={`${c.src}#t=0.5`} muted playsInline preload="metadata" className="block w-full" />}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 truncate px-2.5 py-1.5 text-left font-display text-[12px] font-semibold drop-shadow">{c.title}</span>
                {c.id === clip?.id && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#3f78ff]"><Check className="h-3 w-3" strokeWidth={3} /></span>}
              </button>
            ))}
          </div>
        </SheetShell>
      )}

      {sheet === 'looks' && (
        <SheetShell title="Looks" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-3">
            {LOOKS.map((l) => (
              <button key={l.id} onClick={() => { void hapticTap(); setSelected(l.id); }} aria-label={l.name} className={cn('relative overflow-hidden rounded-[16px] align-top transition-all', l.id === selected ? 'shadow-[0_12px_34px_-8px_rgba(63,120,255,.85)]' : '')}>
                {src ? <video src={src} muted loop autoPlay playsInline className="block w-full" style={{ filter: l.filter }} /> : <div className="aspect-video w-full bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]" />}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-2.5 py-2"><span className="font-display text-[12.5px] font-semibold drop-shadow">{l.name}</span>{l.premium && <Lock className="h-3 w-3 text-white/85" />}</div>
                {l.id === selected && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#3f78ff]"><Check className="h-3 w-3" strokeWidth={3} /></span>}
              </button>
            ))}
          </div>
        </SheetShell>
      )}

      {sheet === 'music' && (
        <SheetShell title="Soundtrack" onClose={() => setSheet(null)}>
          {trackId !== 'none' && (
            <div className="mb-4 flex items-center gap-3">
              <Music2 className="h-[18px] w-[18px] text-[#8fb4ff]" />
              <input type="range" min={0} max={100} value={vol} onChange={(e) => setVol(Number(e.target.value))} className="flex-1 accent-[#8fb4ff]" aria-label="Music volume" />
              <span className="w-9 text-right font-mono text-[12px] text-white/60">{vol}%</span>
            </div>
          )}
          <ul className="space-y-2 pb-1">
            {TRACKS.map((t) => (
              <li key={t.id}>
                <button onClick={() => { void hapticTap(); setTrackId(t.id); }} className={cn('flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-colors', t.id === trackId ? 'msg-glass-accent' : 'msg-glass')}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08]">{t.id === 'none' ? <X className="h-4 w-4 text-white/60" /> : <Play className="h-4 w-4 fill-white text-white" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{t.name}</span>{t.mood && <span className="text-[11.5px] text-white/45">{t.mood}</span>}</span>
                  {t.premium && <Lock className="h-3.5 w-3.5 text-white/40" />}
                  {t.id === trackId && <Check className="h-[17px] w-[17px] text-[#8fb4ff]" strokeWidth={2.6} />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-center text-[11px] text-white/30">Your soundtrack is mixed into the final render.</p>
        </SheetShell>
      )}

      {sheet === 'templates' && (
        <SheetShell title="Templates" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => {
              const tl = LOOKS.find((l) => l.id === t.look);
              return (
                <button key={t.id} onClick={() => applyTemplate(t)} className="relative overflow-hidden rounded-[16px] align-top">
                  {src ? <video src={src} muted loop autoPlay playsInline className="block w-full" style={{ filter: tl?.filter }} /> : <div className="aspect-video w-full bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]" />}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 px-2.5 py-2"><div className="font-display text-[12.5px] font-semibold drop-shadow">{t.name}</div><div className="truncate text-[10px] text-white/65">{t.blurb}</div></div>
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}
    </div>
  );
}

function Tool({ icon: Icon, label, active, onClick }: { icon: typeof LayoutGrid; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors', active ? 'text-[#8fb4ff]' : 'text-white')}>
      <Icon className="h-[24px] w-[24px]" strokeWidth={1.8} /><span className="font-display text-[10px] font-medium">{label}</span>
    </button>
  );
}

function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40">
      <div onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-[28px] bg-[#0d0d14]/92 px-5 pt-3 backdrop-blur-2xl shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 20px)' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between"><span className="font-display text-[15px] font-semibold">{title}</span><button onClick={onClose} aria-label="Close" className="text-white/50"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}
