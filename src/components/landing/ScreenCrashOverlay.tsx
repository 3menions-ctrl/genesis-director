import { memo, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { GlassShatterScene } from './glass-shatter/GlassShatterScene';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const { navigate } = useSafeNavigation();

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
    
    // Show CTA after shards disperse
    timers.push(setTimeout(() => setPhase('cta'), 3000));

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

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
        <div className="absolute inset-0" style={{ opacity: phase === 'cta' ? 0.3 : 1, transition: 'opacity 1s ease-out' }}>
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
                isShattered={phase === 'shatter' || phase === 'cta'} 
                isFading={phase === 'cta'}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Epic CTA */}
        {phase === 'cta' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Radial glow behind button */}
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 30%, transparent 70%)',
                filter: 'blur(40px)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Animated rings */}
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className="absolute rounded-full border pointer-events-none"
                style={{
                  width: 200 + ring * 80,
                  height: 200 + ring * 80,
                  borderColor: `rgba(255,255,255,${0.15 - ring * 0.04})`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1, 1.1], 
                  opacity: [0, 0.5, 0] 
                }}
                transition={{ 
                  duration: 2, 
                  delay: 0.2 + ring * 0.15,
                  ease: 'easeOut',
                  repeat: Infinity,
                  repeatDelay: 1
                }}
              />
            ))}

            {/* Main CTA Button */}
            <motion.div
              className="pointer-events-auto"
              initial={{ scale: 0, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1]
              }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleLetsGo}
                  className="relative h-20 px-16 text-2xl font-bold rounded-full bg-white text-black hover:bg-white/95 shadow-[0_0_100px_rgba(255,255,255,0.5)] transition-all duration-300 overflow-hidden group"
                >
                  {/* Animated shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                    initial={{ x: '-200%' }}
                    animate={{ x: '200%' }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      repeatDelay: 1,
                      ease: 'easeInOut'
                    }}
                  />
                  
                  {/* Button content */}
                  <span className="relative flex items-center gap-3">
                    <Zap className="w-7 h-7 fill-current" />
                    <span>Let's Go!</span>
                    <Sparkles className="w-6 h-6" />
                  </span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              className="mt-8 text-white/50 text-lg font-medium tracking-wide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              Create videos that shatter expectations
            </motion.p>

            {/* Floating particles around button */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full pointer-events-none"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  opacity: 0,
                  scale: 0
                }}
                animate={{ 
                  x: Math.cos((i / 12) * Math.PI * 2) * (100 + Math.random() * 50),
                  y: Math.sin((i / 12) * Math.PI * 2) * (100 + Math.random() * 50),
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: 0.5 + i * 0.05,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
              />
            ))}
          </div>
        )}

        {/* Dismiss hint */}
        {phase === 'cta' && (
          <motion.p
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-sm pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            Click anywhere to dismiss
          </motion.p>
        )}
      </div>
    </AnimatePresence>
  );
});

export default ScreenCrashOverlay;
