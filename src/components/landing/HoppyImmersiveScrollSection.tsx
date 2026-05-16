import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Sparkles, ArrowRight } from 'lucide-react';
import Hls from 'hls.js';
import { HOPPY_HLS_URL, HOPPY_MP4_URL } from './HoppyImmersiveIntro';

/**
 * HoppyImmersiveScrollSection
 * Single fixed full-viewport video that fades in once the user scrolls past
 * the hero, plays the entire demo, and stays pinned as a cinematic backdrop
 * while every landing-page section scrolls on top.
 *
 * MUST be mounted OUTSIDE any `position: relative; z-index: …` parent so its
 * `position: fixed` layer escapes that stacking context and remains visually
 * beneath the foreground content column.
 *
 * Activation is driven by a passive `scroll` listener (rAF-throttled) rather
 * than IntersectionObserver — bulletproof under fast scrolling, momentum
 * scrolling, or anchor-jumps.
 */
interface Props {
  /** Called when the user clicks the finale "Get started" CTA. */
  onGetStarted?: () => void;
}

export const HoppyImmersiveScrollSection = memo(function HoppyImmersiveScrollSection({
  onGetStarted,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const [ended, setEnded] = useState(false);

  // Attach video source once on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onReady = () => setReady(true);
    const onEnded = () => setEnded(true);
    const onPlay = () => setEnded(false);
    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);

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
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Activate the fixed video the moment the user scrolls past the hero.
  // Uses a passive, rAF-throttled scroll listener so it stays responsive
  // even during fast / momentum scrolling. Once active it stays active.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let ticking = false;
    let activated = false;
    const THRESHOLD = 220; // px past top of page

    const check = () => {
      ticking = false;
      if (activated) return;
      if (window.scrollY > THRESHOLD) {
        activated = true;
        setActive(true);
        video.play().catch(() => setShowTapHint(true));
        window.removeEventListener('scroll', onScroll);
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(check);
    };

    // Run once in case the user lands mid-page (anchor / refresh).
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setEnded(false);
    v.play().catch(() => undefined);
  };

  return (
    <>
      {/* Fixed full-viewport video layer — sits above background ambient
          layers (z-0, z-[1]) but BELOW all foreground content (z-10+).
          Must be mounted at the page root, outside any z-indexed parent. */}
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
          className="absolute inset-0 w-full h-full object-contain md:object-cover bg-black"
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

            {/* Tap-to-play fallback — invisible full-area click target (play button hidden per design) */}
            {showTapHint && (
              <button
                onClick={handleTap}
                className="fixed inset-0 z-[5] w-full h-full bg-transparent cursor-pointer"
                aria-label="Play video"
              />
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

      {/* Finale overlay — when the immersive cut ends, blur the entire page
          and present a single, oversized "Get started" CTA. */}
      <AnimatePresence>
        {ended && (
          <motion.div
            key="finale"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6"
            style={{
              backdropFilter: 'blur(28px) saturate(140%)',
              WebkitBackdropFilter: 'blur(28px) saturate(140%)',
              background:
                'radial-gradient(60% 70% at 50% 45%, rgba(10,132,255,0.18), rgba(0,0,0,0.78) 70%)',
            }}
            role="dialog"
            aria-label="Get started with Apex Studio"
          >
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-2xl mb-10"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_12px_rgba(10,132,255,0.8)]" />
              <span className="text-[10.5px] font-medium text-white/75 tracking-[0.32em] uppercase">
                That was made with Apex Studio
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-white text-center font-bold tracking-[-0.04em] leading-[0.95] text-[3rem] sm:text-7xl md:text-[6rem] max-w-5xl"
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
            >
              Now make{' '}
              <span
                className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                yours.
              </span>
            </motion.h2>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-8 max-w-lg text-center text-white/70 text-[16px] md:text-[18px] font-light leading-[1.6]"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Free to start. No credit card. Your first cut takes minutes.
            </motion.p>

            {/* Oversized CTA */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={onGetStarted}
              className="group mt-12 inline-flex items-center gap-3 h-20 px-14 rounded-full bg-white text-black text-lg font-medium tracking-tight shadow-[0_30px_90px_-20px_rgba(255,255,255,0.45),0_0_120px_-30px_rgba(10,132,255,0.7)] transition-all duration-300 hover:scale-[1.03] hover:bg-white/95"
            >
              <Sparkles className="w-5 h-5" />
              Get started
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1.5" />
            </motion.button>

            {/* Replay — quiet secondary */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              onClick={replay}
              className="mt-8 text-[12px] tracking-[0.3em] uppercase text-white/45 hover:text-white/80 transition-colors"
            >
              Replay the film
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

HoppyImmersiveScrollSection.displayName = 'HoppyImmersiveScrollSection';

export default HoppyImmersiveScrollSection;