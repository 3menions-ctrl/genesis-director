import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeNavigation } from '@/lib/navigation';

// Nova Chen knocking video
import novaKnockingVideo from '@/assets/nova-chen-knocking.mp4';

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

/**
 * Nova Chen breaks the fourth wall - conversion optimization overlay
 * 
 * Sequence:
 * 1. Nova walks in from bottom/behind the screen
 * 2. Arrives at center and "knocks" on the screen (ripple effect)
 * 3. Points to the sign up button
 * 4. Everything dims except Nova and the sign up button
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

        {/* Nova Chen Video */}
        <motion.div
          className="absolute left-1/2 bottom-0 pointer-events-none"
          style={{ 
            x: '-50%',
            willChange: 'transform, opacity'
          }}
          initial={{ 
            y: '100%',
            opacity: 0
          }}
          animate={{
            y: phase === 'idle' ? '100%' : '0%',
            opacity: phase === 'idle' ? 0 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 80,
            damping: 20,
            duration: 1.2
          }}
        >
          {/* Video glow effect */}
          <motion.div
            className="absolute inset-0 blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
            }}
            animate={{
              scale: phase === 'spotlight' ? 1.5 : 1,
              opacity: phase === 'spotlight' ? 0.8 : 0.5
            }}
            transition={{ duration: 0.8 }}
          />

          {/* Nova's video container */}
          <div className="relative w-[300px] h-[500px] md:w-[400px] md:h-[700px]">
            <video
              src={novaKnockingVideo}
              className="w-full h-full object-cover rounded-t-3xl"
              autoPlay
              muted
              playsInline
              loop={false}
            />

            {/* Pointing hand indicator - appears after video plays */}
            {(phase === 'pointing' || phase === 'spotlight') && (
              <motion.div
                className="absolute -top-4 -right-8"
                initial={{ opacity: 0, scale: 0, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <div className="text-6xl">👆</div>
              </motion.div>
            )}
          </div>

          {/* Speech bubble during pointing phase */}
          {(phase === 'pointing' || phase === 'spotlight') && (
            <motion.div
              className="absolute -top-20 left-1/2 -translate-x-1/2 bg-white text-black px-5 py-3 rounded-2xl shadow-xl max-w-[220px]"
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
            >
              <span className="text-sm font-semibold text-center block">
                Hey! Don't miss out – Sign up now! ✨
              </span>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45" />
            </motion.div>
          )}
        </motion.div>

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
