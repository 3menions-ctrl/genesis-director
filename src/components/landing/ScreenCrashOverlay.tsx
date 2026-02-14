/**
 * ScreenCrashOverlay - Background Countdown + Glass Shatter
 * 
 * The countdown lives BEHIND all page content (z-[1]) and is only visible
 * during user inactivity. Any scroll/mouse/key resets it to 10 seconds.
 * When it reaches 0, the shatter takes over the foreground.
 */

import { memo, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { SilentBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';

// Lazy load the heavy 3D scene
const GlassShatterScene = memo(function GlassShatterSceneLazy({
  isShattered,
  isFading
}: {
  isShattered: boolean;
  isFading: boolean;
}) {
  const [SceneComponent, setSceneComponent] = useState<React.ComponentType<{
    isShattered: boolean;
    isFading: boolean;
  }> | null>(null);

  useEffect(() => {
    let mounted = true;
    import('./glass-shatter/GlassShatterScene')
      .then(module => {
        if (mounted) setSceneComponent(() => module.GlassShatterScene);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!SceneComponent) return null;
  return <SceneComponent isShattered={isShattered} isFading={isFading} />;
});

interface ScreenCrashOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
}

type Phase = 'background' | 'impact' | 'shatter' | 'cta';

const COUNTDOWN_MAX = 10;
const INACTIVITY_DELAY = 2000; // ms before countdown resumes after last activity

const ScreenCrashOverlay = memo(function ScreenCrashOverlay({
  isActive,
  onDismiss
}: ScreenCrashOverlayProps) {
  const [phase, setPhase] = useState<Phase>('background');
  const [count, setCount] = useState(COUNTDOWN_MAX);
  const [isInactive, setIsInactive] = useState(false);
  const [canvasError, setCanvasError] = useState(false);
  const rendererRef = useRef<any>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasShatteredRef = useRef(false);
  const { navigate } = useSafeNavigation();

  // Track user activity — reset countdown and pause
  useEffect(() => {
    if (!isActive || hasShatteredRef.current) return;

    const handleActivity = () => {
      // Don't reset after shatter has occurred
      if (hasShatteredRef.current) return;

      // Reset countdown to max
      setCount(COUNTDOWN_MAX);
      setIsInactive(false);

      // Clear existing inactivity timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      // Start new inactivity timer
      inactivityTimerRef.current = setTimeout(() => {
        setIsInactive(true);
      }, INACTIVITY_DELAY);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    // Start initial inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      setIsInactive(true);
    }, INACTIVITY_DELAY);

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isActive]);

  // Countdown ticker — only ticks when inactive
  useEffect(() => {
    if (!isActive || !isInactive || phase !== 'background' || hasShatteredRef.current) return;

    if (count <= 0) {
      hasShatteredRef.current = true;
      setPhase('impact');
      return;
    }

    const timer = setTimeout(() => setCount(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [isActive, isInactive, phase, count]);

  // Impact → shatter transition
  useEffect(() => {
    if (phase !== 'impact') return;
    const timer = setTimeout(() => setPhase('shatter'), 200);
    return () => clearTimeout(timer);
  }, [phase]);

  // Shatter → CTA transition
  useEffect(() => {
    if (phase !== 'shatter') return;
    const timer = setTimeout(() => setPhase('cta'), 6800);
    return () => clearTimeout(timer);
  }, [phase]);

  // Reset on deactivation
  useEffect(() => {
    if (!isActive) {
      setPhase('background');
      setCount(COUNTDOWN_MAX);
      setIsInactive(false);
      setCanvasError(false);
      hasShatteredRef.current = false;

      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
        } catch { /* ignore */ }
        rendererRef.current = null;
      }
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
        } catch { /* ignore */ }
        rendererRef.current = null;
      }
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  const handleLetsGo = useCallback(() => {
    navigate('/auth?mode=signup');
    onDismiss();
  }, [navigate, onDismiss]);

  const handleOverlayClick = useCallback(() => {
    if (phase === 'cta') onDismiss();
  }, [onDismiss, phase]);

  if (!isActive) return null;

  const isForeground = phase === 'impact' || phase === 'shatter' || phase === 'cta';
  // Opacity: fully visible when inactive and counting, fades when active
  const countdownOpacity = isInactive ? Math.min(1, (COUNTDOWN_MAX - count) * 0.15 + 0.3) : 0;

  return (
    <>
      {/* ===== BACKGROUND COUNTDOWN LAYER (behind everything) ===== */}
      {phase === 'background' && (
        <div
          className="fixed inset-0 z-[1] pointer-events-none select-none overflow-hidden"
          style={{ opacity: countdownOpacity, transition: 'opacity 0.8s ease-in-out' }}
        >
          {/* Subtle radial glow */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 50%, rgba(139,92,246,${0.03 + (COUNTDOWN_MAX - count) * 0.008}) 0%, transparent 60%)`,
            }}
          />

          {/* Giant countdown number */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Number glow layer */}
            <div
              className="absolute"
              style={{ filter: `blur(${60 - count * 3}px)` }}
            >
              <span
                className="text-[30vw] md:text-[25vw] font-black tabular-nums leading-none"
                style={{
                  color: `rgba(139,92,246,${0.08 + (COUNTDOWN_MAX - count) * 0.02})`,
                }}
              >
                {count}
              </span>
            </div>

            {/* Main number */}
            <span
              key={count}
              className="relative text-[30vw] md:text-[25vw] font-black tabular-nums leading-none animate-bg-countdown-tick"
              style={{
                color: `rgba(255,255,255,${0.04 + (COUNTDOWN_MAX - count) * 0.015})`,
                textShadow: count <= 3
                  ? `0 0 ${80 - count * 15}px rgba(139,92,246,${0.15 + (3 - count) * 0.1})`
                  : 'none',
              }}
            >
              {count}
            </span>
          </div>

          {/* Expanding rings — only visible at lower counts */}
          {count <= 5 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[0, 1].map(ring => (
                <div
                  key={ring}
                  className="absolute rounded-full"
                  style={{
                    width: `${20 + ring * 15}vw`,
                    height: `${20 + ring * 15}vw`,
                    border: `1px solid rgba(139,92,246,${0.06 - ring * 0.02})`,
                    animation: `ring-breathe 3s ease-in-out infinite ${ring * 0.5}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Crack lines at very low counts */}
          {count <= 2 && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: (3 - count) * 5 }).map((_, i) => {
                const angle = (i / 15) * 360 + Math.random() * 30;
                const length = 15 + (3 - count) * 12;
                return (
                  <div
                    key={i}
                    className="absolute left-1/2 top-1/2 origin-left"
                    style={{
                      width: `${length}%`,
                      height: '1px',
                      background: `linear-gradient(90deg, rgba(139,92,246,${0.08 + (3 - count) * 0.04}), transparent)`,
                      transform: `rotate(${angle}deg)`,
                      animation: `crack-grow 0.5s ease-out ${i * 0.08}s both`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== FOREGROUND SHATTER + CTA (takes over screen) ===== */}
      {isForeground && (
        <div
          className="fixed inset-0 z-[100] cursor-pointer"
          onClick={handleOverlayClick}
        >
          {/* Deep void background */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%, #0a0a0f 0%, #030303 50%, #000000 100%)',
            }}
          />

          {/* Impact flash */}
          {phase === 'impact' && (
            <>
              <div className="absolute inset-0 pointer-events-none animate-flash-impact" />
              <div
                className="absolute inset-0 pointer-events-none mix-blend-screen"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.15) 30%, transparent 60%)',
                }}
              />
            </>
          )}

          {/* 3D Glass Shatter Scene */}
          {!canvasError && (
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-1500",
                phase === 'cta' ? "opacity-15" : "opacity-100"
              )}
            >
              <SilentBoundary>
                <Canvas
                  camera={{ position: [0, 0, 5.5], fov: 50 }}
                  gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: 'high-performance',
                    failIfMajorPerformanceCaveat: false,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.4,
                  }}
                  dpr={[1, 2.5]}
                  frameloop={phase === 'cta' ? 'demand' : 'always'}
                  onCreated={({ gl }) => {
                    rendererRef.current = gl;
                    gl.domElement.addEventListener('webglcontextlost', (e) => {
                      e.preventDefault();
                      setCanvasError(true);
                    }, false);
                  }}
                >
                  <Suspense fallback={null}>
                    <GlassShatterScene
                      isShattered={phase === 'shatter' || phase === 'cta'}
                      isFading={phase === 'cta'}
                    />
                  </Suspense>
                </Canvas>
              </SilentBoundary>
            </div>
          )}

          {/* CSS fallback shards */}
          {canvasError && (phase === 'shatter' || phase === 'cta') && (
            <div className="absolute inset-0 pointer-events-none animate-fade-in">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-16 h-16 border border-white/20 animate-shard-fly"
                  style={{
                    left: `${20 + (i % 4) * 15}%`,
                    top: `${20 + Math.floor(i / 4) * 20}%`,
                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    animationDelay: `${i * 40}ms`,
                    '--shard-x': `${(Math.random() - 0.5) * 400}px`,
                    '--shard-y': `${(Math.random() - 0.5) * 400}px`,
                    '--shard-rotate': `${Math.random() * 360}deg`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}

          {/* CTA Section */}
          {phase === 'cta' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
              <div
                className="absolute w-[800px] h-[800px] rounded-full pointer-events-none animate-scale-in"
                style={{
                  background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
                  filter: 'blur(60px)',
                }}
              />

              <p className="text-white/40 text-sm uppercase tracking-[0.3em] font-medium mb-6 animate-fade-in"
                 style={{ animationDelay: '0.2s' }}>
                Break through
              </p>

              <div className="pointer-events-auto relative animate-scale-in" style={{ animationDelay: '0.4s' }}>
                <div
                  className="absolute inset-0 rounded-full blur-2xl animate-pulse-glow"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(59,130,246,0.3) 100%)',
                  }}
                />

                <Button
                  onClick={handleLetsGo}
                  className="relative h-16 md:h-20 px-12 md:px-16 text-xl md:text-2xl font-bold rounded-full overflow-hidden group hover:scale-[1.03] active:scale-[0.98] transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                    color: '#0a0a0f',
                    boxShadow: '0 0 60px rgba(255,255,255,0.4), 0 0 120px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shine-sweep" />
                  <span className="relative flex items-center gap-3 md:gap-4">
                    <Zap className="w-6 h-6 md:w-7 md:h-7" style={{ fill: 'currentColor' }} />
                    <span className="tracking-wide">Let's Go!</span>
                    <ArrowRight className="w-6 h-6 md:w-7 md:h-7 animate-arrow-bounce" />
                  </span>
                </Button>
              </div>

              <p className="mt-8 text-white/30 text-base md:text-lg font-light tracking-wide animate-fade-in"
                 style={{ animationDelay: '0.8s' }}>
                Create videos that shatter expectations
              </p>
            </div>
          )}

          {/* Dismiss hint */}
          {phase === 'cta' && (
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/15 text-sm pointer-events-none animate-fade-in"
               style={{ animationDelay: '2s' }}>
              Click anywhere to dismiss
            </p>
          )}
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes bg-countdown-tick {
          0% { transform: scale(1.08); opacity: 0; }
          20% { transform: scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0.8; }
        }
        .animate-bg-countdown-tick {
          animation: bg-countdown-tick 1s ease-out;
        }
        @keyframes ring-breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.08); opacity: 0.6; }
        }
        @keyframes crack-grow {
          0% { transform: scaleX(0); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes flash-impact {
          0% { background: rgba(255,255,255,0.9); }
          100% { background: transparent; }
        }
        .animate-flash-impact {
          animation: flash-impact 0.3s ease-out forwards;
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes shine-sweep {
          0% { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(250%) skewX(-12deg); }
        }
        .animate-shine-sweep {
          animation: shine-sweep 3s ease-in-out infinite;
        }
        @keyframes arrow-bounce {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
        .animate-arrow-bounce {
          animation: arrow-bounce 1.2s ease-in-out infinite;
        }
        @keyframes ring-expand {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(4); opacity: 0; }
        }
        .animate-ring-expand {
          animation: ring-expand 2s ease-out forwards;
        }
        @keyframes shard-fly {
          0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--shard-x), var(--shard-y)) rotate(var(--shard-rotate)); opacity: 0; }
        }
        .animate-shard-fly {
          animation: shard-fly 1.5s ease-out forwards;
        }
      `}</style>
    </>
  );
});

export default ScreenCrashOverlay;