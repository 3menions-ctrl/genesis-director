import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeNavigation } from '@/lib/navigation';

// Hand breaking through glass image
import handBreakingGlass from '@/assets/hand-breaking-glass.png';

interface NovaConversionOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
  signUpButtonRef: React.RefObject<HTMLButtonElement | null>;
}

type AnimationPhase = 
  | 'idle' 
  | 'walking-in' 
  | 'arrived' 
  | 'knocking' 
  | 'pointing' 
  | 'spotlight';

// Pre-computed shard positions to avoid Math.random() during render
// This prevents infinite re-render loops
const GLASS_SHARDS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  left: 30 + (i * 5) + (i % 3) * 3, // Deterministic spread pattern
  top: 20 + (i * 4) + (i % 2) * 5,
  xDirection: i % 2 === 0 ? 1 : -1,
  xOffset: 50 + i * 20,
  yOffset: -30 - i * 15,
  rotateEnd: 360 + i * 45,
}));

/**
 * Fourth wall breaking conversion overlay
 * 
 * Sequence:
 * 1. Hand punches in from behind the screen
 * 2. Glass cracks appear with floating shards
 * 3. Points to the sign up button
 * 4. Everything dims except the sign up button (spotlight)
 * 5. Click outside = dismiss, click sign up = navigate
 */
