import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';

interface ScreenCrashOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
}

// Pre-computed glass shards - deterministic positions for stability
// Each shard has: id, clipPath (triangle), initial position, animation target
const GLASS_SHARDS = [
  // Center impact shards - fly outward dramatically
  { id: 1, x: 50, y: 50, size: 120, rotation: 0, delay: 0, targetX: -400, targetY: -300, targetZ: 800, rotateX: 45, rotateY: -30 },
  { id: 2, x: 50, y: 50, size: 100, rotation: 72, delay: 0.02, targetX: 350, targetY: -250, targetZ: 700, rotateX: -35, rotateY: 45 },
  { id: 3, x: 50, y: 50, size: 110, rotation: 144, delay: 0.04, targetX: -300, targetY: 400, targetZ: 600, rotateX: 60, rotateY: 20 },
  { id: 4, x: 50, y: 50, size: 95, rotation: 216, delay: 0.06, targetX: 450, targetY: 350, targetZ: 750, rotateX: -50, rotateY: -40 },
  { id: 5, x: 50, y: 50, size: 105, rotation: 288, delay: 0.08, targetX: -200, targetY: -450, targetZ: 650, rotateX: 40, rotateY: 55 },
  
  // Inner ring shards
  { id: 6, x: 35, y: 35, size: 80, rotation: 15, delay: 0.1, targetX: -500, targetY: -400, targetZ: 500, rotateX: 30, rotateY: -60 },
  { id: 7, x: 65, y: 35, size: 85, rotation: 45, delay: 0.12, targetX: 550, targetY: -350, targetZ: 550, rotateX: -45, rotateY: 35 },
  { id: 8, x: 65, y: 65, size: 75, rotation: 90, delay: 0.14, targetX: 480, targetY: 420, targetZ: 480, rotateX: 55, rotateY: 25 },
  { id: 9, x: 35, y: 65, size: 90, rotation: 135, delay: 0.16, targetX: -520, targetY: 380, targetZ: 520, rotateX: -40, rotateY: -50 },
  
  // Outer ring shards - larger, slower
  { id: 10, x: 20, y: 25, size: 140, rotation: 10, delay: 0.18, targetX: -600, targetY: -500, targetZ: 400, rotateX: 25, rotateY: -45 },
  { id: 11, x: 80, y: 25, size: 130, rotation: 60, delay: 0.2, targetX: 650, targetY: -480, targetZ: 450, rotateX: -30, rotateY: 50 },
  { id: 12, x: 85, y: 55, size: 125, rotation: 100, delay: 0.22, targetX: 700, targetY: 200, targetZ: 380, rotateX: 35, rotateY: 40 },
  { id: 13, x: 80, y: 80, size: 135, rotation: 150, delay: 0.24, targetX: 580, targetY: 550, targetZ: 420, rotateX: 50, rotateY: -35 },
  { id: 14, x: 50, y: 85, size: 120, rotation: 180, delay: 0.26, targetX: 100, targetY: 600, targetZ: 350, rotateX: -55, rotateY: 15 },
  { id: 15, x: 20, y: 80, size: 130, rotation: 210, delay: 0.28, targetX: -550, targetY: 520, targetZ: 400, rotateX: 45, rotateY: -55 },
  { id: 16, x: 15, y: 50, size: 140, rotation: 250, delay: 0.3, targetX: -680, targetY: 50, targetZ: 380, rotateX: -35, rotateY: 60 },
  
  // Edge pieces - long, thin shards
  { id: 17, x: 10, y: 10, size: 160, rotation: 30, delay: 0.32, targetX: -750, targetY: -600, targetZ: 300, rotateX: 20, rotateY: -70 },
  { id: 18, x: 90, y: 10, size: 150, rotation: 330, delay: 0.34, targetX: 800, targetY: -550, targetZ: 320, rotateX: -25, rotateY: 65 },
  { id: 19, x: 90, y: 90, size: 155, rotation: 120, delay: 0.36, targetX: 720, targetY: 650, targetZ: 280, rotateX: 60, rotateY: 30 },
  { id: 20, x: 10, y: 90, size: 145, rotation: 240, delay: 0.38, targetX: -780, targetY: 600, targetZ: 300, rotateX: -50, rotateY: -45 },
  
  // Tiny debris particles
  { id: 21, x: 45, y: 45, size: 40, rotation: 25, delay: 0.05, targetX: -150, targetY: -180, targetZ: 900, rotateX: 90, rotateY: 90 },
  { id: 22, x: 55, y: 45, size: 35, rotation: 50, delay: 0.07, targetX: 180, targetY: -160, targetZ: 850, rotateX: -80, rotateY: 85 },
  { id: 23, x: 55, y: 55, size: 38, rotation: 80, delay: 0.09, targetX: 160, targetY: 200, targetZ: 880, rotateX: 75, rotateY: -90 },
  { id: 24, x: 45, y: 55, size: 42, rotation: 110, delay: 0.11, targetX: -170, targetY: 190, targetZ: 820, rotateX: -85, rotateY: 80 },
];

