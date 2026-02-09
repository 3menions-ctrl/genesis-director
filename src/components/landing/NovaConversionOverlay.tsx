import { memo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeNavigation } from '@/lib/navigation';

// Lazy load the 3D glass component for performance
const GlassShatter3D = lazy(() => import('./GlassShatter3D'));

interface NovaConversionOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
  signUpButtonRef: React.RefObject<HTMLButtonElement | null>;
}

type AnimationPhase = 
  | 'idle' 
  | 'anticipation'
  | 'impact' 
  | 'shatter'
  | 'pointing' 
  | 'spotlight';

/**
 * "Hello!" breaks the fourth wall with 3D glass shattering
 * 
 * Features:
 * - Real 3D glass with transmission material (Three.js)
 * - Physics-based glass shard explosion
 * - Premium cinematic aesthetic matching APEX STUDIO
 */
const NovaConversionOverlay = memo(function NovaConversionOverlay({
  isActive,
  onDismiss,
  signUpButtonRef
}: NovaConversionOverlayProps) {
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { navigate } = useSafeNavigation();

  useEffect(() => {
    if (isActive && signUpButtonRef.current) {
      const rect = signUpButtonRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
  }, [isActive, signUpButtonRef]);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setScreenShake(false);
      return;
    }

    setPhase('anticipation');
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => {
      setPhase('impact');
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 600);
    }, 800));

    timers.push(setTimeout(() => setPhase('shatter'), 900));
    timers.push(setTimeout(() => setPhase('pointing'), 2500));
    timers.push(setTimeout(() => setPhase('spotlight'), 3300));

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onDismiss();
    }
  }, [onDismiss]);

  const handleSignUpClick = useCallback(() => {
    navigate('/auth?mode=signup');
  }, [navigate]);

  if (!isActive) return null;

  const isShattered = phase === 'shatter' || phase === 'pointing' || phase === 'spotlight';
  const showText = phase !== 'idle';

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-[100] cursor-pointer overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleOverlayClick}
        style={{
          animation: screenShake ? 'shake 0.6s cubic-bezier(.36,.07,.19,.97) both' : 'none',
        }}
      >
        {/* Dark cinematic overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.97) 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: phase === 'spotlight' ? 1 : phase === 'pointing' ? 0.95 : 0.9
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Purple ambient glow */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.2) 0%, transparent 60%)',
          }}
        />

        {/* 3D Glass Shatter Effect */}
        <Suspense fallback={null}>
          <GlassShatter3D 
            isShattered={isShattered} 
            intensity={phase === 'shatter' ? 1 : 0} 
          />
        </Suspense>

        {/* Impact flash */}
        {phase === 'impact' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 25%, transparent 50%)',
            }}
            initial={{ opacity: 1, scale: 0.3 }}
            animate={{ opacity: 0, scale: 2.5 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}

        {/* "HELLO!" Text */}
        {showText && (
          <motion.div
            className="absolute left-1/2 top-1/2 pointer-events-none select-none z-10"
            style={{ 
              x: '-50%',
              y: '-50%',
              perspective: 1200,
            }}
            initial={{ 
              scale: 0.1,
              opacity: 0,
              rotateX: 60,
              z: -1000,
            }}
            animate={{
              scale: phase === 'anticipation' ? 0.5 : 
                     phase === 'impact' ? 1.2 : 1,
              opacity: 1,
              rotateX: phase === 'anticipation' ? 25 : 0,
              z: phase === 'impact' ? 200 : 0,
              y: phase === 'pointing' || phase === 'spotlight' ? '-65%' : '-50%',
            }}
            transition={{
              type: "spring",
              stiffness: phase === 'impact' ? 500 : 120,
              damping: phase === 'impact' ? 15 : 25,
            }}
          >
            {/* Glow layers */}
            <div className="absolute inset-0 pointer-events-none">
              <motion.div
                className="absolute inset-0 blur-[120px]"
                style={{
                  background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, rgba(59,130,246,0.3) 40%, transparent 70%)',
                  transform: 'scale(4)',
                }}
                animate={{
                  opacity: phase === 'spotlight' ? 0.9 : 0.6,
                }}
              />
              <motion.div
                className="absolute inset-0 blur-[50px]"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 50%)',
                  transform: 'scale(2.5)',
                }}
                animate={{
                  opacity: phase === 'impact' ? 1 : 0.5,
                }}
              />
            </div>

            {/* Main text */}
            <h1 className="relative text-6xl sm:text-7xl md:text-8xl lg:text-[10rem] font-black tracking-[-0.04em] leading-none">
              <motion.span 
                className="inline-block bg-gradient-to-br from-white via-white to-white/90 bg-clip-text text-transparent"
                style={{
                  textShadow: `
                    0 0 60px rgba(255,255,255,0.5),
                    0 0 120px rgba(139,92,246,0.4),
                    0 6px 30px rgba(0,0,0,0.6)
                  `,
                  filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.3))',
                }}
                animate={{
                  scale: phase === 'impact' ? [1, 1.1, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                Hello!
              </motion.span>
            </h1>

            {/* CTA Message */}
            {(phase === 'pointing' || phase === 'spotlight') && (
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
                style={{ top: '100%', marginTop: 40 }}
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 180 }}
              >
                <p className="text-white/80 text-lg md:text-2xl font-medium tracking-wide text-center">
                  Ready to create something amazing?
                </p>
                <motion.div
                  className="text-4xl text-white/60"
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  ↓
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Spotlight on CTA Button */}
        {phase === 'spotlight' && buttonRect && (
          <>
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: buttonRect.left + buttonRect.width / 2,
                top: buttonRect.top + buttonRect.height / 2,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div 
                className="absolute rounded-full"
                style={{
                  width: buttonRect.width + 120,
                  height: buttonRect.height + 120,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(139,92,246,0.15) 40%, transparent 70%)',
                  boxShadow: '0 0 150px 80px rgba(139,92,246,0.2)',
                }}
              />
            </motion.div>

            <motion.button
              className="absolute z-[101] px-8 py-4 text-lg font-bold rounded-full cursor-pointer border border-white/30"
              style={{
                left: buttonRect.left,
                top: buttonRect.top,
                width: buttonRect.width,
                height: buttonRect.height,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(245,245,255,0.95) 100%)',
                color: '#000',
                boxShadow: `
                  0 0 60px rgba(255,255,255,0.6),
                  0 0 120px rgba(139,92,246,0.5),
                  0 10px 40px rgba(0,0,0,0.4)
                `,
              }}
              initial={{ scale: 1 }}
              animate={{ 
                scale: [1, 1.04, 1],
                boxShadow: [
                  '0 0 60px rgba(255,255,255,0.6), 0 0 120px rgba(139,92,246,0.5), 0 10px 40px rgba(0,0,0,0.4)',
                  '0 0 80px rgba(255,255,255,0.8), 0 0 150px rgba(139,92,246,0.6), 0 15px 50px rgba(0,0,0,0.4)',
                  '0 0 60px rgba(255,255,255,0.6), 0 0 120px rgba(139,92,246,0.5), 0 10px 40px rgba(0,0,0,0.4)'
                ]
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              onClick={handleSignUpClick}
            >
              Start Free
            </motion.button>
          </>
        )}

        {/* Dismiss hint */}
        {phase === 'spotlight' && (
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/25 text-sm tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            Click anywhere to dismiss
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

export default NovaConversionOverlay;
