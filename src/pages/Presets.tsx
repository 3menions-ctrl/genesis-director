/**
 * Presets — the mobile editor. The whole page is the playback player; the
 * editing tools are transparent icons on a right-hand rail.
 *
 * Toolkit:
 *   • Clip      — pick which clip to edit (your films + sample films).
 *   • Looks     — one-tap colour-grade presets (live preview).
 *   • Adjust    — brightness / contrast / saturation / warmth sliders.
 *   • Speed     — 0.25×–2× playback rate (live).
 *   • Music     — pick a soundtrack + set its mix level.
 *   • Text      — a caption overlay (top / middle / bottom).
 *   • Templates — preset bundles (a look + a track) applied in one tap.
 *   • Compare   — hold to see the original. Reset returns to it.
 *   • Save      — persists the edit to the project (editor_state + per-clip
 *     properties) so it survives + is applied on playback. Reopening a film
 *     restores its saved edit.
 *
 * Saving only applies to YOUR films (sample clips have no backing project).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Eye, RotateCcw, Save, Lock, ChevronLeft, X, Check, Clapperboard, Music2, Wand2, Play, SlidersHorizontal, Gauge, Type, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

interface Adjust { b: number; c: number; s: number; w: number }
const ADJUST0: Adjust = { b: 100, c: 100, s: 100, w: 0 };
interface TextOverlay { content: string; pos: 'top' | 'mid' | 'bottom' }
const TEXT0: TextOverlay = { content: '', pos: 'bottom' };
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

/** Compose the brightness/contrast/saturation/warmth sliders into a CSS filter. */
function adjustToFilter(a: Adjust): string {
  return [
    a.b !== 100 && `brightness(${(a.b / 100).toFixed(2)})`,
    a.c !== 100 && `contrast(${(a.c / 100).toFixed(2)})`,
    a.s !== 100 && `saturate(${(a.s / 100).toFixed(2)})`,
    a.w > 0 && `sepia(${(a.w / 100 * 0.7).toFixed(2)})`,
    a.w < 0 && `hue-rotate(${Math.round(a.w * 0.6)}deg)`,
  ].filter(Boolean).join(' ');
}

type Sheet = null | 'clips' | 'looks' | 'adjust' | 'speed' | 'music' | 'text' | 'templates';

