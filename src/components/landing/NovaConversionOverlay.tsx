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

// Realistic glass shard generator - creates irregular polygon shards
const generateRealisticShards = (count: number) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 150 + Math.random() * 400;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      rotation: Math.random() * 1080 - 540,
      scale: 0.2 + Math.random() * 0.8,
      delay: Math.random() * 0.15,
      width: 8 + Math.random() * 25,
      height: 15 + Math.random() * 45,
      opacity: 0.3 + Math.random() * 0.7,
      // Irregular polygon clip path
      clipPath: `polygon(
        ${10 + Math.random() * 20}% ${Math.random() * 15}%, 
        ${70 + Math.random() * 30}% ${5 + Math.random() * 20}%, 
        ${85 + Math.random() * 15}% ${40 + Math.random() * 30}%, 
        ${60 + Math.random() * 40}% ${85 + Math.random() * 15}%, 
        ${Math.random() * 25}% ${70 + Math.random() * 30}%, 
        ${Math.random() * 15}% ${30 + Math.random() * 30}%
      )`,
    };
  });
};

const SHARDS = generateRealisticShards(35);

// Generate crack line paths for more realism
const generateCrackPaths = () => {
  const paths: string[] = [];
  const numMainCracks = 12;
  
  for (let i = 0; i < numMainCracks; i++) {
    const angle = (i / numMainCracks) * Math.PI * 2;
    const length = 120 + Math.random() * 80;
    let path = 'M200,200';
    let x = 200, y = 200;
    const segments = 3 + Math.floor(Math.random() * 3);
    
    for (let j = 0; j < segments; j++) {
      const segLength = length / segments;
      const jitter = (Math.random() - 0.5) * 30;
      x += Math.cos(angle + jitter * 0.05) * segLength;
      y += Math.sin(angle + jitter * 0.05) * segLength;
      path += ` L${x},${y}`;
      
      // Add branch cracks
      if (Math.random() > 0.4) {
        const branchAngle = angle + (Math.random() - 0.5) * 1.2;
        const branchLen = 20 + Math.random() * 40;
        const bx = x + Math.cos(branchAngle) * branchLen;
        const by = y + Math.sin(branchAngle) * branchLen;
        paths.push(`M${x},${y} L${bx},${by}`);
      }
    }
    paths.push(path);
  }
  return paths;
};

const CRACK_PATHS = generateCrackPaths();

