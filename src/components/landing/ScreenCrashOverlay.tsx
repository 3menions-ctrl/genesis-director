/**
 * ScreenCrashOverlay - v3 with Epic Countdown
 * 
 * Adds a dramatic 5-second countdown before the glass shatter,
 * building tension with escalating visual effects.
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

type Phase = 'idle' | 'countdown' | 'impact' | 'shatter' | 'cta';

const COUNTDOWN_SECONDS = 5;

const ScreenCrashOverlay = memo(function ScreenCrashOverlay({
  isActive,
  onDismiss
}: ScreenCrashOverlayProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [canvasError, setCanvasError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const { navigate } = useSafeNavigation();

  // Phase sequencing
  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setCount(COUNTDOWN_SECONDS);
      setCanvasError(false);
      
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
        } catch { /* ignore */ }
        rendererRef.current = null;
      }
      return;
    }

    // Start countdown
    setPhase('countdown');
    setCount(COUNTDOWN_SECONDS);

    return () => {};
  }, [isActive]);

  // Countdown ticker
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (count <= 0) {
      // Countdown finished → impact
      setPhase('impact');
      return;
    }

    const timer = setTimeout(() => setCount(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, count]);

  // Impact → shatter → CTA sequencing
  useEffect(() => {
    if (phase !== 'impact') return;
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setPhase('shatter'), 200));
    timers.push(setTimeout(() => setPhase('cta'), 7000));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Cleanup WebGL on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
        } catch { /* ignore */ }
        rendererRef.current = null;
      }
    };
  }, []);

  const handleLetsGo = useCallback(() => {
    navigate('/auth?mode=signup');
    onDismiss();
  }, [navigate, onDismiss]);

  const handleOverlayClick = useCallback(() => {
    if (phase === 'cta') {
      onDismiss();
    }
  }, [onDismiss, phase]);

  if (!isActive) return null;

  // Intensity grows as countdown decreases (5→1 = 0→1 intensity)
  const intensity = phase === 'countdown' ? (COUNTDOWN_SECONDS - count) / COUNTDOWN_SECONDS : 1;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] cursor-pointer"
      onClick={handleOverlayClick}
    >
      {/* Deep void background — fades in during countdown */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, #0a0a0f 0%, #030303 50%, #000000 100%)',
          opacity: phase === 'idle' ? 0 : phase === 'countdown' ? 0.6 + intensity * 0.4 : 1,
        }}
      />

      {/* ===== COUNTDOWN PHASE ===== */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Escalating radial pulse */}
          <div
            className="absolute rounded-full animate-countdown-pulse"
            style={{
              width: `${200 + intensity * 400}px`,
              height: `${200 + intensity * 400}px`,
              background: `radial-gradient(circle, rgba(139,92,246,${0.05 + intensity * 0.15}) 0%, transparent 70%)`,
              filter: `blur(${40 - intensity * 20}px)`,
              transition: 'width 0.8s, height 0.8s, background 0.8s',
            }}
          />

          {/* Crack lines that grow with each count */}
          {count <= 3 && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: Math.min((4 - count) * 4, 12) }).map((_, i) => {
                const angle = (i / 12) * 360;
                const length = 30 + (4 - count) * 25 + Math.random() * 20;
                return (
                  <div
                    key={i}
                    className="absolute left-1/2 top-1/2 origin-left"
                    style={{
                      width: `${length}%`,
                      height: '1px',
                      background: `linear-gradient(90deg, rgba(139,92,246,${0.4 + (4 - count) * 0.2}), transparent)`,
                      transform: `rotate(${angle + Math.random() * 20}deg)`,
                      animation: `crack-grow 0.3s ease-out ${i * 0.05}s both`,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Expanding rings */}
          {[0, 1, 2].map(ring => (
            <div
              key={ring}
              className="absolute rounded-full"
              style={{
                width: `${100 + ring * 60}px`,
                height: `${100 + ring * 60}px`,
                border: `1px solid rgba(139,92,246,${(0.1 + intensity * 0.2) - ring * 0.05})`,
                animation: `ring-breathe 2s ease-in-out infinite ${ring * 0.3}s`,
              }}
            />
          ))}

          {/* THE NUMBER */}
          <div className="relative" key={count}>
            {/* Number glow */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                filter: `blur(${20 + intensity * 10}px)`,
              }}
            >
              <span
                className="text-[200px] md:text-[300px] font-black tabular-nums"
                style={{ color: `rgba(139,92,246,${0.3 + intensity * 0.3})` }}
              >
                {count > 0 ? count : ''}
              </span>
            </div>

            {/* Number body */}
            <span
              className="relative block text-[200px] md:text-[300px] font-black tabular-nums leading-none animate-countdown-number"
              style={{
                color: 'white',
                textShadow: `0 0 ${30 + intensity * 40}px rgba(139,92,246,${0.3 + intensity * 0.4}), 0 0 ${60 + intensity * 80}px rgba(139,92,246,${0.15 + intensity * 0.2})`,
              }}
            >
              {count > 0 ? count : ''}
            </span>
          </div>

          {/* Sub-label */}
          <p
            className="absolute bottom-[20%] text-white/20 text-sm uppercase tracking-[0.4em] font-medium animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            {count > 3 ? 'Something is coming...' : count > 1 ? 'Brace yourself' : 'Impact'}
          </p>

          {/* Heartbeat vignette — stronger as count lowers */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 ${100 + intensity * 150}px rgba(0,0,0,${0.3 + intensity * 0.4})`,
              animation: count <= 2 ? 'heartbeat-vignette 0.8s ease-in-out infinite' : undefined,
            }}
          />
        </div>
      )}

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
          <style>{`
            @keyframes screenShake {
              0%, 100% { transform: translate(0, 0); }
              10% { transform: translate(-3px, 2px); }
              20% { transform: translate(4px, -2px); }
              30% { transform: translate(-2px, 3px); }
              40% { transform: translate(3px, -1px); }
              50% { transform: translate(-1px, 2px); }
              60% { transform: translate(2px, -2px); }
              70% { transform: translate(-2px, 1px); }
              80% { transform: translate(1px, -1px); }
            }
            .screen-shake { animation: screenShake 0.3s ease-out; }
          `}</style>
        </>
      )}

      {/* 3D Glass Shatter Scene */}
      {!canvasError && (phase === 'impact' || phase === 'shatter' || phase === 'cta') && (
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div 
            className="absolute w-[800px] h-[800px] rounded-full pointer-events-none animate-scale-in"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />

          {[0, 1, 2].map((ring) => (
            <div
              key={ring}
              className="absolute rounded-full pointer-events-none animate-ring-expand"
              style={{
                width: 180,
                height: 180,
                border: '1px solid',
                borderColor: `rgba(139, 92, 246, ${0.4 - ring * 0.1})`,
                animationDelay: `${0.4 + ring * 0.3}s`,
              }}
            />
          ))}

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

          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 120 + (i % 3) * 30;
            return (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full pointer-events-none animate-sparkle-float"
                style={{
                  background: i % 2 === 0 ? '#a855f7' : '#ffffff',
                  boxShadow: i % 2 === 0 ? '0 0 6px #a855f7' : '0 0 4px #ffffff',
                  '--sparkle-x': `${Math.cos(angle) * distance}px`,
                  '--sparkle-y': `${Math.sin(angle) * distance}px`,
                  animationDelay: `${0.6 + i * 0.12}s`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}

      {/* Dismiss hint */}
      {phase === 'cta' && (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/15 text-sm pointer-events-none animate-fade-in"
           style={{ animationDelay: '2s' }}>
          Click anywhere to dismiss
        </p>
      )}

      {/* Countdown-specific animations */}
      <style>{`
        @keyframes countdown-number {
          0% { transform: scale(1.4); opacity: 0; }
          15% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        .animate-countdown-number {
          animation: countdown-number 1s ease-out;
        }
        @keyframes countdown-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .animate-countdown-pulse {
          animation: countdown-pulse 1s ease-in-out infinite;
        }
        @keyframes ring-breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.6; }
        }
        @keyframes crack-grow {
          0% { transform: scaleX(0); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes heartbeat-vignette {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
});

export default ScreenCrashOverlay;
