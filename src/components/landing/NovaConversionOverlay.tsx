import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeNavigation } from '@/lib/navigation';

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

// Generate random glass shards
const generateShards = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 800,
    y: (Math.random() - 0.5) * 600,
    rotation: Math.random() * 720 - 360,
    scale: 0.3 + Math.random() * 0.7,
    delay: Math.random() * 0.2,
    width: 10 + Math.random() * 30,
    height: 20 + Math.random() * 50,
  }));
};

const SHARDS = generateShards(20);

/**
 * "Hello!" breaks the fourth wall - conversion optimization overlay
 * 
 * Sequence:
 * 1. "Hello!" punches through from behind the screen
 * 2. Glass shatters with realistic physics
 * 3. Points to the sign up button
 * 4. Everything dims except the text and button
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
      setScreenShake(false);
      return;
    }

    // Start the animation sequence
    setPhase('anticipation');

    const timers: NodeJS.Timeout[] = [];

    // Phase 2: Impact - the punch through moment
    timers.push(setTimeout(() => {
      setPhase('impact');
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 500);
    }, 800));

    // Phase 3: Shatter - glass breaks
    timers.push(setTimeout(() => setPhase('shatter'), 1000));

    // Phase 4: Pointing at button
    timers.push(setTimeout(() => setPhase('pointing'), 2200));

    // Phase 5: Spotlight effect
    timers.push(setTimeout(() => setPhase('spotlight'), 3000));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isActive]);

  // Handle click outside to dismiss
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onDismiss();
    }
  }, [onDismiss]);

  // Handle sign up click
  const handleSignUpClick = useCallback(() => {
    navigate('/auth?mode=signup');
  }, [navigate]);

  if (!isActive) return null;

  const showCracks = phase === 'impact' || phase === 'shatter' || phase === 'pointing' || phase === 'spotlight';
  const showShards = phase === 'shatter' || phase === 'pointing' || phase === 'spotlight';

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className={`fixed inset-0 z-[100] cursor-pointer ${screenShake ? 'animate-shake' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleOverlayClick}
        style={{
          animation: screenShake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none',
        }}
      >
        {/* Darkening overlay */}
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: phase === 'spotlight' ? 0.9 : phase === 'pointing' ? 0.75 : phase === 'shatter' ? 0.6 : 0.4 
          }}
          transition={{ duration: 0.5 }}
        />

        {/* Glass surface before break */}
        {(phase === 'anticipation' || phase === 'impact') && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'anticipation' ? 0.5 : 1 }}
          />
        )}

        {/* Impact flash */}
        {phase === 'impact' && (
          <motion.div
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Crack patterns - SVG */}
        {showCracks && (
          <motion.svg
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none"
            viewBox="0 0 400 400"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            {/* Main radial cracks from center */}
            <motion.g stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none">
              {/* Primary cracks */}
              <motion.path
                d="M200,200 L200,40 M200,200 L340,80 M200,200 L380,200 M200,200 L340,320 M200,200 L200,360 M200,200 L60,320 M200,200 L20,200 M200,200 L60,80"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </motion.g>
            
            {/* Secondary branching cracks */}
            <motion.g stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none">
              <motion.path
                d="M200,120 L170,60 M200,120 L230,50 M270,130 L310,90 M270,130 L290,60 M330,200 L380,170 M330,200 L390,230 M270,270 L320,300 M270,270 L290,340 M200,280 L170,350 M200,280 L230,360 M130,270 L80,310 M130,270 L100,350 M70,200 L30,170 M70,200 L20,240 M130,130 L90,80 M130,130 L60,110"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              />
            </motion.g>

            {/* Tertiary micro cracks */}
            <motion.g stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none">
              <motion.path
                d="M180,80 L160,40 M220,80 L250,30 M300,120 L340,100 M350,180 L390,160 M350,220 L400,250 M300,280 L330,320 M220,320 L240,370 M180,320 L150,380 M100,280 L60,300 M50,220 L10,240 M50,180 L20,150 M100,120 L70,90"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2, delay: 0.2, ease: "easeOut" }}
              />
            </motion.g>

            {/* Concentric impact rings */}
            <motion.circle
              cx="200"
              cy="200"
              r="30"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
            />
            <motion.circle
              cx="200"
              cy="200"
              r="60"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            />
            <motion.circle
              cx="200"
              cy="200"
              r="100"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            />
          </motion.svg>
        )}

        {/* Flying glass shards */}
        {showShards && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {SHARDS.map((shard) => (
              <motion.div
                key={shard.id}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: shard.width,
                  height: shard.height,
                }}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  rotate: 0, 
                  scale: 0,
                  opacity: 0 
                }}
                animate={{ 
                  x: shard.x, 
                  y: shard.y, 
                  rotate: shard.rotation,
                  scale: shard.scale,
                  opacity: [0, 1, 1, 0.8, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: shard.delay,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  opacity: { duration: 2.5, times: [0, 0.1, 0.5, 0.8, 1] }
                }}
              >
                <div 
                  className="w-full h-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 50%, rgba(200,220,255,0.6) 100%)',
                    clipPath: 'polygon(20% 0%, 80% 10%, 100% 60%, 70% 100%, 10% 80%, 0% 30%)',
                    boxShadow: '0 0 10px rgba(255,255,255,0.5)',
                  }}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* "HELLO!" Text Breaking Through */}
        <motion.div
          className="absolute left-1/2 top-1/2 pointer-events-none select-none"
          style={{ 
            x: '-50%',
            y: '-50%',
            perspective: 1000,
          }}
          initial={{ 
            scale: 0.1,
            z: -500,
            opacity: 0,
            rotateX: 30,
          }}
          animate={{
            scale: phase === 'idle' ? 0.1 : 
                   phase === 'anticipation' ? 0.5 : 
                   phase === 'impact' ? 1.3 : 1,
            z: phase === 'impact' ? 200 : 0,
            opacity: phase === 'idle' ? 0 : 1,
            rotateX: phase === 'anticipation' ? 15 : 0,
            y: phase === 'pointing' || phase === 'spotlight' ? '-60%' : '-50%',
          }}
          transition={{
            type: phase === 'impact' ? "spring" : "spring",
            stiffness: phase === 'impact' ? 300 : 100,
            damping: phase === 'impact' ? 15 : 20,
            duration: 0.5
          }}
        >
          {/* Glow effect behind text */}
          <motion.div
            className="absolute inset-0 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.6) 0%, rgba(59, 130, 246, 0.4) 50%, transparent 70%)',
              transform: 'scale(2)',
            }}
            animate={{
              opacity: phase === 'spotlight' ? 1 : 0.7,
              scale: phase === 'impact' ? 2.5 : 2,
            }}
          />

          {/* Main "HELLO!" text */}
          <motion.h1
            className="relative text-7xl md:text-9xl font-black tracking-tight"
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textShadow: `
                0 0 20px rgba(255,255,255,0.8),
                0 0 40px rgba(139, 92, 246, 0.6),
                0 0 60px rgba(59, 130, 246, 0.4),
                0 4px 8px rgba(0,0,0,0.5)
              `,
              WebkitTextStroke: '1px rgba(255,255,255,0.3)',
            }}
            animate={{
              scale: phase === 'impact' ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <span className="bg-gradient-to-br from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              Hello!
            </span>
          </motion.h1>

          {/* Pointing arrow to CTA */}
          {(phase === 'pointing' || phase === 'spotlight') && buttonRect && (
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
              style={{ top: '100%', marginTop: 20 }}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <motion.p 
                className="text-white/90 text-lg md:text-xl font-medium whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Ready to create something amazing?
              </motion.p>
              <motion.div
                className="text-4xl"
                animate={{ 
                  y: [0, 10, 0],
                }}
                transition={{ 
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                👇
              </motion.div>
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
                  width: buttonRect.width + 80,
                  height: buttonRect.height + 80,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                  boxShadow: '0 0 100px 50px rgba(255,255,255,0.15)',
                }}
              />
            </motion.div>

            {/* Floating sign-up button clone */}
            <motion.button
              className="absolute z-[101] px-6 py-3 text-base font-semibold rounded-full bg-white text-black hover:bg-white/90 cursor-pointer"
              style={{
                left: buttonRect.left,
                top: buttonRect.top,
                width: buttonRect.width,
                height: buttonRect.height,
                boxShadow: '0 0 50px rgba(255,255,255,0.6), 0 0 100px rgba(139,92,246,0.4)',
              }}
              initial={{ scale: 1 }}
              animate={{ 
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 50px rgba(255,255,255,0.6), 0 0 100px rgba(139,92,246,0.4)',
                  '0 0 70px rgba(255,255,255,0.8), 0 0 120px rgba(139,92,246,0.6)',
                  '0 0 50px rgba(255,255,255,0.6), 0 0 100px rgba(139,92,246,0.4)'
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
