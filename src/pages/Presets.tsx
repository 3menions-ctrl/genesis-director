/**
 * Presets — the mobile "editor". There is no timeline: editing is choosing a
 * look. A live before/after preview shows the selected preset applied to a clip
 * in real time (via CSS filters here; in production this maps to a re-render),
 * and a swipeable deck lets you tap between looks.
 *
 * The preview clip is shown at its native aspect ratio (object-contain) over a
 * blurred backdrop, per the media rule. In-app this would be the clip you just
 * created or picked; here it falls back to a sample film.
 */
import { useMemo, useState } from 'react';
import { Check, Lock, SlidersHorizontal, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { FILMS } from '@/data/filmsLibrary';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Look {
  id: string;
  name: string;
  emoji: string;
  /** CSS filter that approximates the look on the live preview. */
  filter: string;
  /** Card gradient. */
  grad: string;
  premium?: boolean;
}

const LOOKS: Look[] = [
  { id: 'original', name: 'Original', emoji: '🎥', filter: 'none', grad: 'linear-gradient(160deg,#222,#0a0a0a)' },
  { id: 'film35', name: '35mm Film', emoji: '🎞️', filter: 'sepia(.22) contrast(1.12) saturate(1.1) brightness(1.02)', grad: 'linear-gradient(160deg,#3a2a16,#0a0a0a)' },
  { id: 'anime', name: 'Anime', emoji: '🌸', filter: 'saturate(1.5) contrast(1.14) brightness(1.05)', grad: 'linear-gradient(160deg,#3a1640,#0a0a0a)' },
  { id: 'noir', name: 'Neo-Noir', emoji: '🌧️', filter: 'grayscale(1) contrast(1.32) brightness(.95)', grad: 'linear-gradient(160deg,#16263a,#0a0a0a)' },
  { id: 'golden', name: 'Golden Hour', emoji: '🌅', filter: 'sepia(.4) saturate(1.35) brightness(1.08) hue-rotate(-12deg)', grad: 'linear-gradient(160deg,#3a3416,#0a0a0a)' },
  { id: 'vapor', name: 'Vaporwave', emoji: '🌈', filter: 'hue-rotate(280deg) saturate(1.7) contrast(1.1)', grad: 'linear-gradient(160deg,#2a163a,#0a0a0a)', premium: true },
  { id: 'clay', name: 'Claymation', emoji: '🧱', filter: 'saturate(1.3) contrast(1.22) brightness(1.04)', grad: 'linear-gradient(160deg,#3a2616,#0a0a0a)', premium: true },
];

// Sample preview clip (in-app: the user's selected/just-created clip).
const SAMPLE_SRC = FILMS.find((f) => f.clips?.[0])?.clips[0] ?? '';

export default function Presets() {
  const [selected, setSelected] = useState<string>('film35');
  const [showBefore, setShowBefore] = useState(false);

  const look = useMemo(() => LOOKS.find((l) => l.id === selected) ?? LOOKS[0], [selected]);
  const activeFilter = showBefore ? 'none' : look.filter;

  const apply = () => {
    void hapticTap();
    if (look.premium) {
      toast('That look is part of Pro — manage your plan on the web.');
      return;
    }
    toast.success(`Applied ${look.name}`);
  };

  return (
    <div className="fixed inset-0 flex flex-col text-white">
      <AuroraBackdrop />
      {/* Preview */}
      <div className="relative z-10" style={{ height: '46%', marginTop: 'var(--safe-top, 0px)' }}>
        <div className="absolute inset-0 overflow-hidden bg-[#0a0a0a]">
          {/* blurred backdrop fill */}
          <video
            key={`bg-${SAMPLE_SRC}`}
            src={SAMPLE_SRC}
            muted
            loop
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
          />
          {/* aspect-correct foreground with the live look applied */}
          <video
            key={`fg-${SAMPLE_SRC}`}
            src={SAMPLE_SRC}
            muted
            loop
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-contain transition-[filter] duration-300"
            style={{ filter: activeFilter }}
          />
          {/* cinematic vignette for depth + legibility */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.28) 0%, transparent 20%, transparent 68%, rgba(0,0,0,.45) 100%)' }}
          />
        </div>

        {/* Live badge — borderless, transparent, with label */}
        <div className="absolute left-4 top-4 flex flex-col items-center gap-1 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]" title="Live preview">
          <SlidersHorizontal className="h-5 w-5" />
          <span className="font-display text-[10px] font-medium">Live</span>
        </div>

        {/* Before/After — hold the eye to compare */}
        <button
          onMouseDown={() => setShowBefore(true)}
          onMouseUp={() => setShowBefore(false)}
          onMouseLeave={() => setShowBefore(false)}
          onTouchStart={() => setShowBefore(true)}
          onTouchEnd={() => setShowBefore(false)}
          aria-label="Hold to see before"
          title="Hold to see before"
          className={cn(
            'absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.7)] transition-colors',
            showBefore ? 'text-[#8fb4ff]' : 'text-white',
          )}
        >
          <Eye className="h-[22px] w-[22px]" />
          <span className="font-display text-[10px] font-medium">Before</span>
        </button>
      </div>

      {/* Deck */}
      <div className="relative z-10 flex flex-1 flex-col px-1 pt-6">
        <div
          className="flex gap-3 overflow-x-auto px-4"
          style={{ scrollbarWidth: 'none', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 84px)' }}
        >
          {LOOKS.map((l) => {
            const on = l.id === selected;
            return (
              <button
                key={l.id}
                onClick={() => { void hapticTap(); setSelected(l.id); }}
                aria-label={l.name}
                title={l.name}
                className={cn('flex w-[64px] flex-none flex-col items-center gap-1.5 transition-all duration-200', on ? 'opacity-100' : 'opacity-45')}
              >
                <span className="relative grid h-9 w-9 place-items-center text-[28px] leading-none">
                  {l.emoji}
                  {l.premium && (
                    <span className="absolute -right-1.5 -top-1.5">
                      <Lock className="h-3 w-3 text-white/70" />
                    </span>
                  )}
                </span>
                <span className={cn('font-display text-[10px] font-medium leading-tight', on ? 'text-[#8fb4ff]' : 'text-white/55')}>
                  {l.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Apply — borderless transparent action with a small label */}
      <button
        onClick={apply}
        aria-label={look.premium ? `${look.name} is Pro` : `Apply ${look.name}`}
        title={look.premium ? `${look.name} is Pro` : `Apply ${look.name}`}
        className="absolute inset-x-0 z-10 mx-auto flex w-max flex-col items-center gap-1.5 text-[#7aa2ff]"
        style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 22px)' }}
      >
        {look.premium ? <Lock className="h-[26px] w-[26px]" /> : <Check className="h-[28px] w-[28px]" strokeWidth={2.2} />}
        <span className="font-display text-[11px] font-semibold tracking-[0.04em]">{look.premium ? 'Pro look' : 'Apply'}</span>
      </button>
    </div>
  );
}
