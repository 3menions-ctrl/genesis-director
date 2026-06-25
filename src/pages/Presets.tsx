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
import { useNavigate } from 'react-router-dom';
import { Check, Lock, Eye, ChevronLeft, RotateCcw } from 'lucide-react';
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
  const navigate = useNavigate();
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

  const goBack = () => {
    void hapticTap();
    if (window.history.length > 1) navigate(-1);
    else navigate('/feed');
  };

  return (
    <div className="fixed inset-0 flex flex-col text-white">
      <AuroraBackdrop />

      {/* Top bar — back */}
      <div
        className="relative z-20 flex items-center px-3"
        style={{ paddingTop: 'calc(var(--safe-top, 0px) + 10px)' }}
      >
        <button onClick={goBack} aria-label="Back" title="Back" className="grid h-10 w-10 place-items-center text-white/85">
          <ChevronLeft className="h-7 w-7" strokeWidth={2} />
        </button>
      </div>

      {/* Video player — center stage */}
      <div className="relative z-10 mx-4 mt-1 overflow-hidden rounded-[22px] bg-black shadow-[0_24px_60px_-24px_rgba(0,0,0,.9)]" style={{ height: '38vh' }}>
        <video
          key={`bg-${SAMPLE_SRC}`}
          src={SAMPLE_SRC}
          muted loop autoPlay playsInline
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
        />
        <video
          key={`fg-${SAMPLE_SRC}`}
          src={SAMPLE_SRC}
          muted loop autoPlay playsInline
          className="absolute inset-0 h-full w-full object-contain transition-[filter] duration-300"
          style={{ filter: activeFilter }}
        />
        {showBefore && (
          <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 font-display text-[10px] font-semibold tracking-wide backdrop-blur-md">
            BEFORE
          </span>
        )}
      </div>

      {/* Editing setting icons — below the player */}
      <div className="relative z-10 mt-4 flex justify-center gap-10">
        <button
          onMouseDown={() => setShowBefore(true)}
          onMouseUp={() => setShowBefore(false)}
          onMouseLeave={() => setShowBefore(false)}
          onTouchStart={() => setShowBefore(true)}
          onTouchEnd={() => setShowBefore(false)}
          aria-label="Hold to compare with original"
          title="Hold to compare"
          className={cn('flex flex-col items-center gap-1 transition-colors', showBefore ? 'text-[#8fb4ff]' : 'text-white/85')}
        >
          <Eye className="h-[24px] w-[24px]" />
          <span className="font-display text-[10px] font-medium">Compare</span>
        </button>
        <button
          onClick={() => { void hapticTap(); setSelected('original'); }}
          aria-label="Reset to original"
          title="Reset"
          className="flex flex-col items-center gap-1 text-white/85 transition-colors"
        >
          <RotateCcw className="h-[22px] w-[22px]" />
          <span className="font-display text-[10px] font-medium">Reset</span>
        </button>
      </div>

      {/* Looks gallery — the editing icons take center stage, below the video */}
      <div
        className="relative z-10 mt-6 flex-1 overflow-y-auto px-6"
        style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 92px)' }}
      >
        <div className="grid grid-cols-4 gap-x-3 gap-y-6">
          {LOOKS.map((l) => {
            const on = l.id === selected;
            return (
              <button
                key={l.id}
                onClick={() => { void hapticTap(); setSelected(l.id); }}
                aria-label={l.name}
                title={l.name}
                className={cn('flex flex-col items-center gap-2 transition-all duration-200', on ? 'opacity-100' : 'opacity-50')}
              >
                <span className="relative grid h-11 w-11 place-items-center text-[34px] leading-none">
                  {l.emoji}
                  {l.premium && (
                    <span className="absolute -right-1 -top-1">
                      <Lock className="h-3 w-3 text-white/70" />
                    </span>
                  )}
                </span>
                <span className={cn('font-display text-[10px] font-medium leading-tight text-center', on ? 'text-[#8fb4ff]' : 'text-white/55')}>
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
