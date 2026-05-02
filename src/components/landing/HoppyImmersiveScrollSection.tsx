import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play } from 'lucide-react';
import Hls from 'hls.js';
import { HOPPY_HLS_URL, HOPPY_MP4_URL } from './HoppyImmersiveIntro';

/**
 * HoppyImmersiveScrollSection
 * A scroll-anchored cinematic moment that pins the full Hoppy demo video to
 * the viewport once the user scrolls to it, plays the entire video edge-to-edge,
 * then releases scroll when the video ends (or when the user scrolls past).
 *
 * Implementation notes:
 * - Uses a tall outer wrapper so the user can scroll past after viewing.
 * - Inner container is `position: sticky; height: 100vh` for a stable pin.
 * - Video preloads metadata, autoplays muted on first viewport entry,
 *   and unmutes on user click (browser autoplay policy compliant).
 * - HLS via hls.js, falling back to MP4 for unsupported browsers.
 */
export const HoppyImmersiveScrollSection = memo(function HoppyImmersiveScrollSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
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

  // Observe viewport entry — play when visible, pause when not
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper || !video) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0.5;
        setInView(visible);
        if (visible) {
          video.play().catch(() => setShowTapHint(true));
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(wrapper);
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
    <section
      ref={wrapperRef}
      aria-label="Apex-Studio immersive demo"
      className="relative w-full bg-black"
      // Tall wrapper so the sticky container has scroll room. ~150vh gives
      // a comfortable lead-in/lead-out without trapping the user.
      style={{ height: '180vh' }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* The video — fills the viewport */}
        <video
          ref={videoRef}
          playsInline
          muted={muted}
          preload="metadata"
          onClick={handleTap}
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />

        {/* Cinematic vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0.85) 100%)',
          }}
        />

        {/* Top fade — blends into preceding section */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black to-transparent" />
        {/* Bottom fade — blends into following section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

        {/* Loading state */}
        <AnimatePresence>
          {!ready && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white/15 border-t-white rounded-full animate-spin" />
                <p className="text-[10.5px] tracking-[0.32em] uppercase text-white/45">
                  Loading immersive cut
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap-to-play hint when autoplay is blocked */}
        <AnimatePresence>
          {showTapHint && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleTap}
              className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white"
              aria-label="Play video"
            >
              <Play className="w-7 h-7 ml-1 fill-white" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Eyebrow chip — only visible while in view */}
        <AnimatePresence>
          {inView && ready && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-8 left-1/2 -translate-x-1/2 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-xl"
            >
              <span className="w-1 h-1 rounded-full bg-[#0A84FF] shadow-[0_0_10px_2px_hsla(212,100%,50%,0.7)]" />
              <span className="text-[10.5px] font-medium text-white/75 tracking-[0.32em] uppercase">
                Apex-Studio · The Full Cut
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mute / unmute control */}
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute bottom-8 right-8 w-12 h-12 inline-flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white/90 hover:bg-black/75 transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Scroll cue — drifts gently while in view */}
        <AnimatePresence>
          {inView && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="absolute bottom-8 left-8 flex flex-col gap-1.5 text-white/40"
            >
              <span className="text-[9px] tracking-[0.4em] uppercase">Keep Scrolling</span>
              <motion.span
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="block h-px w-16 bg-gradient-to-r from-white/60 to-transparent origin-left"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
});

HoppyImmersiveScrollSection.displayName = 'HoppyImmersiveScrollSection';

export default HoppyImmersiveScrollSection;