// Generate clip-path for triangular shard
const getShardClipPath = (rotation: number): string => {
  const angle1 = rotation;
  const angle2 = rotation + 120;
  const angle3 = rotation + 240;
  
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const x1 = 50 + 50 * Math.cos(toRad(angle1));
  const y1 = 50 + 50 * Math.sin(toRad(angle1));
  const x2 = 50 + 50 * Math.cos(toRad(angle2));
  const y2 = 50 + 50 * Math.sin(toRad(angle2));
  const x3 = 50 + 50 * Math.cos(toRad(angle3));
  const y3 = 50 + 50 * Math.sin(toRad(angle3));
  
  return `polygon(${x1}% ${y1}%, ${x2}% ${y2}%, ${x3}% ${y3}%)`;
};

type Phase = 'idle' | 'impact' | 'shatter' | 'reveal' | 'cta';

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

    // Start with impact
    setPhase('impact');

    const timers: NodeJS.Timeout[] = [];

    // Shatter after impact flash
    timers.push(setTimeout(() => setPhase('shatter'), 150));
    
    // Reveal black void
    timers.push(setTimeout(() => setPhase('reveal'), 800));
    
    // Show CTA
    timers.push(setTimeout(() => setPhase('cta'), 1500));

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  const handleSignUp = useCallback(() => {
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
        className="fixed inset-0 z-[100]"
        style={{ perspective: '1500px', perspectiveOrigin: '50% 50%' }}
        onClick={handleOverlayClick}
      >
        {/* Pitch black void behind */}
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== 'idle' ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Impact flash */}
        {phase === 'impact' && (
          <motion.div
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.15, times: [0, 0.3, 1] }}
          />
        )}

        {/* Glass shards container */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: 'translateZ(0)',
          }}
        >
          {GLASS_SHARDS.map((shard) => {
            const isShattered = phase === 'shatter' || phase === 'reveal' || phase === 'cta';
            
            return (
              <motion.div
                key={shard.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${shard.x}%`,
                  top: `${shard.y}%`,
                  width: shard.size,
                  height: shard.size,
                  marginLeft: -shard.size / 2,
                  marginTop: -shard.size / 2,
                  transformStyle: 'preserve-3d',
                  clipPath: getShardClipPath(shard.rotation),
                  willChange: 'transform, opacity',
                }}
                initial={{
                  x: 0,
                  y: 0,
                  z: 0,
                  rotateX: 0,
                  rotateY: 0,
                  rotateZ: 0,
                  opacity: 1,
                }}
                animate={isShattered ? {
                  x: shard.targetX,
                  y: shard.targetY,
                  z: shard.targetZ,
                  rotateX: shard.rotateX * 3,
                  rotateY: shard.rotateY * 3,
                  rotateZ: shard.rotation + 180,
                  opacity: phase === 'cta' ? 0 : 1,
                } : {
                  x: 0,
                  y: 0,
                  z: 0,
                  rotateX: 0,
                  rotateY: 0,
                  rotateZ: 0,
                  opacity: 1,
                }}
                transition={{
                  duration: 1.2,
                  delay: shard.delay,
                  ease: [0.23, 1, 0.32, 1], // Cubic bezier for natural physics
                  opacity: { duration: 0.5, delay: phase === 'cta' ? 0.5 + shard.delay : 0 }
                }}
              >
                {/* Glass shard with realistic gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `
                      linear-gradient(
                        ${135 + shard.rotation}deg,
                        rgba(255, 255, 255, 0.15) 0%,
                        rgba(255, 255, 255, 0.05) 30%,
                        rgba(200, 220, 255, 0.08) 50%,
                        rgba(255, 255, 255, 0.12) 70%,
                        rgba(255, 255, 255, 0.2) 100%
                      )
                    `,
                    backdropFilter: 'blur(2px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: `
                      inset 0 0 20px rgba(255, 255, 255, 0.1),
                      0 0 30px rgba(255, 255, 255, 0.05)
                    `,
                  }}
                />
                
                {/* Sharp edge highlight */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(${shard.rotation}deg, rgba(255,255,255,0.4) 0%, transparent 5%, transparent 95%, rgba(255,255,255,0.3) 100%)`,
                  }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Crack lines radiating from center */}
        {(phase === 'impact' || phase === 'shatter' || phase === 'reveal') && (
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <defs>
              <filter id="crack-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Radial crack lines */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const length = 800 + (i % 3) * 200;
              const x2 = 50 + (length / 10) * Math.cos(rad);
              const y2 = 50 + (length / 10) * Math.sin(rad);
              
              return (
                <motion.line
                  key={angle}
                  x1="50%"
                  y1="50%"
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgba(255, 255, 255, 0.6)"
                  strokeWidth="1.5"
                  filter="url(#crack-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: phase === 'shatter' || phase === 'reveal' ? 1 : 0.8,
                    opacity: 1
                  }}
                  transition={{ 
                    duration: 0.3, 
                    delay: i * 0.02
                  }}
                />
              );
            })}
            
            {/* Concentric crack circles */}
            {[15, 30, 50].map((radius, i) => (
              <motion.circle
                key={radius}
                cx="50%"
                cy="50%"
                r={`${radius}%`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="1"
                strokeDasharray="20 10"
                filter="url(#crack-glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: 1,
                  opacity: 1
                }}
                transition={{ 
                  duration: 0.4, 
                  delay: 0.1 + i * 0.1
                }}
              />
            ))}
          </svg>
        )}

        {/* Impact point glow */}
        {(phase === 'impact' || phase === 'shatter' || phase === 'reveal') && (
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: phase === 'impact' ? [0, 2, 1.5] : 1.5,
              opacity: [0, 1, 0.6]
            }}
            transition={{ duration: 0.4 }}
          >
            <div 
              className="w-64 h-64 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 40%, transparent 70%)',
                filter: 'blur(20px)',
              }}
            />
          </motion.div>
        )}

        {/* CTA Content */}
        {phase === 'cta' && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.h2
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white text-center mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Break Through
            </motion.h2>
            
            <motion.p
              className="text-lg md:text-xl text-white/60 text-center max-w-md mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Create videos that shatter expectations
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Button
                onClick={handleSignUp}
                size="lg"
                className="h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.3)] transition-all duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.5)]"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Creating Free
              </Button>
            </motion.div>
            
            {/* Dismiss hint */}
            <motion.p
              className="absolute bottom-8 text-white/30 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              Click anywhere to dismiss
            </motion.p>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
});

export default ScreenCrashOverlay;
