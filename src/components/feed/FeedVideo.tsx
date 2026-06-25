/**
 * FeedVideo — a single full-screen looping clip in the vertical feed.
 *
 * Lean by design (the feed can hold many of these): a muted, inline,
 * looping <video> that only plays while it's the active card. HLS (.m3u8)
 * is handled natively on iOS/Safari and via hls.js everywhere else.
 *
 * The parent drives `active`; we play/pause off that so off-screen clips
 * don't burn battery or fight for the decoder.
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
    <video
      ref={ref}
      poster={poster}
      muted={muted}
      loop
      playsInline
      preload="auto"
      onCanPlay={() => setReady(true)}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity .35s ease' }}
    />
  );
}
