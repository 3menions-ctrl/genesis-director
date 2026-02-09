import { memo, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { GlassShatterScene } from './glass-shatter/GlassShatterScene';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, ArrowRight } from 'lucide-react';
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
    timers.push(setTimeout(() => setPhase('shatter'), 120));
    
    // Show CTA after shards disperse
    timers.push(setTimeout(() => setPhase('cta'), 3500));

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
        {/* Premium deep black void with subtle gradient */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, #0a0a0f 0%, #030303 50%, #000000 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== 'idle' ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Impact flash - white with purple tinge */}
        {phase === 'impact' && (
          <>
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(168,85,247,0.4) 40%, transparent 70%)',
              }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 1, 0], scale: [0.2, 1.8, 2.5] }}
              transition={{ duration: 0.12, times: [0, 0.5, 1] }}
            />
            {/* Secondary purple flash */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.6) 0%, transparent 50%)',
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.8, 0], scale: [0.5, 2, 3] }}
              transition={{ duration: 0.15, times: [0, 0.4, 1], delay: 0.02 }}
            />
          </>
        )}

        {/* 3D Glass Shatter Scene */}
        <motion.div 
          className="absolute inset-0"
          animate={{ 
            opacity: phase === 'cta' ? 0.15 : 1,
          }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        >
          <Canvas
            camera={{ position: [0, 0, 5], fov: 55 }}
            gl={{ 
              antialias: true, 
              alpha: true,
              powerPreference: 'high-performance',
              toneMapping: 3, // ACESFilmicToneMapping
              toneMappingExposure: 1.2,
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
        </motion.div>

        {/* Epic CTA Section */}
        {phase === 'cta' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Outer glow ring */}
            <motion.div
              className="absolute w-[800px] h-[800px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
                filter: 'blur(60px)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Inner white glow */}
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)',
                filter: 'blur(30px)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Animated expanding rings */}
            {[0, 1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 180,
                  height: 180,
                  border: '1px solid',
                  borderColor: `rgba(139, 92, 246, ${0.4 - ring * 0.08})`,
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: [0.8, 2 + ring * 0.5, 2.5 + ring * 0.6], 
                  opacity: [0, 0.6, 0] 
                }}
                transition={{ 
                  duration: 3, 
                  delay: 0.4 + ring * 0.3,
                  ease: 'easeOut',
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
              />
            ))}

            {/* Tagline */}
            <motion.p
              className="text-white/40 text-sm uppercase tracking-[0.3em] font-medium mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              Break through
            </motion.p>

            {/* Main CTA Button */}
            <motion.div
              className="pointer-events-auto relative"
              initial={{ scale: 0, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ 
                duration: 1, 
                delay: 0.4,
                ease: [0.16, 1, 0.3, 1]
              }}
            >
              {/* Button glow */}
              <motion.div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(59,130,246,0.3) 100%)',
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.6, 0.8, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Button
                  onClick={handleLetsGo}
                  className="relative h-16 md:h-20 px-12 md:px-16 text-xl md:text-2xl font-bold rounded-full overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                    color: '#0a0a0f',
                    boxShadow: '0 0 60px rgba(255,255,255,0.4), 0 0 120px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
                  }}
                >
                  {/* Animated gradient overlay */}
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.1) 100%)',
                    }}
                  />
                  
                  {/* Shine sweep */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
                    initial={{ x: '-200%' }}
                    animate={{ x: '200%' }}
                    transition={{ 
                      duration: 2.5, 
                      repeat: Infinity, 
                      repeatDelay: 2,
                      ease: 'easeInOut'
                    }}
                  />
                  
                  {/* Button content */}
                  <span className="relative flex items-center gap-3 md:gap-4">
                    <Zap className="w-6 h-6 md:w-7 md:h-7" style={{ fill: 'currentColor' }} />
                    <span className="tracking-wide">Let's Go!</span>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ArrowRight className="w-6 h-6 md:w-7 md:h-7" />
                    </motion.div>
                  </span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              className="mt-8 text-white/30 text-base md:text-lg font-light tracking-wide"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              Create videos that shatter expectations
            </motion.p>

            {/* Floating sparkle particles */}
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const distance = 120 + (i % 3) * 30;
              return (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full pointer-events-none"
                  style={{
                    background: i % 2 === 0 ? '#a855f7' : '#ffffff',
                    boxShadow: i % 2 === 0 ? '0 0 6px #a855f7' : '0 0 4px #ffffff',
                  }}
                  initial={{ 
                    x: 0, 
                    y: 0, 
                    opacity: 0,
                    scale: 0
                  }}
                  animate={{ 
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0]
                  }}
                  transition={{ 
                    duration: 2.5,
                    delay: 0.6 + i * 0.08,
                    repeat: Infinity,
                    repeatDelay: 1.5,
                    ease: 'easeOut'
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Dismiss hint */}
        {phase === 'cta' && (
          <motion.p
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/15 text-sm pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            Click anywhere to dismiss
          </motion.p>
        )}
      </div>
    </AnimatePresence>
  );
});

export default ScreenCrashOverlay;
