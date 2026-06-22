/**
 * DirectorsReel — replaces 4 redundant landing sections with one
 * cinematic showcase. Eight real chapters, each pulled from a video
 * Small Bridges actually rendered. The viewer scrubs between chapters; the
 * active chapter plays muted by default with sound-on prompt.
 *
 * Sources are the same verified Supabase-hosted renders used by the
 * /launch gallery (see cinema/assets.ts → GALLERY). Each chapter is an
 * independent <video> swap: click a chapter → that clip becomes the hero
 * and starts playing. If a URL ever fails, the player shows a graceful
 * fallback and the viewer can tap another chapter.
 */

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { GALLERY } from '@/components/cinema/assets';

// Eight real renders across genres, drawn from the verified gallery set.
// Codes are short genre tags, not a claim that one scene was re-run in
// every mode — these are distinct films, each from its own prompt.
const CHAPTERS = [
  { code: 'TRV', label: 'Travel', detail: 'Sunset dreams on winding roads', src: GALLERY[0].src },
  { code: 'NAT', label: 'Nature', detail: 'Whispers of the enchanted jungle', src: GALLERY[1].src },
  { code: 'AER', label: 'Aerial', detail: 'Skyward over fiery majesty', src: GALLERY[2].src },
  { code: 'NOI', label: 'Noir', detail: 'Haunted whispers of the past', src: GALLERY[3].src },
  { code: 'WHM', label: 'Whimsy', detail: 'Whimsical chocolate adventures', src: GALLERY[4].src },
  { code: 'EPC', label: 'Epic', detail: 'Silent vigil in ruined valor', src: GALLERY[5].src },
  { code: 'WLD', label: 'Wildlife', detail: 'Shadows of the predator', src: GALLERY[6].src },
  { code: 'CHR', label: 'Character', detail: 'Hoppy in the sunlit park', src: GALLERY[8].src },
] as const;

export function DirectorsReel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [hasErrored, setHasErrored] = useState(false);

  const active = CHAPTERS[activeIdx];

  useEffect(() => {
    setHasErrored(false);
  }, [activeIdx]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setHasErrored(true);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
    };
  }, [activeIdx]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
  };

  return (
    <section className="relative z-10 py-32 lg:py-48 px-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Eyebrow */}
        <div className="text-center mb-10 lg:mb-14">
          <div className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">
            The Reel · 8 chapters · live
          </div>
          <h2
            className="font-display text-[36px] sm:text-[52px] lg:text-[64px] font-light text-white leading-[1.05] max-w-3xl mx-auto"
            style={{ fontVariant: 'small-caps' }}
          >
            One prompt. Every kind of shot.
          </h2>
          <p className="text-white/55 text-[14px] sm:text-[16px] max-w-xl mx-auto mt-5 leading-relaxed">
            Eight real renders, eight genres — each from a single prompt. Tap a chapter to swap the reel.
          </p>
        </div>

        {/* Reel player */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
          <div className="relative aspect-video bg-black">
            {!hasErrored ? (
              <video
                key={active.src}
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                src={active.src}
                autoPlay
                playsInline
                muted={muted}
                loop
                preload="metadata"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/55">
                <Play className="w-8 h-8 mb-3 text-white/55" />
                <p className="text-[13px]">This chapter is being uploaded.</p>
                <p className="text-[11px] text-white/35 mt-1">
                  Tap another chapter below to keep watching.
                </p>
              </div>
            )}

            {/* Top eyebrow overlay (active chapter) */}
            <div className="pointer-events-none absolute top-4 left-4 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.32em]">
              <span className="text-emerald-300">●</span>
              <span className="text-white/85">
                {active.code} · {active.label}
              </span>
            </div>

            {/* Center play button — paused & ready */}
            {!playing && !hasErrored && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center group focus-visible:outline-none"
                aria-label="Play the reel"
              >
                <span className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:bg-white/15 group-hover:scale-105 transition-all">
                  <Play className="w-10 h-10 text-white translate-x-[2px]" fill="currentColor" />
                </span>
              </button>
            )}

            {/* Bottom controls */}
            <div className="absolute bottom-0 inset-x-0 px-5 py-3 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? (
                    <Pause className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white translate-x-[1px]" />
                  )}
                </button>
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/65">
                  Chapter {String(activeIdx + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}
                </span>
              </div>
              <button
                onClick={toggleMute}
                className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.32em] text-white/55 hover:text-white/85 transition-colors"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {muted ? 'Sound on' : 'Mute'}
              </button>
            </div>
          </div>

          {/* Scrubber strip — clicking any chapter swaps the hero */}
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-px bg-glass-hover">
            {CHAPTERS.map((c, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={`${c.code}-${i}`}
                  onClick={() => setActiveIdx(i)}
                  className={[
                    'group relative text-left px-4 py-4 transition-colors focus-visible:outline-none',
                    isActive ? 'bg-brand/10' : 'bg-black/40 hover:bg-glass-hover',
                  ].join(' ')}
                  aria-label={`Swap to ${c.label}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={[
                        'font-mono text-[9px] uppercase tracking-[0.32em]',
                        isActive ? 'text-emerald-300' : 'text-white/35',
                      ].join(' ')}
                    >
                      {c.code}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-white/30">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div
                    className={[
                      'text-[12px] truncate',
                      isActive ? 'text-white' : 'text-white/65 group-hover:text-white/85',
                    ].join(' ')}
                  >
                    {c.label}
                  </div>
                  <div className="text-[10px] text-white/35 truncate mt-0.5">
                    {c.detail}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hairline support copy */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-[0.32em] text-white/30">
          <span>Original prompts</span>
          <span>·</span>
          <span>Real renders</span>
          <span>·</span>
          <span>No post-production</span>
        </div>
      </div>
    </section>
  );
}

export default DirectorsReel;
