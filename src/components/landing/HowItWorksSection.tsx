import { memo, forwardRef, useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap, Play } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', accent: 'rgba(251,191,36,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4', demoLabel: 'Same character across 8 scenes' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20', accent: 'rgba(56,189,248,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4', demoLabel: 'Dolly + golden-hour lighting' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every single cut', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', accent: 'rgba(16,185,129,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4', demoLabel: 'Seamless scene transitions' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics and continuity violations', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20', accent: 'rgba(139,92,246,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4', demoLabel: 'Physics-validated motion' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20', accent: 'rgba(244,63,94,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4', demoLabel: 'Clean output, no artifacts' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20', accent: 'rgba(34,211,238,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9ee134ca-5526-4e7f-9c10-1345f7b7b01f_1768109298602.mp4', demoLabel: 'Auto-generated narrative arc' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/20', accent: 'rgba(217,70,239,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4', demoLabel: 'Lip-synced AI voice' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated in a unified pipeline', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', accent: 'rgba(250,204,21,0.4)', demoVideo: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/gallery/Beautiful_Day_Vibes-final.mp4', demoLabel: 'Best-of-breed model selection' },
] as const;

const AUTO_CYCLE_MS = 8000;

/** Compact layer button for the right-side selector */
const LayerButton = memo(function LayerButton({
  layer,
  index,
  isActive,
  onClick,
}: {
  layer: typeof LAYERS[number];
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = layer.icon;
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left p-3.5 rounded-xl border transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
        isActive
          ? 'bg-white/[0.08] border-white/[0.18] shadow-lg'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]'
      }`}
    >
      {/* Active glow */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-xl opacity-20 blur-sm pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 30% 50%, ${layer.accent}, transparent 70%)` }}
        />
      )}

      <div className="relative z-10 flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 w-9 h-9 rounded-lg ${layer.bg} border ${layer.border} flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
          <Icon className={`w-4 h-4 ${layer.color}`} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
              {layer.title}
            </h3>
            <span className={`text-[10px] font-mono tracking-widest transition-colors ${isActive ? 'text-white/30' : 'text-white/[0.08] group-hover:text-white/15'}`}>
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <p className={`text-xs leading-relaxed mt-0.5 transition-colors ${isActive ? 'text-white/50' : 'text-white/20 group-hover:text-white/35'}`}>
            {layer.desc}
          </p>
        </div>
      </div>

      {/* Progress bar for auto-cycle */}
      {isActive && (
        <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full overflow-hidden bg-white/[0.05]">
          <div
            className="h-full rounded-full animate-pipeline-progress"
            style={{
              background: `linear-gradient(90deg, ${layer.accent}, transparent)`,
              animationDuration: `${AUTO_CYCLE_MS}ms`,
            }}
          />
        </div>
      )}
    </button>
  );
});

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    const [activeLayer, setActiveLayer] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cycleTimerRef = useRef<ReturnType<typeof setTimeout>>();

    // Start/restart auto-cycle timer
    const startCycleTimer = useCallback(() => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = setTimeout(() => {
        setActiveLayer(prev => (prev + 1) % LAYERS.length);
      }, AUTO_CYCLE_MS);
    }, []);

    // Auto-cycle
    useEffect(() => {
      if (!isPlaying) return;
      startCycleTimer();
      return () => { if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current); };
    }, [activeLayer, isPlaying, startCycleTimer]);

    // Play video when active layer changes
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.src = LAYERS[activeLayer].demoVideo;
      video.currentTime = 0;
      video.play().catch(() => {});
    }, [activeLayer]);

    const handleLayerClick = useCallback((index: number) => {
      setActiveLayer(index);
      setIsPlaying(true);
    }, []);

    const currentLayer = LAYERS[activeLayer];

    return (
      <section ref={ref} id="features" className="relative z-10 py-28 md:py-40 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-14"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/50 tracking-wide uppercase">Production Pipeline</span>
            </motion.div>

            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-5">
              <span className="block">8 layers of</span>
              <span className="block bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                intelligence
              </span>
            </h2>
            <p className="text-base md:text-lg text-white/30 max-w-md mx-auto leading-relaxed">
              Between your idea and the final video — every frame passes through our cinematic AI stack.
            </p>
          </motion.div>

          {/* ===== MAIN VISUALIZER ===== */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Outer glow */}
            <div className="absolute -inset-6 rounded-[3rem] opacity-40 blur-3xl pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 30% 40%, ${currentLayer.accent.replace('0.4', '0.12')}, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(56,189,248,0.08), transparent 50%)`,
                transition: 'background 1s ease',
              }}
            />

            {/* Gradient border wrapper */}
            <div className="relative rounded-[2rem] p-px overflow-hidden">
              {/* Animated gradient border */}
              <div
                className="absolute inset-0 rounded-[2rem]"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(56,189,248,0.3) 25%, rgba(16,185,129,0.3) 50%, rgba(251,191,36,0.3) 75%, rgba(139,92,246,0.5) 100%)',
                }}
              />
              <div
                className="absolute inset-0 rounded-[2rem]"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-sweep 6s ease-in-out infinite',
                }}
              />

              {/* Container body */}
              <div className="relative rounded-[calc(2rem-1px)] bg-[#07070b] overflow-hidden">
                {/* Atmosphere */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-500/[0.05] rounded-full blur-[100px]" />
                  <div className="absolute -bottom-[100px] left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-sky-500/[0.04] rounded-full blur-[80px]" />
                  <div className="absolute inset-0 opacity-[0.015]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    }}
                  />
                  <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
                </div>

                {/* Content: Split layout */}
                <div className="relative px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
                  <div className="flex flex-col lg:flex-row gap-6">

                    {/* LEFT: Persistent Video Player */}
                    <div className="lg:w-[58%] shrink-0">
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/[0.08] shadow-2xl">
                        {/* Colored glow behind video */}
                        <div
                          className="absolute -inset-4 rounded-2xl opacity-30 blur-2xl pointer-events-none transition-all duration-1000"
                          style={{ background: `radial-gradient(ellipse at center, ${currentLayer.accent}, transparent 70%)` }}
                        />

                        <video
                          ref={videoRef}
                          muted
                          playsInline
                          loop
                          preload="none"
                          className="relative w-full h-full object-cover"
                        />

                        {/* Video overlay info */}
                        <div className="absolute inset-0 pointer-events-none">
                          {/* Top: Layer badge */}
                          <div className="absolute top-3 left-3 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-medium ${currentLayer.color}`}>
                              <Play className="w-3 h-3 fill-current" />
                              Layer {String(activeLayer + 1).padStart(2, '0')}
                            </span>
                          </div>

                          {/* Bottom: Demo label */}
                          <div className="absolute bottom-3 left-3 right-3">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={activeLayer}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-center justify-between"
                              >
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-white/80">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  {currentLayer.demoLabel}
                                </span>
                                <span className={`text-xs font-semibold ${currentLayer.color}`}>
                                  {currentLayer.title}
                                </span>
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Layer Selector */}
                    <div className="lg:w-[42%] flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                      {LAYERS.map((layer, i) => (
                        <LayerButton
                          key={layer.title}
                          layer={layer}
                          index={i}
                          isActive={activeLayer === i}
                          onClick={() => handleLayerClick(i)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-white/[0.05]">
                    <p className="text-xs text-white/20 tracking-wide">
                      Powered by <span className="text-white/40 font-medium">Kling</span> & <span className="text-white/40 font-medium">Veo</span> — orchestrated by Apex
                    </p>
                    <Link
                      to="/how-it-works"
                      className="group/cta inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
                    >
                      Explore the full pipeline
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes shimmer-sweep {
            0%, 100% { background-position: 200% 0; }
            50% { background-position: -200% 0; }
          }
          @keyframes pipeline-progress {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          .animate-pipeline-progress {
            animation-name: pipeline-progress;
            animation-timing-function: linear;
            animation-fill-mode: forwards;
          }
          .scrollbar-thin::-webkit-scrollbar { width: 4px; }
          .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        `}</style>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
