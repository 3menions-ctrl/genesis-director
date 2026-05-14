import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Volume2, VolumeX, X } from 'lucide-react';

export const HOPPY_INTRO_EVENT = 'hoppy:open-intro';

// Official Hoppy "Immersive Landing Video" — registered in gallery_showcase
export const HOPPY_HLS_URL =
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/temp-frames/hls_e7cb67eb-85e5-4ca3-b85c-e5a17051b07c_1771087015077.m3u8';
export const HOPPY_MP4_URL =
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/e7cb67eb-85e5-4ca3-b85c-e5a17051b07c/avatar_e7cb67eb-85e5-4ca3-b85c-e5a17051b07c_clip1_lipsync_1771086006879.mp4';

// Hoppy intro is a 6-clip lipsync playlist. The published .m3u8 references
// raw (un-fragmented) MP4 segments — both hls.js and native Safari HLS
// regularly DROP THE AUDIO TRACK on this kind of source. We therefore
// bypass HLS entirely and play the 6 MP4 segments back-to-back via the
// <video> element. Each MP4 is a complete file with embedded AAC audio,
// so sound is guaranteed.
const HOPPY_CLIP_BASE =
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/e7cb67eb-85e5-4ca3-b85c-e5a17051b07c/avatar_e7cb67eb-85e5-4ca3-b85c-e5a17051b07c';
const HOPPY_CLIPS: string[] = [
  `${HOPPY_CLIP_BASE}_clip1_lipsync_1771086006879.mp4`,
  `${HOPPY_CLIP_BASE}_clip2_lipsync_1771086184096.mp4`,
  `${HOPPY_CLIP_BASE}_clip3_lipsync_1771086363289.mp4`,
  `${HOPPY_CLIP_BASE}_clip4_lipsync_1771086544128.mp4`,
  `${HOPPY_CLIP_BASE}_clip5_lipsync_1771086724461.mp4`,
  `${HOPPY_CLIP_BASE}_clip6_lipsync_1771086905770.mp4`,
];

export const HoppyImmersiveIntro = memo(function HoppyImmersiveIntro() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clipIdxRef = useRef(0);

  const dismiss = useCallback(() => {
    setOpen(false);
    setReady(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    clipIdxRef.current = 0;
  }, []);

  // Manual trigger via custom event from the hero button
  useEffect(() => {
    const handler = () => {
      setError(null);
      setMuted(false);
      setOpen(true);
    };
    window.addEventListener(HOPPY_INTRO_EVENT, handler);
    return () => window.removeEventListener(HOPPY_INTRO_EVENT, handler);
  }, []);

  // Load + play with sound when opened (user gesture from button click satisfies autoplay policy)
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const playWithSound = async () => {
      try {
        video.muted = false;
        video.volume = 1;
        await video.play();
      } catch {
        // Browser blocked unmuted playback — fall back to muted.
        try {
          video.muted = true;
          setMuted(true);
          await video.play();
        } catch {
          if (!cancelled) setError('Playback blocked. Tap the video to play.');
        }
      }
    };

    const playClip = (idx: number, withSound: boolean) => {
      if (cancelled) return;
      clipIdxRef.current = idx;
      video.src = HOPPY_CLIPS[idx];
      video.load();
      const onMeta = () => {
        setReady(true);
        if (withSound) playWithSound();
        else video.play().catch(() => undefined);
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      video.addEventListener(
        'error',
        () => {
          // If a mid-playlist clip fails, advance instead of aborting.
          if (idx < HOPPY_CLIPS.length - 1) playClip(idx + 1, false);
          else if (!cancelled) setError('Video failed to load.');
        },
        { once: true },
      );
    };

    const onEnded = () => {
      const next = clipIdxRef.current + 1;
      if (next < HOPPY_CLIPS.length) {
        // Subsequent clips inherit the user's current mute state, but we
        // reuse the same audio-allowed gesture so sound keeps flowing.
        playClip(next, !video.muted);
      } else {
        dismiss();
      }
    };
    video.addEventListener('ended', onEnded);

    // First clip — uses the original "open" gesture, so unmuted autoplay works.
    playClip(0, true);

    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'm' || e.key === 'M') {
        const v = videoRef.current;
        if (v) {
          v.muted = !v.muted;
          setMuted(v.muted);
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      video.removeEventListener('ended', onEnded);
      document.body.style.overflow = '';
    };
  }, [open, dismiss]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) v.volume = 1;
    setMuted(v.muted);
    if (!v.paused) return;
    v.play().catch(() => undefined);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="hoppy-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Hoppy immersive intro"
        >
          {/* Fullscreen video — fills entire viewport */}
          <video
            ref={videoRef}
            playsInline
            controls={false}
            className="absolute inset-0 z-[1] w-full h-full object-cover bg-black cursor-pointer"
            style={{ width: '100vw', height: '100vh' }}
            onClick={() => {
              const v = videoRef.current;
              if (v && v.paused) v.play().catch(() => undefined);
            }}
          />

          {/* Cinematic vignette — keeps controls readable */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0.85) 100%)',
            }}
          />

          {/* Loading state */}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-[11px] tracking-[0.28em] uppercase text-white/55">
                  Loading immersive intro
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="text-center">
                <p className="text-white/80 text-sm">{error}</p>
                <button
                  onClick={dismiss}
                  className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-black text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Top bar — close + mute */}
          <div className="absolute top-5 right-5 flex items-center gap-2 z-10">
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/85 hover:bg-black/70 transition"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={dismiss}
              aria-label="Close"
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/85 hover:bg-black/70 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom — Enter Apex CTA */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              onClick={dismiss}
              className="group inline-flex items-center gap-3 h-14 pl-7 pr-5 rounded-full bg-white text-black text-sm font-medium tracking-wide hover:bg-white/95 transition-all"
              style={{
                boxShadow:
                  '0 0 0 1px hsla(0,0%,100%,0.1), 0 20px 60px -15px hsla(212,100%,50%,0.55), 0 0 80px -10px hsla(212,100%,50%,0.35)',
              }}
            >
              <span>Enter Apex</span>
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="w-4 h-4" />
              </span>
            </motion.button>
            <p className="text-[10px] tracking-[0.28em] uppercase text-white/75">
              Esc to skip · M to {muted ? 'unmute' : 'mute'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
