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

        {/* Live badge — icon only */}
        <div className="absolute left-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/35 backdrop-blur-md" title="Live preview">
          <SlidersHorizontal className="h-4 w-4" />
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
            'absolute bottom-4 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full backdrop-blur-md transition-colors',
            showBefore ? 'bg-white text-black' : 'bg-black/40 text-white',
          )}
        >
          <Eye className="h-[18px] w-[18px]" />
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
                onClick={() => {
                  void hapticTap();
                  setSelected(l.id);
                }}
                className={cn(
                  'relative h-[152px] w-[110px] flex-none overflow-hidden rounded-[22px] transition-all duration-200',
                  on
                    ? 'scale-[1.05] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_18px_42px_-8px_rgba(47,107,255,.9)]'
                    : 'shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_12px_26px_-14px_rgba(0,0,0,.8)]',
                )}
              >
                <span className="absolute inset-0" style={{ background: l.grad }} />
                <span className="absolute inset-0 grid place-items-center text-[40px] drop-shadow-[0_4px_12px_rgba(0,0,0,.5)]">{l.emoji}</span>
                {l.premium && (
                  <span className="absolute left-2.5 top-2.5">
                    <Lock className="h-[15px] w-[15px] text-white/85" />
                  </span>
                )}
                {on && (
                  <span className="absolute bottom-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-full bg-[#2f6bff] shadow-[0_4px_12px_-2px_rgba(47,107,255,.9)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Apply — icon only */}
      <button
        onClick={apply}
        aria-label={look.premium ? `${look.name} is Pro` : `Apply ${look.name}`}
        title={look.premium ? `${look.name} is Pro` : `Apply ${look.name}`}
        className="absolute left-1/2 z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b from-white to-[#e9ecf5] text-black shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_20px_48px_-14px_rgba(255,255,255,.45)]"
        style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}
      >
        {look.premium ? <Lock className="h-[22px] w-[22px]" /> : <Check className="h-[24px] w-[24px]" strokeWidth={2.5} />}
      </button>
    </div>
  );
}
