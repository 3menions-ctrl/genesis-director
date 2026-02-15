import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Type, Film, GripVertical, ImageIcon } from 'lucide-react';
import silentVigilSource from '@/assets/silent-vigil-source.png';

// Curated prompt → video pairs using real gallery content
const SHOWCASE_PAIRS = [
  {
    prompt: 'A breathtaking aerial journey through pristine winter landscapes, soaring above snow-capped peaks…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
    label: 'Soaring Above Snowy Serenity',
    sourceImage: null as string | null,
  },
  {
    prompt: 'A cinematic journey through golden-hour landscapes, endless winding roads stretching to the horizon…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
    label: 'Sunset Dreams on Winding Roads',
    sourceImage: null as string | null,
  },
  {
    prompt: 'A delightful journey through a world of sweet confections, whimsical chocolate wonderlands…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    label: 'Whimsical Chocolate Adventures',
    sourceImage: null as string | null,
  },
  {
    prompt: 'An epic tale of courage, a lone warrior standing vigil among ancient ruins, defying the test of time…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    label: 'Silent Vigil in Ruined Valor',
    sourceImage: silentVigilSource,
  },
];

const CYCLE_INTERVAL = 10000;

export const PromptResultShowcase = memo(function PromptResultShowcase() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const pair = SHOWCASE_PAIRS[currentIdx];

  // Auto-cycle through pairs
  useEffect(() => {
    if (isDragging) return;
    timerRef.current = setInterval(() => {
      setVideoReady(false);
      setCurrentIdx((prev) => (prev + 1) % SHOWCASE_PAIRS.length);
      setSliderPos(50);
    }, CYCLE_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [isDragging]);

  // Attach ref callback to play video when it mounts
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      {/* Section header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary tracking-wide uppercase">Before & After</span>
        </div>
        <h3 className="text-xl font-semibold text-white/90">From Prompt to Cinema</h3>
      </div>

      {/* Before/After Container */}
      <div
        ref={containerRef}
        className="relative aspect-video rounded-2xl overflow-hidden border border-white/[0.08] cursor-col-resize select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* === AFTER: Video (full width, underneath) === */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`video-${currentIdx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              <video
                ref={setVideoRef}
                src={pair.videoUrl}
                muted
                loop
                playsInline
                preload="metadata"
                onCanPlay={() => setVideoReady(true)}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </AnimatePresence>
          {/* AFTER label */}
          <div className="absolute bottom-4 right-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-[11px] font-medium text-emerald-300 uppercase tracking-wider">
              <Film className="w-3 h-3" />
              Result
            </span>
          </div>
        </div>

        {/* === BEFORE: Prompt (clipped by slider) === */}
        <div
          className="absolute inset-0 z-10"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
        {pair.sourceImage ? (
            <>
              <AnimatePresence mode="wait">
                <motion.img
                  key={`source-img-${currentIdx}`}
                  src={pair.sourceImage}
                  alt="Source image"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
              {/* BEFORE label */}
              <div className="absolute bottom-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-[11px] font-medium text-white/60 uppercase tracking-wider">
                  <ImageIcon className="w-3 h-3" />
                  Source Image
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center p-8 md:p-12">
                <div className="max-w-md text-center space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1]">
                    <Type className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Your Prompt</span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`prompt-${currentIdx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="text-base md:text-lg text-white/70 leading-relaxed font-mono italic"
                    >
                      "{pair.prompt}"
                    </motion.p>
                  </AnimatePresence>
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-white/30">Drag slider to reveal result →</span>
                  </div>
                </div>
              </div>
              {/* BEFORE label */}
              <div className="absolute bottom-4 left-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-[11px] font-medium text-white/60 uppercase tracking-wider">
                  <Type className="w-3 h-3" />
                  Prompt
                </span>
              </div>
            </>
          )}
        </div>

        {/* === Slider Handle === */}
        <div
          className="absolute top-0 bottom-0 z-20 flex items-center justify-center"
          style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
        >
          {/* Vertical line */}
          <div className="absolute inset-y-0 w-[2px] bg-white/60 shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
          {/* Drag handle */}
          <div
            onPointerDown={handlePointerDown}
            className="relative z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            <GripVertical className="w-4 h-4 text-white/80" />
          </div>
        </div>

        {/* Dots indicator */}
        <div className="absolute top-3 right-3 flex gap-1.5 z-20">
          {SHOWCASE_PAIRS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setVideoReady(false);
                setCurrentIdx(i);
                setSliderPos(50);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentIdx ? 'bg-white w-5' : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Film title */}
        {videoReady && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
            style={{ 
              opacity: sliderPos < 40 ? 1 : 0,
              transition: 'opacity 0.3s' 
            }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {pair.label}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
});
