import { memo, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { GlassShatterScene } from './glass-shatter/GlassShatterScene';

interface ScreenCrashOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
}

type Phase = 'idle' | 'impact' | 'shatter' | 'hold';

const ScreenCrashOverlay = memo(function ScreenCrashOverlay({
  isActive,
  onDismiss
}: ScreenCrashOverlayProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Animation sequence
  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    setPhase('impact');

    const timers: NodeJS.Timeout[] = [];

    // Start shatter after brief impact
    timers.push(setTimeout(() => setPhase('shatter'), 150));
    
    // Hold state after animation completes
    timers.push(setTimeout(() => setPhase('hold'), 5000));

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current && (phase === 'shatter' || phase === 'hold')) {
      onDismiss();
    }
  }, [onDismiss, phase]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[100] cursor-pointer"
        onClick={handleOverlayClick}
      >
        {/* Deep black void */}
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== 'idle' ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Impact flash */}
        {phase === 'impact' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.5) 30%, transparent 70%)',
            }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0], scale: [0.3, 1.5, 2] }}
            transition={{ duration: 0.15, times: [0, 0.4, 1] }}
          />
        )}

        {/* 3D Glass Shatter Scene */}
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 60 }}
            gl={{ 
              antialias: true, 
              alpha: true,
              powerPreference: 'high-performance'
            }}
            dpr={[1, 2]}
          >
            <Suspense fallback={null}>
              <GlassShatterScene 
                isShattered={phase === 'shatter' || phase === 'hold'} 
                isFading={phase === 'hold'}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Dismiss hint */}
        {phase === 'hold' && (
          <motion.p
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-sm pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Click anywhere to dismiss
          </motion.p>
        )}
      </div>
    </AnimatePresence>
  );
});

export default ScreenCrashOverlay;