const NovaConversionOverlay = memo(function NovaConversionOverlay({
  isActive,
  onDismiss,
  signUpButtonRef
}: NovaConversionOverlayProps) {
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [knockRipples, setKnockRipples] = useState<number[]>([]);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { navigate } = useSafeNavigation();

  // Get the sign up button's position for spotlight
  useEffect(() => {
    if (isActive && signUpButtonRef.current) {
      const rect = signUpButtonRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
  }, [isActive, signUpButtonRef]);

  // Animation sequence controller
  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setKnockRipples([]);
      return;
    }

    // Start the animation sequence
    setPhase('walking-in');

    const timers: NodeJS.Timeout[] = [];

    // Phase 2: Arrived (after walk-in)
    timers.push(setTimeout(() => setPhase('arrived'), 1200));

    // Phase 3: Knocking (with ripple effects)
    timers.push(setTimeout(() => {
      setPhase('knocking');
      // Create knock ripples
      setKnockRipples([1]);
      setTimeout(() => setKnockRipples(prev => [...prev, 2]), 300);
      setTimeout(() => setKnockRipples(prev => [...prev, 3]), 600);
    }, 1800));

    // Phase 4: Pointing at button
    timers.push(setTimeout(() => setPhase('pointing'), 3200));

    // Phase 5: Spotlight effect
    timers.push(setTimeout(() => setPhase('spotlight'), 4000));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isActive]);

  // Handle click outside to dismiss
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // If clicking on the overlay background (not Nova or button)
    if (e.target === overlayRef.current) {
      onDismiss();
    }
  }, [onDismiss]);

  // Handle sign up click
  const handleSignUpClick = useCallback(() => {
    navigate('/auth?mode=signup');
  }, [navigate]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-[100] cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleOverlayClick}
      >
        {/* Darkening overlay - intensifies during spotlight phase */}
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: phase === 'spotlight' ? 0.85 : phase === 'pointing' ? 0.6 : 0.3 
          }}
          transition={{ duration: 0.8 }}
        />

        {/* Knock ripple effects - on the "screen glass" */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {knockRipples.map((id) => (
            <motion.div
              key={id}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40"
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ 
                width: 400 + id * 100, 
                height: 400 + id * 100, 
                opacity: 0 
              }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          ))}
        </div>

        {/* Glass crack effect during knock */}
        {(phase === 'knocking' || phase === 'pointing' || phase === 'spotlight') && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px]" viewBox="0 0 200 200">
              <motion.path
                d="M100,100 L120,60 M100,100 L140,90 M100,100 L130,130 M100,100 L80,140 M100,100 L60,110 M100,100 L70,70"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </svg>
          </motion.div>
        )}

        {/* Hand Breaking Through the Fourth Wall */}
        <motion.div
          className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{ 
            x: '-50%',
            y: '-50%',
            willChange: 'transform, opacity'
          }}
          initial={{ 
            scale: 0,
            opacity: 0,
            z: -500
          }}
          animate={{
            scale: phase === 'idle' ? 0 : phase === 'walking-in' ? 0.5 : phase === 'arrived' ? 0.8 : 1,
            opacity: phase === 'idle' ? 0 : 1,
            z: phase === 'spotlight' ? 100 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 12,
            duration: 1
          }}
        >
          {/* Impact glow effect */}
          <motion.div
            className="absolute inset-0 blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(139, 92, 246, 0.2) 50%, transparent 70%)',
            }}
            animate={{
              scale: phase === 'knocking' ? [1, 1.5, 1.2] : phase === 'spotlight' ? 1.5 : 1,
              opacity: phase === 'knocking' ? [0.5, 1, 0.7] : phase === 'spotlight' ? 0.8 : 0.5
            }}
            transition={{ duration: 0.5 }}
          />

          {/* The hand image with punch/break animation */}
          <div className="relative w-[300px] h-[450px] md:w-[400px] md:h-[600px]">
            <motion.img
              src={handBreakingGlass}
              alt="Hand breaking through screen"
              className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              animate={{
                // Punch through effect
                scale: phase === 'knocking' ? [1, 1.15, 1.05] : 1,
                y: phase === 'knocking' ? [0, -30, -10] : 0,
                rotateX: phase === 'knocking' ? [0, -10, -5] : 0,
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut"
              }}
            />

            {/* Floating glass shards - using pre-computed positions */}
            {(phase === 'knocking' || phase === 'pointing' || phase === 'spotlight') && (
              <>
                {GLASS_SHARDS.map((shard) => (
                  <motion.div
                    key={shard.id}
                    className="absolute w-3 h-6 bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-sm"
                    style={{
                      left: `${shard.left}%`,
                      top: `${shard.top}%`,
                      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    }}
                    initial={{ opacity: 0, scale: 0, rotate: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0.8],
                      scale: [0, 1.2, 1],
                      rotate: [0, 180 + shard.id * 45, shard.rotateEnd],
                      x: shard.xDirection * shard.xOffset,
                      y: shard.yOffset,
                    }}
                    transition={{ 
                      duration: 1.5,
                      delay: shard.id * 0.05,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </>
            )}
          </div>

          {/* Speech bubble during pointing phase */}
          {(phase === 'pointing' || phase === 'spotlight') && (
            <motion.div
              className="absolute -top-24 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-4 rounded-2xl shadow-2xl max-w-[260px]"
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
            >
              <span className="text-base font-bold text-center block">
                🚀 Ready to create? Sign up now!
              </span>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45" />
            </motion.div>
          )}
        </motion.div>

        {/* Additional radial cracks from impact point */}
        {(phase === 'knocking' || phase === 'pointing' || phase === 'spotlight') && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]" viewBox="0 0 400 400">
              {/* Main radial cracks */}
              <motion.path
                d="M200,200 L280,80 M200,200 L320,150 M200,200 L340,220 M200,200 L300,300 M200,200 L200,340 M200,200 L100,320 M200,200 L60,250 M200,200 L80,160 M200,200 L120,80"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              />
              {/* Secondary smaller cracks */}
              <motion.path
                d="M280,80 L300,40 M280,80 L260,50 M320,150 L360,130 M340,220 L380,240 M300,300 L330,340 M100,320 L70,350 M60,250 L20,260 M80,160 L40,140 M120,80 L100,40"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              />
            </svg>
          </motion.div>
        )}

        {/* Spotlight on sign-up button */}
        {phase === 'spotlight' && buttonRect && (
          <>
            {/* Spotlight beam */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: buttonRect.left + buttonRect.width / 2,
                top: buttonRect.top + buttonRect.height / 2,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div 
                className="absolute rounded-full"
                style={{
                  width: buttonRect.width + 60,
                  height: buttonRect.height + 60,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  boxShadow: '0 0 80px 40px rgba(255,255,255,0.1)',
                }}
              />
            </motion.div>

            {/* Floating sign-up button clone with glow */}
            <motion.button
              className="absolute z-[101] px-5 py-2.5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.5)] cursor-pointer"
              style={{
                left: buttonRect.left,
                top: buttonRect.top,
                width: buttonRect.width,
                height: buttonRect.height,
              }}
              initial={{ scale: 1 }}
              animate={{ 
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 40px rgba(255,255,255,0.5)',
                  '0 0 60px rgba(255,255,255,0.7)',
                  '0 0 40px rgba(255,255,255,0.5)'
                ]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              onClick={handleSignUpClick}
            >
              Start Free
            </motion.button>

            {/* Arrow pointing to button */}
            <motion.div
              className="absolute z-[101] text-4xl pointer-events-none"
              style={{
                left: buttonRect.left - 50,
                top: buttonRect.top + buttonRect.height / 2 - 20,
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: 1, 
                x: [0, 10, 0]
              }}
              transition={{ 
                opacity: { duration: 0.3 },
                x: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              ➡️
            </motion.div>
          </>
        )}

        {/* Dismiss hint */}
        {phase === 'spotlight' && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Click anywhere to dismiss
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

export default NovaConversionOverlay;
