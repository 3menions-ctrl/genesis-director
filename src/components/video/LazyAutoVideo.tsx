import { memo, useEffect, useRef, type VideoHTMLAttributes } from 'react';
import { useUserPrefs } from '@/contexts/UserPreferencesContext';

/**
 * Concurrent-decoder limiter. Browsers (especially Chromium on Linux/Windows
 * with VP9-alpha and Safari on macOS) cap how many `<video>` decoders can run
 * at once. Once you exceed ~6 simultaneous decoders the tab can hard-crash
 * ("Aw, Snap!"). We coordinate playback across every LazyAutoVideo instance
 * via a shared module-level set so only the most-recently-visible N videos
 * are actively playing at any time.
 */
const MAX_CONCURRENT = 4;
const playing = new Set<HTMLVideoElement>();

function tryPlay(el: HTMLVideoElement) {
  if (playing.has(el)) return;
  // If we're at the cap, evict the oldest entry first.
  if (playing.size >= MAX_CONCURRENT) {
    const oldest = playing.values().next().value as HTMLVideoElement | undefined;
    if (oldest && oldest !== el) {
      try { oldest.pause(); } catch {}
      playing.delete(oldest);
    }
  }
  playing.add(el);
  el.play().catch(() => {
    // Autoplay blocked or transient — drop from the active set so we can retry.
    playing.delete(el);
  });
}

function release(el: HTMLVideoElement) {
  if (!playing.has(el)) return;
  try { el.pause(); } catch {}
  playing.delete(el);
}

type Props = VideoHTMLAttributes<HTMLVideoElement> & {
  /** Override how far outside the viewport playback begins. Default 10%. */
  rootMargin?: string;
};

/**
 * Drop-in replacement for a `<video autoPlay muted loop playsInline>` element
 * that:
 *   1. Defers `src` assignment until the element is near the viewport
 *      (`preload="none"` semantics, but actually enforced).
 *   2. Pauses + unloads when the element scrolls fully off-screen.
 *   3. Coordinates with every other LazyAutoVideo so the page never holds
 *      more than MAX_CONCURRENT decoders open — preventing GPU/decoder
 *      exhaustion crashes on long landing pages.
 */
export const LazyAutoVideo = memo(function LazyAutoVideo({
  src,
  rootMargin = '15%',
  ...rest
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const prefs = useUserPrefs();

  // Apply user-preference defaults whenever they change (or on mount).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, (prefs.defaultVolume ?? 80) / 100));
    el.playbackRate = prefs.defaultPlaybackSpeed ?? 1;
    // Captions default — best-effort: enable the first text track if there is one.
    if (prefs.captionsDefault && el.textTracks && el.textTracks.length > 0) {
      el.textTracks[0].mode = 'showing';
    }
  }, [prefs.defaultVolume, prefs.defaultPlaybackSpeed, prefs.captionsDefault]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    if (!prefs.autoplayVideos) return; // user opted out — load on tap only

    let visible = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible) {
            if (!el.src) {
              el.src = src as string;
              el.load();
            }
            tryPlay(el);
          } else {
            release(el);
          }
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    io.observe(el);

    // Pause when the tab is hidden — avoids decoders chewing power in background.
    const onVis = () => {
      if (document.hidden) release(el);
      else if (visible) tryPlay(el);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      release(el);
    };
  }, [src, rootMargin, prefs.autoplayVideos]);

  // When user turns autoplay off mid-session, assign the src up-front so
  // the poster doesn't stay blank — but never call play().
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    if (!prefs.autoplayVideos && !el.src) {
      el.src = src as string;
      el.load();
    }
  }, [src, prefs.autoplayVideos]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      controls={!prefs.autoplayVideos}
      {...rest}
    />
  );
});