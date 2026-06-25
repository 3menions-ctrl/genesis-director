/**
 * FeedVideo — a single clip in the vertical feed, shown at its OWN aspect ratio.
 *
 * The foreground video is `object-contain`, so a 16:9 film, a square clip or a
 * 9:16 vertical are all displayed uncropped and undistorted — never stretched
 * or cropped to fill the phone. The leftover area is filled by a soft, blurred
 * backdrop (the poster if we have one, otherwise a dark gradient) so non-tall
 * media still looks intentional rather than letterboxed onto flat black.
 *
 * Lean by design: a muted, inline, looping <video> that only plays while it's
 * the active card. HLS (.m3u8) plays natively on iOS/Safari and via hls.js
 * everywhere else.
 */
import { useEffect, useRef, useState } from 'react';

interface FeedVideoProps {
  src: string;
  poster?: string;
  active: boolean;
  muted: boolean;
}

function isHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export function FeedVideo({ src, poster, active, muted }: FeedVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  // Attach the source (with hls.js fallback for non-native HLS).
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let destroyed = false;
    let hls: { destroy: () => void } | null = null;

    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl');

    if (isHls(src) && !nativeHls) {
      // Lazy-load hls.js only when actually needed (keeps it off the iOS path).
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (Hls.isSupported()) {
            const inst = new Hls({ enableWorker: true, lowLatencyMode: false });
            inst.loadSource(src);
            inst.attachMedia(video);
            hls = inst;
          } else {
            video.src = src;
          }
        })
        .catch(() => {
          video.src = src;
        });
    } else {
      video.src = src;
    }

    return () => {
      destroyed = true;
      if (hls) hls.destroy();
    };
  }, [src]);

  // Play/pause follows the active card.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      video.pause();
      // Rewind off-screen clips so they restart fresh when scrolled back.
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [active]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0a0a0a]">
      {/* Soft backdrop fill behind aspect-correct media. */}
      {poster ? (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 30%, rgba(47,107,255,.18), transparent 60%), radial-gradient(120% 80% at 50% 90%, rgba(122,59,255,.16), transparent 60%)',
          }}
        />
      )}

      {/* The actual clip — shown at its native aspect ratio, never cropped. */}
      <video
        ref={ref}
        poster={poster}
        muted={muted}
        loop
        playsInline
        preload="auto"
        onCanPlay={() => setReady(true)}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity .35s ease' }}
      />
    </div>
  );
}
