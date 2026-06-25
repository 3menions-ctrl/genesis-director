/**
 * Presets — the mobile editor. The whole page is the playback player; the
 * editing icons are transparent and live on a right-hand rail (matching Create).
 *
 * Flow: pick a Look (template of effects) from the popup → it applies live to
 * the clip (CSS filter here; a re-render in production) → Save writes the
 * result. Compare holds to show the original; Reset returns to it.
 *
 * The preview clip is shown at its native aspect ratio over a blurred fill.
 * In-app this is the clip you just created/picked; here it falls back to a
 * sample film.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Eye, RotateCcw, Save, Lock, ChevronLeft, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { FILMS } from '@/data/filmsLibrary';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Look {
  id: string;
  name: string;
  emoji: string;
  filter: string;
  premium?: boolean;
}

const LOOKS: Look[] = [
  { id: 'original', name: 'Original', emoji: '🎥', filter: 'none' },
  { id: 'film35', name: '35mm Film', emoji: '🎞️', filter: 'sepia(.22) contrast(1.12) saturate(1.1) brightness(1.02)' },
  { id: 'anime', name: 'Anime', emoji: '🌸', filter: 'saturate(1.5) contrast(1.14) brightness(1.05)' },
  { id: 'noir', name: 'Neo-Noir', emoji: '🌧️', filter: 'grayscale(1) contrast(1.32) brightness(.95)' },
  { id: 'golden', name: 'Golden Hour', emoji: '🌅', filter: 'sepia(.4) saturate(1.35) brightness(1.08) hue-rotate(-12deg)' },
  { id: 'vapor', name: 'Vaporwave', emoji: '🌈', filter: 'hue-rotate(280deg) saturate(1.7) contrast(1.1)', premium: true },
  { id: 'clay', name: 'Claymation', emoji: '🧱', filter: 'saturate(1.3) contrast(1.22) brightness(1.04)', premium: true },
];

const SAMPLE_SRC = FILMS.find((f) => f.clips?.[0])?.clips[0] ?? '';

export default function Presets() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('film35');
  const [showBefore, setShowBefore] = useState(false);
  const [looksOpen, setLooksOpen] = useState(false);

  const look = useMemo(() => LOOKS.find((l) => l.id === selected) ?? LOOKS[0], [selected]);
  const activeFilter = showBefore ? 'none' : look.filter;

  const save = () => {
    void hapticTap();
    if (look.premium) {
      toast('That look is part of Pro — manage your plan on the web.');
      return;
    }
    toast.success(`Saved · ${look.name}`);
  };

  const goBack = () => {
    void hapticTap();
    if (window.history.length > 1) navigate(-1);
    else navigate('/feed');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a] text-white">
      {/* ── Full-page playback player ── */}
      <video key={`bg-${SAMPLE_SRC}`} src={SAMPLE_SRC} muted loop autoPlay playsInline
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
      <video key={`fg-${SAMPLE_SRC}`} src={SAMPLE_SRC} muted loop autoPlay playsInline
        className="absolute inset-0 h-full w-full object-contain transition-[filter] duration-300"
        style={{ filter: activeFilter }} />
      {/* legibility scrims */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/55 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />

      {showBefore && (
        <span className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 font-display text-[11px] font-semibold tracking-wide backdrop-blur-md">
          BEFORE
        </span>
      )}

      {/* ── Back ── */}
      <button onClick={goBack} aria-label="Back" title="Back"
        className="absolute left-3 z-20 grid h-10 w-10 place-items-center text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]"
        style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}>
        <ChevronLeft className="h-7 w-7" strokeWidth={2} />
      </button>

      {/* ── Right tool rail (transparent) — anchored above the tab bar so the
            Save button never overlaps the bottom menu ── */}
      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-6"
        style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 18px)' }}
      >
        <button onClick={() => { void hapticTap(); setLooksOpen(true); }} aria-label="Looks" title="Looks"
          className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors', selected !== 'original' ? 'text-[#8fb4ff]' : 'text-white')}>
          <LayoutGrid className="h-[25px] w-[25px]" strokeWidth={1.8} />
          <span className="font-display text-[10px] font-medium">Looks</span>
        </button>

        <button
          onMouseDown={() => setShowBefore(true)}
          onMouseUp={() => setShowBefore(false)}
          onMouseLeave={() => setShowBefore(false)}
          onTouchStart={() => setShowBefore(true)}
          onTouchEnd={() => setShowBefore(false)}
          aria-label="Hold to compare" title="Hold to compare"
          className={cn('flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors', showBefore ? 'text-[#8fb4ff]' : 'text-white')}>
          <Eye className="h-[25px] w-[25px]" strokeWidth={1.8} />
          <span className="font-display text-[10px] font-medium">Compare</span>
        </button>

        <button onClick={() => { void hapticTap(); setSelected('original'); }} aria-label="Reset" title="Reset"
          className="flex flex-col items-center gap-1 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]">
          <RotateCcw className="h-[24px] w-[24px]" strokeWidth={1.8} />
          <span className="font-display text-[10px] font-medium">Reset</span>
        </button>

        {/* Save — transparent outlined boundary */}
        <button onClick={save}
          aria-label={look.premium ? `${look.name} is Pro` : `Save with ${look.name}`}
          title={look.premium ? `${look.name} is Pro` : `Save with ${look.name}`}
          className="flex flex-col items-center gap-1 rounded-[18px] border border-[#7aa2ff]/45 bg-transparent px-3.5 py-2 text-[#7aa2ff] drop-shadow-[0_2px_6px_rgba(0,0,0,.6)]">
          {look.premium ? <Lock className="h-[24px] w-[24px]" /> : <Save className="h-[24px] w-[24px]" strokeWidth={1.9} />}
          <span className="font-display text-[10px] font-semibold">{look.premium ? 'Pro' : 'Save'}</span>
        </button>
      </div>

      {/* ── Looks popup ── */}
      <div className={cn('absolute inset-0 z-40', looksOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div onClick={() => setLooksOpen(false)} className={cn('absolute inset-0 bg-black/55 transition-opacity duration-300', looksOpen ? 'opacity-100' : 'opacity-0')} />
        <div
          className={cn('absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[#101015]/95 px-6 pt-3 backdrop-blur-2xl transition-transform duration-300', looksOpen ? 'translate-y-0' : 'translate-y-full')}
          style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + 24px)' }}
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
          <button onClick={() => setLooksOpen(false)} aria-label="Close" className="absolute right-4 top-4 text-white/50"><X className="h-5 w-5" /></button>
          {/* Beautiful preset gallery — each card previews the clip in that look.
              Only mounted while open so the preview videos don't run otherwise. */}
          {looksOpen && (
            <div className="grid grid-cols-2 gap-3">
              {LOOKS.map((l) => {
                const on = l.id === selected;
                return (
                  <button key={l.id} onClick={() => { void hapticTap(); setSelected(l.id); }} aria-label={l.name} title={l.name}
                    className={cn('relative overflow-hidden rounded-[18px] align-top transition-all', on ? 'ring-2 ring-[#3f78ff]' : 'ring-1 ring-white/10')}>
                    {/* Preview takes the clip's own aspect ratio — never cropped. */}
                    <video src={SAMPLE_SRC} muted loop autoPlay playsInline
                      className="block w-full" style={{ filter: l.filter }} />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-2.5 py-2">
                      <span className="font-display text-[12.5px] font-semibold drop-shadow">{l.name}</span>
                      {l.premium && <Lock className="h-3 w-3 text-white/85" />}
                    </div>
                    {on && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#3f78ff] shadow-[0_3px_10px_-2px_rgba(47,107,255,.9)]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
