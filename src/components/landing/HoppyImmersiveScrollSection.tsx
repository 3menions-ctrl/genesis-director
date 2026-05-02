import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play } from 'lucide-react';
import Hls from 'hls.js';
import { HOPPY_HLS_URL, HOPPY_MP4_URL } from './HoppyImmersiveIntro';

/**
 * HoppyImmersiveScrollSection
 * Renders a single fixed full-viewport video that fades in once the user
 * scrolls past the hero, plays the entire demo, and stays pinned as a
 * cinematic backdrop while subsequent landing-page sections scroll on top.
 *
 * Architecture:
 * - A tall sentinel (`triggerRef`) lives in the normal document flow right
 *   after the hero. Once it enters the viewport, the fixed video activates.
 * - The video itself is `position: fixed; inset: 0` with a low z-index so
 *   landing content above it remains interactive.
 * - A scrim layer is applied on top of the video (still under content) so
 *   foreground typography remains readable.
 */
export const HoppyImmersiveScrollSection = memo(function HoppyImmersiveScrollSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);

  // Attach video source once on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onReady = () => setReady(true);
    video.addEventListener('loadedmetadata', onReady, { once: true });

    const useNativeHls = video.canPlayType('application/vnd.apple.mpegurl');
    if (useNativeHls) {
      video.src = HOPPY_HLS_URL;
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(HOPPY_HLS_URL);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          video.src = HOPPY_MP4_URL;
          video.load();
        }
      });
    } else {
      video.src = HOPPY_MP4_URL;
    }

    return () => {
      video.removeEventListener('loadedmetadata', onReady);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Activate the fixed video as soon as the trigger sentinel enters the viewport.
  // Once activated, it stays active for the rest of the session — content above
  // simply scrolls over it.
  useEffect(() => {
    const trigger = triggerRef.current;
    const video = videoRef.current;
    if (!trigger || !video) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          video.play().catch(() => setShowTapHint(true));
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(trigger);
    return () => io.disconnect();
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) v.volume = 1;
    setMuted(v.muted);
    v.play().catch(() => undefined);
  };

  const handleTap = () => {
    const v = videoRef.current;
    if (!v) return;
    setShowTapHint(false);
    v.play().catch(() => undefined);
  };

  return (
    <>
      {/* Sentinel — sits in normal flow right after the hero. When it enters
          the viewport, the fixed video below activates. Zero-height so it
          doesn't add visual space. */}
      <div ref={triggerRef} aria-hidden className="relative w-full h-px" />

      {/* Fixed full-viewport video layer — sits above background ambient layers
          (z-0, z-[1]) but below all foreground content (z-10+). */}
      <div
        ref={wrapperRef}
        aria-hidden={!active}
        className="fixed inset-0 z-[2] pointer-events-none"
        style={{
          opacity: active ? 1 : 0,
          transition: 'opacity 900ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted={muted}
          preload="metadata"
          onClick={handleTap}
          className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-auto"
        />

        {/* Scrim — keeps foreground content readable. Stronger at edges. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.45) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 95%)',
          }}
        />
      </div>

      {/* Floating controls — fixed in the corner, only visible once active */}
      <AnimatePresence>
        {active && (
          <>
            {/* Loading indicator */}
            {!ready && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] flex flex-col items-center gap-3 pointer-events-none"
              >
                <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-[10px] tracking-[0.32em] uppercase text-white/55">
                  Loading immersive cut
                </p>
              </motion.div>
            )}

            {/* Tap-to-play fallback */}
            {showTapHint && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleTap}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] w-20 h-20 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white"
                aria-label="Play video"
              >
                <Play className="w-7 h-7 ml-1 fill-white" />
              </motion.button>
            )}

            {/* Mute toggle — fixed bottom-right, above content */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="fixed bottom-6 right-6 z-[60] w-11 h-11 inline-flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 hover:bg-black/80 transition-colors shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

HoppyImmersiveScrollSection.displayName = 'HoppyImmersiveScrollSection';

export default HoppyImmersiveScrollSection;