export default function Presets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { films } = useMyFilms();
  const clips: Clip[] = useMemo(() => {
    const mine = films.filter((f) => f.video_url).map((f) => ({ id: f.id, title: f.title, src: f.video_url as string, thumb: f.thumbnail_url }));
    return [...mine, ...SAMPLES];
  }, [films]);

  const [clipId, setClipId] = useState<string | null>(null);
  const [selected, setSelected] = useState('film35');
  const [adjust, setAdjust] = useState<Adjust>(ADJUST0);
  const [speed, setSpeed] = useState(1);
  const [trackId, setTrackId] = useState('none');
  const [vol, setVol] = useState(60);
  const [text, setText] = useState<TextOverlay>(TEXT0);
  const [showBefore, setShowBefore] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const clip = clips.find((c) => c.id === clipId) ?? clips[0];
  const src = clip?.src ?? '';
  const isOwn = !!clip && !clip.id.startsWith('sample-');
  const look = useMemo(() => LOOKS.find((l) => l.id === selected) ?? LOOKS[0], [selected]);
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];
  const composed = useMemo(() => {
    const base = look.filter === 'none' ? '' : look.filter;
    return `${base} ${adjustToFilter(adjust)}`.trim() || 'none';
  }, [look, adjust]);
  const activeFilter = showBefore ? 'none' : composed;
  const adjustOn = adjust.b !== 100 || adjust.c !== 100 || adjust.s !== 100 || adjust.w !== 0;

  // Live playback rate.
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = showBefore ? 1 : speed; }, [speed, src, showBefore]);

  // Restore a saved edit when an own film is opened (proves the save round-trips).
  useEffect(() => {
    if (!clip || clip.id.startsWith('sample-')) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.from('movie_projects' as never).select('editor_state').eq('id', clip.id).maybeSingle();
      const m = (data as unknown as { editor_state?: { mobile?: { look?: string; adjust?: Adjust; speed?: number; music?: { trackId?: string; vol?: number }; text?: TextOverlay } } } | null)?.editor_state?.mobile;
      if (cancel || !m) return;
      if (m.look) setSelected(m.look);
      if (m.adjust) setAdjust(m.adjust);
      if (typeof m.speed === 'number') setSpeed(m.speed);
      if (m.music) { setTrackId(m.music.trackId ?? 'none'); setVol(m.music.vol ?? 60); }
      if (m.text) setText(m.text);
    })();
    return () => { cancel = true; };
  }, [clip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTemplate = (t: Template) => { void hapticTap(); setSelected(t.look); setTrackId(t.music); setSheet(null); toast.success(`Applied · ${t.name}`); };
  const resetAll = () => { void hapticTap(); setSelected('original'); setAdjust(ADJUST0); setSpeed(1); setTrackId('none'); setText(TEXT0); };

  const save = async () => {
    void hapticTap();
    if (look.premium || track.premium) { toast('That includes a Pro look or track — manage your plan on the web.'); return; }
    if (!user) { toast.error('Sign in to save'); navigate('/auth'); return; }
    if (!isOwn || !clip) { toast('Saving works on your own films — pick one under Clip.'); return; }
    setSaving(true);
    try {
      const mobile = { look: selected, filter: composed, adjust, speed, music: { trackId, vol }, text };
      const { error } = await supabase.from('movie_projects' as never)
        .update({ editor_state: { mobile } } as never).eq('id', clip.id);
      if (error) throw error;
      // Apply the grade + speed to the project's clips so playback reflects it
      // (same per-clip properties the web editor + stitcher read). Best-effort.
      try {
        const { data: vcs } = await supabase.from('video_clips' as never).select('id, properties').eq('project_id', clip.id);
        for (const vc of ((vcs ?? []) as unknown as { id: string; properties: Record<string, unknown> | null }[])) {
          const props = { ...(vc.properties ?? {}), filter: composed === 'none' ? '' : composed, speed };
          await supabase.from('video_clips' as never).update({ properties: props } as never).eq('id', vc.id);
        }
      } catch { /* per-clip apply is best-effort */ }
      toast.success('Edit saved');
    } catch { toast.error("Couldn't save — try again."); }
    finally { setSaving(false); }
  };

  const goBack = () => { void hapticTap(); if (window.history.length > 1) navigate(-1); else navigate('/feed'); };

  const textPosClass = text.pos === 'top' ? 'top-[14%]' : text.pos === 'mid' ? 'top-1/2 -translate-y-1/2' : 'bottom-[20%]';

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a] text-white">
      {/* ── Full-page playback player ── */}
      {src ? (
        <>
          <video key={`bg-${src}`} src={src} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
          <video ref={videoRef} key={`fg-${src}`} src={src} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-contain transition-[filter] duration-300" style={{ filter: activeFilter }} />
        </>
      ) : <div className="absolute inset-0 bg-gradient-to-br from-[#1a1430] to-[#0a0a0a]" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/55 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />

      {/* Text overlay */}
      {text.content && !showBefore && (
        <div className={cn('pointer-events-none absolute inset-x-0 z-10 px-8 text-center', textPosClass)}>
          <span className="font-display text-[26px] font-bold leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,.9)]">{text.content}</span>
        </div>
      )}

      {showBefore && <span className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 font-display text-[11px] font-semibold tracking-wide backdrop-blur-md">BEFORE</span>}

      {/* now-editing + music chips (bottom-left) */}
      <div className="absolute left-4 z-20 flex flex-col gap-1.5" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        {clip && <span className="inline-flex w-fit max-w-[58vw] items-center gap-1.5 truncate rounded-full bg-black/45 px-3 py-1 font-display text-[12px] font-semibold backdrop-blur-md"><Clapperboard className="h-3 w-3" /> {clip.title}</span>}
        {speed !== 1 && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[11.5px] font-medium backdrop-blur-md"><Gauge className="h-3 w-3" /> {speed}×</span>}
        {trackId !== 'none' && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#8fb4ff]/20 px-3 py-1 text-[11.5px] font-medium text-[#cdddff] backdrop-blur-md"><Music2 className="h-3 w-3" /> {track.name} · {vol}%</span>}
      </div>

      {/* ── Back ── */}
      <button onClick={goBack} aria-label="Back" className="absolute left-3 z-20 grid h-10 w-10 place-items-center text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}><ChevronLeft className="h-7 w-7" strokeWidth={2} /></button>

      {/* ── Right tool rail ── */}
      <div className="absolute right-3 z-20 flex flex-col items-center gap-[15px]" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 14px)' }}>
        <Tool icon={Clapperboard} label="Clip" onClick={() => { void hapticTap(); setSheet('clips'); }} />
        <Tool icon={LayoutGrid} label="Looks" active={selected !== 'original'} onClick={() => { void hapticTap(); setSheet('looks'); }} />
        <Tool icon={SlidersHorizontal} label="Adjust" active={adjustOn} onClick={() => { void hapticTap(); setSheet('adjust'); }} />
        <Tool icon={Gauge} label="Speed" active={speed !== 1} onClick={() => { void hapticTap(); setSheet('speed'); }} />
        <Tool icon={Music2} label="Music" active={trackId !== 'none'} onClick={() => { void hapticTap(); setSheet('music'); }} />
        <Tool icon={Type} label="Text" active={!!text.content} onClick={() => { void hapticTap(); setSheet('text'); }} />
        <Tool icon={Wand2} label="Looks+" onClick={() => { void hapticTap(); setSheet('templates'); }} />
        <button onMouseDown={() => setShowBefore(true)} onMouseUp={() => setShowBefore(false)} onMouseLeave={() => setShowBefore(false)} onTouchStart={() => setShowBefore(true)} onTouchEnd={() => setShowBefore(false)}
          aria-label="Hold to compare" className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors', showBefore ? 'text-[#8fb4ff]' : 'text-white')}>
          <Eye className="h-[23px] w-[23px]" strokeWidth={1.8} /><span className="font-display text-[10px] font-medium">Compare</span>
        </button>
        <Tool icon={RotateCcw} label="Reset" onClick={resetAll} />
        {/* Save — accent icon button */}
        <button onClick={save} disabled={saving} aria-label="Save" className="flex flex-col items-center gap-1 text-[#8fb4ff] transition-transform active:scale-95 disabled:opacity-60">
          <span className="surface-1 grid h-12 w-12 place-items-center rounded-2xl">{saving ? <Loader2 className="h-[22px] w-[22px] animate-spin" /> : (look.premium || track.premium) ? <Lock className="h-[22px] w-[22px]" /> : <Save className="h-[22px] w-[22px]" strokeWidth={1.9} />}</span>
          <span className="font-display text-[10px] font-semibold drop-shadow">{saving ? 'Saving' : (look.premium || track.premium) ? 'Pro' : 'Save'}</span>
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
                {!c.id.startsWith('sample-') && <span className="absolute left-2 top-2 rounded-full bg-[#3f78ff]/85 px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wide backdrop-blur-md">Yours</span>}
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

      {sheet === 'adjust' && (
        <SheetShell title="Adjust" onClose={() => setSheet(null)}>
          <div className="space-y-5 pb-1">
            <Slider label="Brightness" min={50} max={150} value={adjust.b} onChange={(v) => setAdjust((a) => ({ ...a, b: v }))} fmt={(v) => `${v}%`} />
            <Slider label="Contrast" min={50} max={150} value={adjust.c} onChange={(v) => setAdjust((a) => ({ ...a, c: v }))} fmt={(v) => `${v}%`} />
            <Slider label="Saturation" min={0} max={200} value={adjust.s} onChange={(v) => setAdjust((a) => ({ ...a, s: v }))} fmt={(v) => `${v}%`} />
            <Slider label="Warmth" min={-50} max={50} value={adjust.w} onChange={(v) => setAdjust((a) => ({ ...a, w: v }))} fmt={(v) => (v > 0 ? `+${v}` : `${v}`)} />
            <button onClick={() => { void hapticTap(); setAdjust(ADJUST0); }} className="mx-auto flex items-center gap-1.5 text-[12px] font-medium text-white/55"><RotateCcw className="h-3.5 w-3.5" />Reset adjustments</button>
          </div>
        </SheetShell>
      )}

      {sheet === 'speed' && (
        <SheetShell title="Speed" onClose={() => setSheet(null)}>
          <div className="flex gap-2.5">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => { void hapticTap(); setSpeed(s); }} className={cn('flex-1 rounded-[16px] py-3.5 text-center font-display text-[15px] font-bold transition-colors', s === speed ? 'msg-glass-accent' : 'msg-glass text-white/60')}>{s}×</button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-white/35">Plays back at this rate; the saved render matches.</p>
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
        </SheetShell>
      )}

      {sheet === 'text' && (
        <SheetShell title="Text" onClose={() => setSheet(null)}>
          <input value={text.content} onChange={(e) => setText((t) => ({ ...t, content: e.target.value.slice(0, 80) }))} placeholder="Add a caption…" className="surface-1 w-full rounded-[16px] bg-transparent px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-white/30" />
          <div className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Position</div>
          <div className="flex gap-2.5">
            {(['top', 'mid', 'bottom'] as const).map((p) => (
              <button key={p} onClick={() => { void hapticTap(); setText((t) => ({ ...t, pos: p })); }} className={cn('flex-1 rounded-[16px] py-3 text-center text-[13px] font-semibold capitalize transition-colors', p === text.pos ? 'msg-glass-accent' : 'msg-glass text-white/60')}>{p === 'mid' ? 'Middle' : p}</button>
            ))}
          </div>
          {text.content && <button onClick={() => { void hapticTap(); setText(TEXT0); }} className="mx-auto mt-4 flex items-center gap-1.5 text-[12px] font-medium text-white/55"><X className="h-3.5 w-3.5" />Remove text</button>}
        </SheetShell>
      )}

      {sheet === 'templates' && (
        <SheetShell title="Looks+ — one-tap bundles" onClose={() => setSheet(null)}>
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
      <Icon className="h-[23px] w-[23px]" strokeWidth={1.8} /><span className="font-display text-[10px] font-medium">{label}</span>
    </button>
  );
}

function Slider({ label, min, max, value, onChange, fmt }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><span className="text-[13.5px] font-medium text-white/85">{label}</span><span className="font-mono text-[12px] text-white/55">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#8fb4ff]" aria-label={label} />
    </div>
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
