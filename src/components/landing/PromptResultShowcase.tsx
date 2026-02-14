import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Maximize2, Minimize2, X } from 'lucide-react';

// Curated prompt → video pairs using real gallery content
const SHOWCASE_PAIRS = [
  {
    prompt: 'A breathtaking aerial journey through pristine winter landscapes, soaring above snow-capped peaks…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
    label: 'Soaring Above Snowy Serenity',
  },
  {
    prompt: 'A cinematic journey through golden-hour landscapes, endless winding roads stretching to the horizon…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
    label: 'Sunset Dreams on Winding Roads',
  },
  {
    prompt: 'A delightful journey through a world of sweet confections, whimsical chocolate wonderlands…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    label: 'Whimsical Chocolate Adventures',
  },
  {
    prompt: 'An epic tale of courage, a lone warrior standing vigil among ancient ruins, defying the test of time…',
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    label: 'Silent Vigil in Ruined Valor',
  },
];

const TYPING_SPEED = 35;
const PAUSE_BEFORE_VIDEO = 800;
const VIDEO_DISPLAY_TIME = 8000;
const FADE_GAP = 600;

const PIPELINE_STAGES = [
  'Analyzing prompt…',
  'Generating script…',
  'Composing shots…',
  'Rendering video…',
];

interface ImmersiveBackgroundProps {
  videoUrl: string;
  label: string;
  onClose: () => void;
}

const ImmersiveBackground = memo(function ImmersiveBackground({ videoUrl, label, onClose }: ImmersiveBackgroundProps) {
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = bgVideoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [videoUrl]);

  return (
    <div className="fixed inset-0 z-[1] animate-fade-in" style={{ animationDuration: '1s' }}>
      {/* Fullscreen video */}
      <video
        ref={bgVideoRef}
        src={videoUrl}
        muted
        playsInline
        loop
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark overlay for content readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70" />
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Floating controls */}
      <div className="fixed top-20 right-6 z-[60] flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.5s' }}>
        {/* Label badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/70 font-medium tracking-wide">{label}</span>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="group flex items-center justify-center w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
          aria-label="Exit immersive mode"
        >
          <X className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
});

export const PromptResultShowcase = memo(function PromptResultShowcase() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'processing' | 'reveal'>('typing');
  const [pipelineStage, setPipelineStage] = useState(0);
  const [isImmersive, setIsImmersive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const pair = SHOWCASE_PAIRS[currentIdx];

  // Typewriter effect
  useEffect(() => {
    if (phase !== 'typing') return;
    if (isImmersive) return; // Pause cycling in immersive mode
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(pair.prompt.slice(0, i));
      if (i >= pair.prompt.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('processing'), PAUSE_BEFORE_VIDEO);
      }
    }, TYPING_SPEED);
    return () => clearInterval(interval);
  }, [phase, pair.prompt, isImmersive]);

  // Fake pipeline processing
  useEffect(() => {
    if (phase !== 'processing') return;
    setPipelineStage(0);
    let stage = 0;
    const interval = setInterval(() => {
      stage++;
      if (stage >= PIPELINE_STAGES.length) {
        clearInterval(interval);
        setPhase('reveal');
      } else {
        setPipelineStage(stage);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  // Video reveal + auto-advance
  useEffect(() => {
    if (phase !== 'reveal') return;
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
    if (!isImmersive) {
      timerRef.current = setTimeout(() => {
        setPhase('typing');
        setCurrentIdx((prev) => (prev + 1) % SHOWCASE_PAIRS.length);
      }, VIDEO_DISPLAY_TIME);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase, isImmersive]);

  const handleEnterImmersive = useCallback(() => {
    if (phase !== 'reveal') return;
    clearTimeout(timerRef.current);
    setIsImmersive(true);
  }, [phase]);

  const handleExitImmersive = useCallback(() => {
    setIsImmersive(false);
    // Resume cycling after exiting
    timerRef.current = setTimeout(() => {
      setPhase('typing');
      setCurrentIdx((prev) => (prev + 1) % SHOWCASE_PAIRS.length);
    }, 3000);
  }, []);

  return (
    <>
      {/* Immersive fullscreen background video */}
      {isImmersive && (
        <ImmersiveBackground
          videoUrl={pair.videoUrl}
          label={pair.label}
          onClose={handleExitImmersive}
        />
      )}

      <div className="w-full max-w-3xl mx-auto mt-12">
        {/* Prompt display */}
        <div className="relative mb-4">
          <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary/60 mt-1 shrink-0" />
            <div className="min-h-[3rem]">
              <p className="text-sm text-white/70 leading-relaxed font-mono">
                {displayedText}
                {phase === 'typing' && (
                  <span className="inline-block w-0.5 h-4 bg-primary/80 ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Processing / Video area */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/50 border border-white/[0.06]">
          {/* Processing state */}
          <AnimatePresence>
            {phase === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10"
              >
                <div className="flex flex-col gap-2 w-48">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <div key={stage} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i <= pipelineStage ? 'bg-primary scale-100' : 'bg-white/10 scale-75'
                      }`} />
                      <span className={`text-xs transition-colors duration-300 ${
                        i <= pipelineStage ? 'text-white/60' : 'text-white/20'
                      }`}>
                        {stage}
                      </span>
                      {i === pipelineStage && (
                        <div className="w-3 h-3 border border-primary/50 border-t-primary rounded-full animate-spin ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video */}
          <video
            ref={videoRef}
            src={pair.videoUrl}
            muted
            playsInline
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              phase === 'reveal' ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Label overlay */}
          {phase === 'reveal' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-4 left-4 right-4 flex items-end justify-between"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {pair.label}
              </span>
              
              {/* Expand to immersive button */}
              {!isImmersive && (
                <button
                  onClick={handleEnterImmersive}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  title="Immersive mode — video becomes your background"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
                  <span className="text-[10px] text-white/50 group-hover:text-white/80 font-medium tracking-wider uppercase transition-colors">Immersive</span>
                </button>
              )}
            </motion.div>
          )}

          {/* Dots indicator */}
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            {SHOWCASE_PAIRS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (isImmersive) setIsImmersive(false);
                  setCurrentIdx(i);
                  setPhase('typing');
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentIdx ? 'bg-white w-5' : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
});
