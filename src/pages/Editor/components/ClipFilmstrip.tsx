/**
 * ClipFilmstrip — render real video frames inside a timeline clip block.
 *
 * Previous incarnation tried to extract frames via canvas drawImage,
 * which fails silently on every CORS-restricted source (W3 samplers,
 * Replicate delivery URLs, picsum, etc). Result: no frames ever
 * shown, regardless of zoom level.
 *
 * This version uses a fundamentally simpler approach: render N actual
 * <video> elements directly inside the clip block, each seeked to a
 * different timestamp via currentTime. Video PLAYBACK does NOT need
 * CORS (only canvas readback does), so the frames render reliably
 * regardless of host.
 *
 * Tradeoffs:
 *   - Each tile element is a real <video>. preload="metadata" so only
 *     headers + seek-target frames load — bytes are small.
 *   - Browsers cap concurrent video element loads, but ~8 per clip ×
 *     N clips in viewport is comfortably under typical limits.
 *   - The same video src across the clip's tiles means the browser
 *     reuses cached bytes — only one network fetch per clip, not N.
 *
 * Fallback chain:
 *   1. videoUrl set → render N video tiles seeked to evenly-spaced
 *      timestamps within the clip duration.
 *   2. No videoUrl but fallbackThumbnailUrl set → render N tiles of
 *      the static thumbnail with offset background position.
 *   3. Nothing → render N gradient tiles so the strip is still
 *      visible even on empty clips.
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  clipId: string;
  videoUrl: string | null;
  durationSec: number;
  widthPx: number;
  /** Optional thumbnail when the video URL is missing or fails. */
  fallbackThumbnailUrl: string | null;
}

function framesForWidth(widthPx: number): number {
  if (widthPx < 80) return 1;
  if (widthPx < 160) return 2;
  if (widthPx < 320) return 4;
  if (widthPx < 640) return 6;
  return 8;
}

/** Evenly spaced sample timestamps avoiding the very first frame
 *  (often black) and the very last (often a fade-out). */
function framesAtStamps(durationSec: number, count: number): number[] {
  if (count <= 1) {
    return [Math.min(0.5, durationSec * 0.5)];
  }
  const start = durationSec * 0.05;
  const end = durationSec * 0.95;
  const stride = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * stride);
}

export function ClipFilmstrip({
  clipId,
  videoUrl,
  durationSec,
  widthPx,
  fallbackThumbnailUrl,
}: Props) {
  const count = framesForWidth(widthPx);
  const stamps = framesAtStamps(durationSec, count);

  return (
    <div
      className="absolute inset-0 flex pointer-events-none"
      aria-hidden
    >
      {stamps.map((t, i) => (
        <FrameTile
          key={`${clipId}-${i}`}
          videoUrl={videoUrl}
          fallbackThumbnailUrl={fallbackThumbnailUrl}
          seekTo={t}
          isFirst={i === 0}
          tileIndex={i}
          tileCount={stamps.length}
        />
      ))}
    </div>
  );
}

/** One tile in the strip — a video element seeked to a specific
 *  timestamp. Falls back to thumbnail / gradient. */
function FrameTile({
  videoUrl,
  fallbackThumbnailUrl,
  seekTo,
  isFirst,
  tileIndex,
  tileCount,
}: {
  videoUrl: string | null;
  fallbackThumbnailUrl: string | null;
  seekTo: number;
  isFirst: boolean;
  tileIndex: number;
  tileCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      try {
        v.currentTime = seekTo;
      } catch {
        /* ignored */
      }
    };
    const onError = () => setVideoFailed(true);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("error", onError);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("error", onError);
    };
  }, [seekTo]);

  return (
    <div className="h-full flex-1 min-w-0 overflow-hidden relative">
      {videoUrl && !videoFailed ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          // Don't try to play — we just want the seek-to-stamp frame.
          autoPlay={false}
          controls={false}
        />
      ) : fallbackThumbnailUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${fallbackThumbnailUrl})`,
            backgroundSize: `${tileCount * 100}% 100%`,
            backgroundPosition: `${(tileIndex / Math.max(1, tileCount - 1)) * 100}% center`,
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : (
        // Final fallback: a vertical gradient so the strip still
        // reads as a tile rather than a void.
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(220 28% 10%) 0%, hsl(220 32% 7%) 100%)",
          }}
        />
      )}
      {!isFirst && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-px bg-black/30"
        />
      )}
    </div>
  );
}