/**
 * "Hello!" breaks the fourth wall - premium conversion overlay
 * 
 * Matches the APEX STUDIO landing page aesthetic:
 * - Dark cinematic background
 * - White/purple accents
 * - Glass-morphism effects
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
    }, 600));

    timers.push(setTimeout(() => setPhase('shatter'), 800));
    timers.push(setTimeout(() => setPhase('pointing'), 2000));
    timers.push(setTimeout(() => setPhase('spotlight'), 2800));

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

  const showCracks = phase === 'impact' || phase === 'shatter' || phase === 'pointing' || phase === 'spotlight';
  const showShards = phase === 'shatter' || phase === 'pointing' || phase === 'spotlight';

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
        {/* Dark cinematic overlay - matches landing page */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: phase === 'spotlight' ? 1 : phase === 'pointing' ? 0.95 : 0.9
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Subtle purple ambient glow - matching landing aesthetic */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.15) 0%, transparent 60%)',
          }}
        />

        {/* Glass surface with subtle reflection */}
        {(phase === 'anticipation') && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Glass reflection line */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)',
              }}
            />
          </motion.div>
        )}

        {/* Impact flash - white burst */}
        {phase === 'impact' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 30%, transparent 60%)',
            }}
            initial={{ opacity: 1, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        )}

        {/* Realistic Glass Crack Pattern */}
        {showCracks && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <motion.svg
              className="w-[800px] h-[800px] md:w-[1000px] md:h-[1000px]"
              viewBox="0 0 400 400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1 }}
            >
              {/* Impact point - concentric stress rings */}
              <motion.circle
                cx="200"
                cy="200"
                r="15"
                fill="none"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.1 }}
              />
              <motion.circle
                cx="200"
                cy="200"
                r="35"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.15, delay: 0.02 }}
              />
              <motion.circle
                cx="200"
                cy="200"
                r="60"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: 0.04 }}
              />

              {/* Main radial cracks - procedurally generated */}
              {CRACK_PATHS.map((path, i) => (
                <motion.path
                  key={i}
                  d={path}
                  fill="none"
                  stroke={i < 12 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"}
                  strokeWidth={i < 12 ? 1.5 : 0.8}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ 
                    duration: 0.2 + Math.random() * 0.15,
                    delay: i * 0.008,
                    ease: "easeOut"
                  }}
                />
              ))}

              {/* Webbing cracks - connecting lines */}
              <motion.g
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.5"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <circle cx="200" cy="200" r="90" strokeDasharray="8 12" />
                <circle cx="200" cy="200" r="140" strokeDasharray="5 15" />
              </motion.g>

              {/* Glass stress pattern overlay */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                transition={{ delay: 0.25 }}
              >
                <pattern id="stressPattern" patternUnits="userSpaceOnUse" width="20" height="20">
                  <path d="M0,10 L20,10 M10,0 L10,20" stroke="white" strokeWidth="0.3" />
                </pattern>
                <circle cx="200" cy="200" r="100" fill="url(#stressPattern)" />
              </motion.g>
            </motion.svg>

            {/* Glass surface cracks - additional layer for depth */}
            <div 
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(circle at 50% 50%, transparent 5%, rgba(255,255,255,0.02) 6%, transparent 7%),
                  radial-gradient(circle at 50% 50%, transparent 12%, rgba(255,255,255,0.015) 13%, transparent 14%),
                  radial-gradient(circle at 50% 50%, transparent 20%, rgba(255,255,255,0.01) 21%, transparent 22%)
                `,
              }}
            />
          </div>
        )}

        {/* Flying Glass Shards - physics-based */}
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
                  opacity: [0, shard.opacity, shard.opacity * 0.8, 0]
                }}
                transition={{ 
                  duration: 2.5,
                  delay: shard.delay,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  opacity: { duration: 3, times: [0, 0.1, 0.6, 1] }
                }}
              >
                <div 
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(${135 + shard.id * 15}deg, 
                      rgba(255,255,255,${0.6 + shard.opacity * 0.3}) 0%, 
                      rgba(200,210,255,${0.3 + shard.opacity * 0.2}) 40%,
                      rgba(255,255,255,${0.1 + shard.opacity * 0.1}) 100%)`,
                    clipPath: shard.clipPath,
                    boxShadow: `
                      0 0 ${5 + shard.opacity * 10}px rgba(255,255,255,${shard.opacity * 0.3}),
                      inset 0 0 ${3 + shard.opacity * 5}px rgba(255,255,255,${shard.opacity * 0.2})
                    `,
                  }}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* "HELLO!" Text - Premium Typography */}
        <motion.div
          className="absolute left-1/2 top-1/2 pointer-events-none select-none"
          style={{ 
            x: '-50%',
            y: '-50%',
            perspective: 1200,
          }}
          initial={{ 
            scale: 0.1,
            opacity: 0,
            rotateX: 45,
            z: -800,
          }}
          animate={{
            scale: phase === 'idle' ? 0.1 : 
                   phase === 'anticipation' ? 0.6 : 
                   phase === 'impact' ? 1.15 : 1,
            opacity: phase === 'idle' ? 0 : 1,
            rotateX: phase === 'anticipation' ? 20 : 0,
            z: phase === 'impact' ? 100 : 0,
            y: phase === 'pointing' || phase === 'spotlight' ? '-65%' : '-50%',
          }}
          transition={{
            type: "spring",
            stiffness: phase === 'impact' ? 400 : 120,
            damping: phase === 'impact' ? 12 : 20,
          }}
        >
          {/* Multi-layer glow for depth */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute inset-0 blur-[100px]"
              style={{
                background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(59,130,246,0.3) 40%, transparent 70%)',
                transform: 'scale(3)',
              }}
              animate={{
                opacity: phase === 'spotlight' ? 0.8 : 0.5,
              }}
            />
            <motion.div
              className="absolute inset-0 blur-[40px]"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 50%)',
                transform: 'scale(2)',
              }}
              animate={{
                opacity: phase === 'impact' ? 1 : 0.6,
              }}
            />
          </div>

          {/* Main text - matches APEX STUDIO typography */}
          <h1
            className="relative text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[-0.04em] leading-none"
            style={{
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            <motion.span 
              className="inline-block bg-gradient-to-br from-white via-white to-white/80 bg-clip-text text-transparent"
              style={{
                textShadow: `
                  0 0 40px rgba(255,255,255,0.4),
                  0 0 80px rgba(139,92,246,0.3),
                  0 4px 20px rgba(0,0,0,0.5)
                `,
                WebkitTextStroke: '0.5px rgba(255,255,255,0.1)',
              }}
              animate={{
                scale: phase === 'impact' ? [1, 1.08, 1] : 1,
              }}
              transition={{ duration: 0.25 }}
            >
              Hello!
            </motion.span>
          </h1>

          {/* CTA Message */}
          {(phase === 'pointing' || phase === 'spotlight') && (
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
              style={{ top: '100%', marginTop: 32 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <p className="text-white/70 text-lg md:text-xl font-medium tracking-wide">
                Ready to create something amazing?
              </p>
              <motion.div
                className="text-3xl"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                ↓
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Spotlight on CTA Button */}
        {phase === 'spotlight' && buttonRect && (
          <>
            {/* Spotlight cone */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: buttonRect.left + buttonRect.width / 2,
                top: buttonRect.top + buttonRect.height / 2,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div 
                className="absolute rounded-full"
                style={{
                  width: buttonRect.width + 100,
                  height: buttonRect.height + 100,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)',
                  boxShadow: '0 0 120px 60px rgba(139,92,246,0.15)',
                }}
              />
            </motion.div>

            {/* Elevated CTA button */}
            <motion.button
              className="absolute z-[101] px-6 py-3 text-base font-semibold rounded-full cursor-pointer border border-white/20"
              style={{
                left: buttonRect.left,
                top: buttonRect.top,
                width: buttonRect.width,
                height: buttonRect.height,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,240,255,0.9) 100%)',
                color: '#000',
                boxShadow: `
                  0 0 40px rgba(255,255,255,0.5),
                  0 0 80px rgba(139,92,246,0.4),
                  0 8px 32px rgba(0,0,0,0.3)
                `,
              }}
              initial={{ scale: 1 }}
              animate={{ 
                scale: [1, 1.03, 1],
                boxShadow: [
                  '0 0 40px rgba(255,255,255,0.5), 0 0 80px rgba(139,92,246,0.4), 0 8px 32px rgba(0,0,0,0.3)',
                  '0 0 60px rgba(255,255,255,0.7), 0 0 100px rgba(139,92,246,0.5), 0 12px 40px rgba(0,0,0,0.3)',
                  '0 0 40px rgba(255,255,255,0.5), 0 0 80px rgba(139,92,246,0.4), 0 8px 32px rgba(0,0,0,0.3)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              onClick={handleSignUpClick}
            >
              Start Free
            </motion.button>
          </>
        )}

        {/* Dismiss hint - subtle */}
        {phase === 'spotlight' && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-sm tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            Click anywhere to dismiss
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

export default NovaConversionOverlay;
