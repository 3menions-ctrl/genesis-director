/**
 * ScreenCrashOverlay - STABILITY FIX v2
 * 
 * ROOT CAUSE: Three.js Canvas + Framer Motion infinite repeat animations
 * caused GPU memory exhaustion and browser tab crashes on navigation.
 * 
 * FIXES:
 * 1. Dispose WebGL renderer explicitly on unmount/navigation
 * 2. Replace infinite repeat FM animations with CSS @keyframes
 * 3. Set frameloop='demand' when not actively animating
 * 4. Cap particle count and use CSS instead of motion.div
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
        if (mounted) {
          setSceneComponent(() => module.GlassShatterScene);
        }
      })
      .catch(() => {
        // Silently fail - animation will just not show
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!SceneComponent) return null;
  
  return <SceneComponent isShattered={isShattered} isFading={isFading} />;
});

interface ScreenCrashOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
}

type Phase = 'idle' | 'impact' | 'shatter' | 'cta';

const ScreenCrashOverlay = memo(function ScreenCrashOverlay({
  isActive,
  onDismiss
}: ScreenCrashOverlayProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [canvasError, setCanvasError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const { navigate } = useSafeNavigation();

  // Reset state when inactive + CRITICAL: dispose WebGL context
  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setCanvasError(false);
      
      // STABILITY FIX: Explicitly dispose WebGL renderer on deactivation
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
        } catch {
          // ignore
        }
        rendererRef.current = null;
      }
      return;
    }

    setPhase('impact');

    const timers: NodeJS.Timeout[] = [];

    // Start shatter after brief impact
    timers.push(setTimeout(() => setPhase('shatter'), 120));
    
    // Show CTA after shards disperse
    timers.push(setTimeout(() => setPhase('cta'), 3500));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isActive]);

  // STABILITY FIX: Dispose WebGL on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
        } catch {
          // ignore
        }
        rendererRef.current = null;
      }
    };
  }, []);

  const handleLetsGo = useCallback(() => {
    navigate('/auth?mode=signup');
    onDismiss();
  }, [navigate, onDismiss]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current && phase === 'cta') {
      onDismiss();
    }
  }, [onDismiss, phase]);

  if (!isActive) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] cursor-pointer"
      onClick={handleOverlayClick}
    >
      {/* Premium deep black void */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-400",
          phase !== 'idle' ? "opacity-100" : "opacity-0"
        )}
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, #0a0a0f 0%, #030303 50%, #000000 100%)',
        }}
      />

      {/* Impact flash + camera shake */}
      {phase === 'impact' && (
        <div className="absolute inset-0 pointer-events-none animate-flash-impact" />
      )}
      
      {/* Chromatic aberration flash on impact */}
      {(phase === 'impact' || phase === 'shatter') && (
        <div 
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background: phase === 'impact' 
              ? 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.15) 30%, transparent 60%)'
              : 'none',
            opacity: phase === 'impact' ? 1 : 0,
            transition: 'opacity 0.5s ease-out',
          }}
        />
      )}
      
      {/* Screen shake wrapper */}
      {phase === 'impact' && (
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
      )}

      {/* 3D Glass Shatter Scene - with error boundary */}
      {!canvasError && (
        <div 
          className={cn(
            "absolute inset-0 transition-opacity duration-1500",
            phase === 'cta' ? "opacity-15" : "opacity-100"
          )}
        >
          <SilentBoundary>
          <Canvas
              camera={{ position: [0, 0, 5], fov: 55 }}
              gl={{ 
                antialias: true, 
                alpha: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
              }}
              dpr={[1, 2]}
              frameloop={phase === 'cta' ? 'demand' : 'always'}
              onCreated={({ gl }) => {
                // STABILITY FIX: Store renderer ref for cleanup
                rendererRef.current = gl;
                
                // Handle context loss gracefully
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

      {/* Fallback visual if canvas fails - CSS only, no FM */}
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

      {/* Epic CTA Section - CSS animations instead of FM infinite repeats */}
      {phase === 'cta' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Outer glow ring - CSS animation */}
          <div 
            className="absolute w-[800px] h-[800px] rounded-full pointer-events-none animate-scale-in"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Animated expanding rings - CSS keyframe instead of FM repeat:Infinity */}
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

          {/* Tagline */}
          <p className="text-white/40 text-sm uppercase tracking-[0.3em] font-medium mb-6 animate-fade-in"
             style={{ animationDelay: '0.2s' }}>
            Break through
          </p>

          {/* Main CTA Button */}
          <div className="pointer-events-auto relative animate-scale-in" style={{ animationDelay: '0.4s' }}>
            {/* Button glow - CSS pulse instead of FM repeat */}
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
              {/* Shine sweep - CSS animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shine-sweep" />
              
              {/* Button content */}
              <span className="relative flex items-center gap-3 md:gap-4">
                <Zap className="w-6 h-6 md:w-7 md:h-7" style={{ fill: 'currentColor' }} />
                <span className="tracking-wide">Let's Go!</span>
                <ArrowRight className="w-6 h-6 md:w-7 md:h-7 animate-arrow-bounce" />
              </span>
            </Button>
          </div>

          {/* Subtitle */}
          <p className="mt-8 text-white/30 text-base md:text-lg font-light tracking-wide animate-fade-in"
             style={{ animationDelay: '0.8s' }}>
            Create videos that shatter expectations
          </p>

          {/* Sparkle particles - CSS only, reduced count */}
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
    </div>
  );
});

export default ScreenCrashOverlay;
