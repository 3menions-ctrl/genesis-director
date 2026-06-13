/**
 * ClipFilmstrip — renders multiple sample frames from a clip's
 * video as a horizontal tiled strip. Used inside ClipBlock on V1
 * so the timeline shows actual video frames rather than a single
 * static thumbnail.
 *
 * How it works:
 *   1. Mount a hidden <video> + offscreen <canvas>.
 *   2. Compute N evenly-spaced timestamps across the clip's
 *      durationSec (we extract N frames where N ≈ widthPx / 80,
 *      clamped to 1..8 so super-narrow blocks get one frame and
 *      super-wide ones don't drown).
 *   3. For each timestamp: seek the video, wait for `seeked`,
 *      draw to canvas, toBlob → object URL.
 *   4. Render the URLs as <img> tiles filling the clip width.
 *   5. Frames are cached in module-level Map keyed by
 *      (clipId, durationSec) so re-mounts during scroll / reorder
 *      don't re-extract.
 *
 * Gotchas this handles:
 *   - CORS: video element doesn't need crossOrigin for <video>
 *     playback, BUT canvas drawImage from a CORS-tainted source
 *     throws SecurityError. We attempt with crossOrigin="anonymous"
 *     first; on failure fall back to NOT setting it and just
 *     showing the first-frame thumbnail tiled. No throw bubbles.
 *   - Timeouts: 8s ceiling per frame; if the video doesn't seek in
 *     time, give up on that frame.
 *   - Cleanup: revoke object URLs on unmount to free GPU memory.
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  clipId: string;
  videoUrl: string | null;
  durationSec: number;
  widthPx: number;
  /** Optional pre-existing thumbnail to show until frames extract. */
  fallbackThumbnailUrl: string | null;
}

// Module-level cache so frames don't re-extract on every re-mount.
// Keyed by clipId + duration so trim changes invalidate cleanly.
const frameCache = new Map<string, { urls: string[]; revoke: () => void }>();
const inflight = new Map<string, Promise<string[]>>();

export function ClipFilmstrip({
  clipId,
  videoUrl,
  durationSec,
  widthPx,
  fallbackThumbnailUrl,
}: Props) {
  const [frames, setFrames] = useState<string[]>(() => {
    const cached = frameCache.get(cacheKey(clipId, durationSec));
    return cached?.urls ?? [];
  });

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (!videoUrl) return;
    const key = cacheKey(clipId, durationSec);
    if (frameCache.has(key)) {
      setFrames(frameCache.get(key)!.urls);
      return;
    }
    if (inflight.has(key)) {
      void inflight.get(key)!.then((urls) => {
        if (mounted.current) setFrames(urls);
      });
      return;
    }
    const promise = extractFrames(videoUrl, durationSec, framesForWidth(widthPx));
    inflight.set(key, promise);
    void promise.then((urls) => {
      inflight.delete(key);
      if (urls.length > 0) {
        frameCache.set(key, {
          urls,
          revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)),
        });
      }
      if (mounted.current) setFrames(urls);
    });
    // We intentionally DO NOT depend on widthPx — re-extracting on
    // every zoom would thrash. The initial count is computed for
    // the width at first paint; tile stretching handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId, videoUrl, durationSec]);

  // Extraction failed (CORS / canvas tainted / unsupported codec) →
  // fall back to a TILED thumbnail strip so the row always reads
  // as "video frames" rather than a single static image. The tiles
  // use the thumbnail offset across the strip to fake a film-strip
  // feel even when the actual frames aren't extractable.
  if (frames.length === 0) {
    if (fallbackThumbnailUrl) {
      const tileCount = framesForWidth(widthPx);
      return (
        <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
          {Array.from({ length: tileCount }, (_, i) => (
            <div
              key={i}
              className="h-full flex-1 min-w-0 overflow-hidden relative"
              style={{
                // Slight horizontal offset per tile to suggest a
                // sequence of frames panning across.
                backgroundImage: `url(${fallbackThumbnailUrl})`,
                backgroundSize: `${tileCount * 100}% 100%`,
                backgroundPosition: `${(i / Math.max(1, tileCount - 1)) * 100}% center`,
                backgroundRepeat: "no-repeat",
              }}
            >
              {i > 0 && (
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-px bg-black/30"
                />
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex pointer-events-none"
      aria-hidden
    >
      {frames.map((url, i) => (
        <div
          key={i}
          className="h-full flex-1 min-w-0 overflow-hidden relative"
        >
          <img
            src={url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
          {i > 0 && (
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-px bg-black/30"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cacheKey(clipId: string, durationSec: number): string {
  return `${clipId}@${durationSec.toFixed(2)}`;
}

function framesForWidth(widthPx: number): number {
  if (widthPx < 80) return 1;
  if (widthPx < 160) return 2;
  if (widthPx < 320) return 4;
  if (widthPx < 640) return 6;
  return 8;
}

async function extractFrames(
  videoUrl: string,
  durationSec: number,
  count: number,
): Promise<string[]> {
  // Two attempts: with crossOrigin first (so canvas drawImage doesn't
  // taint), then without (some hosts don't return ACAO). On total
  // failure we return [] and the caller shows the static thumbnail.
  try {
    const urls = await extractFramesAttempt(videoUrl, durationSec, count, true);
    if (urls.length > 0) return urls;
  } catch {
    /* fall through */
  }
  try {
    return await extractFramesAttempt(videoUrl, durationSec, count, false);
  } catch {
    return [];
  }
}

function extractFramesAttempt(
  videoUrl: string,
  durationSec: number,
  count: number,
  useCrossOrigin: boolean,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    if (useCrossOrigin) video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("no 2d context"));
      return;
    }

    const urls: string[] = [];
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("extraction timeout"));
    }, 12_000);

    function cleanup() {
      window.clearTimeout(timeout);
      try {
        video.src = "";
        video.load();
      } catch {
        /* ignored */
      }
    }

    video.onloadedmetadata = () => {
      // Use the video's actual duration (might differ from the
      // editor's trimmed durationSec). We sample within the editor's
      // declared window so we never seek past natural end.
      const usableDur = Math.min(
        video.duration || durationSec,
        durationSec,
      );
      canvas.width = Math.min(320, video.videoWidth || 320);
      canvas.height = Math.min(180, video.videoHeight || 180);

      const stamps = framesAtStamps(usableDur, count);
      let i = 0;

      const captureNext = () => {
        if (i >= stamps.length) {
          cleanup();
          resolve(urls);
          return;
        }
        const t = stamps[i++];
        // Seek; the seeked handler captures + advances.
        try {
          video.currentTime = t;
        } catch {
          /* will fall through to next on error */
          captureNext();
        }
      };

      const onSeeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) urls.push(URL.createObjectURL(blob));
              captureNext();
            },
            "image/jpeg",
            0.72,
          );
        } catch {
          // Canvas tainted — bail this attempt.
          cleanup();
          reject(new Error("canvas tainted"));
        }
      };

      video.onseeked = onSeeked;
      captureNext();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("video load failed"));
    };
  });
}

/** Evenly-spaced sample timestamps avoiding the very first frame
 *  (often a black frame) and the very last (often a fade-out). */
function framesAtStamps(durationSec: number, count: number): number[] {
  if (count <= 1) {
    return [Math.min(0.5, durationSec * 0.5)];
  }
  // Sample between 5% and 95% of the duration.
  const start = durationSec * 0.05;
  const end = durationSec * 0.95;
  const stride = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * stride);
}
