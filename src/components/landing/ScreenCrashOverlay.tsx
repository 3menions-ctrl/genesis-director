import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScreenCrashOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
}

// Pre-computed glass shards - more shards for realism, varied sizes
const GLASS_SHARDS = [
  // Large center impact shards - dramatic outward explosion
  { id: 1, x: 50, y: 50, size: 180, rotation: 0, delay: 0, targetX: -600, targetY: -450, targetZ: 1200, rotateX: 55, rotateY: -40, spin: 720 },
  { id: 2, x: 50, y: 50, size: 160, rotation: 72, delay: 0.03, targetX: 550, targetY: -380, targetZ: 1100, rotateX: -45, rotateY: 55, spin: -640 },
  { id: 3, x: 50, y: 50, size: 170, rotation: 144, delay: 0.06, targetX: -480, targetY: 520, targetZ: 1000, rotateX: 70, rotateY: 30, spin: 580 },
  { id: 4, x: 50, y: 50, size: 150, rotation: 216, delay: 0.09, targetX: 620, targetY: 480, targetZ: 1150, rotateX: -60, rotateY: -50, spin: -700 },
  { id: 5, x: 50, y: 50, size: 165, rotation: 288, delay: 0.12, targetX: -320, targetY: -600, targetZ: 950, rotateX: 50, rotateY: 65, spin: 620 },
  
  // Inner ring - medium shards
  { id: 6, x: 35, y: 35, size: 120, rotation: 15, delay: 0.15, targetX: -700, targetY: -550, targetZ: 800, rotateX: 40, rotateY: -70, spin: 540 },
  { id: 7, x: 65, y: 35, size: 130, rotation: 45, delay: 0.18, targetX: 750, targetY: -480, targetZ: 850, rotateX: -55, rotateY: 45, spin: -500 },
  { id: 8, x: 65, y: 65, size: 115, rotation: 90, delay: 0.21, targetX: 680, targetY: 580, targetZ: 780, rotateX: 65, rotateY: 35, spin: 480 },
  { id: 9, x: 35, y: 65, size: 135, rotation: 135, delay: 0.24, targetX: -720, targetY: 520, targetZ: 820, rotateX: -50, rotateY: -60, spin: -520 },
  
  // Mid ring - varied sizes
  { id: 10, x: 25, y: 30, size: 140, rotation: 20, delay: 0.27, targetX: -850, targetY: -650, targetZ: 650, rotateX: 35, rotateY: -55, spin: 420 },
  { id: 11, x: 75, y: 30, size: 125, rotation: 55, delay: 0.30, targetX: 900, targetY: -600, targetZ: 700, rotateX: -40, rotateY: 60, spin: -460 },
  { id: 12, x: 80, y: 55, size: 110, rotation: 85, delay: 0.33, targetX: 950, targetY: 250, targetZ: 620, rotateX: 45, rotateY: 50, spin: 380 },
  { id: 13, x: 75, y: 75, size: 145, rotation: 120, delay: 0.36, targetX: 800, targetY: 700, targetZ: 680, rotateX: 60, rotateY: -45, spin: -440 },
  { id: 14, x: 50, y: 82, size: 130, rotation: 160, delay: 0.39, targetX: 150, targetY: 800, targetZ: 580, rotateX: -65, rotateY: 25, spin: 400 },
  { id: 15, x: 25, y: 75, size: 140, rotation: 195, delay: 0.42, targetX: -750, targetY: 680, targetZ: 640, rotateX: 55, rotateY: -65, spin: -420 },
  { id: 16, x: 18, y: 50, size: 150, rotation: 235, delay: 0.45, targetX: -920, targetY: 80, targetZ: 600, rotateX: -45, rotateY: 70, spin: 380 },
  
  // Outer ring - large dramatic pieces
  { id: 17, x: 10, y: 15, size: 190, rotation: 30, delay: 0.48, targetX: -1000, targetY: -800, targetZ: 500, rotateX: 30, rotateY: -80, spin: 320 },
  { id: 18, x: 90, y: 15, size: 175, rotation: 330, delay: 0.51, targetX: 1050, targetY: -750, targetZ: 520, rotateX: -35, rotateY: 75, spin: -360 },
  { id: 19, x: 92, y: 85, size: 185, rotation: 110, delay: 0.54, targetX: 980, targetY: 850, targetZ: 480, rotateX: 70, rotateY: 40, spin: 340 },
  { id: 20, x: 8, y: 88, size: 170, rotation: 225, delay: 0.57, targetX: -1020, targetY: 820, targetZ: 500, rotateX: -60, rotateY: -55, spin: -380 },
  
  // Small debris - fast moving
  { id: 21, x: 48, y: 48, size: 50, rotation: 25, delay: 0.08, targetX: -220, targetY: -280, targetZ: 1400, rotateX: 100, rotateY: 100, spin: 900 },
  { id: 22, x: 52, y: 48, size: 45, rotation: 50, delay: 0.11, targetX: 260, targetY: -240, targetZ: 1350, rotateX: -90, rotateY: 95, spin: -850 },
  { id: 23, x: 52, y: 52, size: 48, rotation: 80, delay: 0.14, targetX: 230, targetY: 300, targetZ: 1380, rotateX: 85, rotateY: -100, spin: 820 },
  { id: 24, x: 48, y: 52, size: 52, rotation: 110, delay: 0.17, targetX: -250, targetY: 270, targetZ: 1320, rotateX: -95, rotateY: 90, spin: -880 },
  { id: 25, x: 45, y: 45, size: 40, rotation: 140, delay: 0.10, targetX: -180, targetY: -200, targetZ: 1450, rotateX: 110, rotateY: -85, spin: 950 },
  { id: 26, x: 55, y: 55, size: 42, rotation: 170, delay: 0.13, targetX: 200, targetY: 220, targetZ: 1420, rotateX: -105, rotateY: 80, spin: -920 },
  
  // Additional edge shards for completeness
  { id: 27, x: 5, y: 50, size: 160, rotation: 260, delay: 0.60, targetX: -1100, targetY: 100, targetZ: 450, rotateX: 25, rotateY: -85, spin: 280 },
  { id: 28, x: 95, y: 50, size: 155, rotation: 280, delay: 0.63, targetX: 1080, targetY: -50, targetZ: 470, rotateX: -30, rotateY: 80, spin: -300 },
  { id: 29, x: 50, y: 5, size: 165, rotation: 10, delay: 0.66, targetX: 50, targetY: -900, targetZ: 430, rotateX: 20, rotateY: 15, spin: 260 },
  { id: 30, x: 50, y: 95, size: 170, rotation: 190, delay: 0.69, targetX: -80, targetY: 920, targetZ: 440, rotateX: -25, rotateY: -20, spin: -280 },
  
  // Micro debris for realism
  { id: 31, x: 47, y: 50, size: 30, rotation: 35, delay: 0.05, targetX: -120, targetY: 50, targetZ: 1500, rotateX: 120, rotateY: 120, spin: 1100 },
  { id: 32, x: 53, y: 50, size: 28, rotation: 65, delay: 0.07, targetX: 140, targetY: -30, targetZ: 1480, rotateX: -115, rotateY: 110, spin: -1050 },
  { id: 33, x: 50, y: 47, size: 32, rotation: 95, delay: 0.09, targetX: 40, targetY: -150, targetZ: 1520, rotateX: 125, rotateY: -105, spin: 1000 },
  { id: 34, x: 50, y: 53, size: 35, rotation: 125, delay: 0.11, targetX: -60, targetY: 160, targetZ: 1460, rotateX: -130, rotateY: 100, spin: -980 },
];

// Generate clip-path for triangular/irregular shard
const getShardClipPath = (rotation: number, id: number): string => {
  // Vary the polygon shape based on id for more organic look
  const variance = (id % 5) * 8;
  const angle1 = rotation + variance;
  const angle2 = rotation + 110 + (id % 3) * 10;
  const angle3 = rotation + 230 - (id % 4) * 8;
  
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const r1 = 45 + (id % 3) * 5;
  const r2 = 48 + (id % 4) * 4;
  const r3 = 42 + (id % 5) * 6;
  
  const x1 = 50 + r1 * Math.cos(toRad(angle1));
  const y1 = 50 + r1 * Math.sin(toRad(angle1));
  const x2 = 50 + r2 * Math.cos(toRad(angle2));
  const y2 = 50 + r2 * Math.sin(toRad(angle2));
  const x3 = 50 + r3 * Math.cos(toRad(angle3));
  const y3 = 50 + r3 * Math.sin(toRad(angle3));
  
  return `polygon(${x1}% ${y1}%, ${x2}% ${y2}%, ${x3}% ${y3}%)`;
};

type Phase = 'idle' | 'impact' | 'shatter' | 'hold';

const ScreenCrashOverlay = memo(function ScreenCrashOverlay({
  isActive,
  onDismiss
}: ScreenCrashOverlayProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Animation sequence - slower, more dramatic
  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    // Start with impact
    setPhase('impact');

    const timers: NodeJS.Timeout[] = [];

    // Shatter after impact flash - slightly longer impact
    timers.push(setTimeout(() => setPhase('shatter'), 200));
    
    // Hold the shattered state
    timers.push(setTimeout(() => setPhase('hold'), 4000));

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
        style={{ perspective: '2000px', perspectiveOrigin: '50% 50%' }}
        onClick={handleOverlayClick}
      >
        {/* Deep black void behind */}
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== 'idle' ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Impact flash - bright white burst */}
        {phase === 'impact' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 20%, rgba(255,255,255,0) 60%)',
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.8, 0], scale: [0.5, 1.2, 1.5, 2] }}
            transition={{ duration: 0.2, times: [0, 0.3, 0.6, 1] }}
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
            const isShattered = phase === 'shatter' || phase === 'hold';
            
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
                  clipPath: getShardClipPath(shard.rotation, shard.id),
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
                  scale: 1,
                }}
                animate={isShattered ? {
                  x: shard.targetX,
                  y: shard.targetY,
                  z: shard.targetZ,
                  rotateX: shard.rotateX * 4,
                  rotateY: shard.rotateY * 4,
                  rotateZ: shard.spin,
                  opacity: phase === 'hold' ? 0 : 1,
                  scale: shard.size < 60 ? 0.5 : 0.8,
                } : {
                  x: 0,
                  y: 0,
                  z: 0,
                  rotateX: 0,
                  rotateY: 0,
                  rotateZ: 0,
                  opacity: 1,
                  scale: 1,
                }}
                transition={{
                  duration: 3.5,
                  delay: shard.delay,
                  ease: [0.16, 1, 0.3, 1], // Dramatic easing
                  opacity: { duration: 1.5, delay: phase === 'hold' ? 0.5 + shard.delay * 0.5 : 0 }
                }}
              >
                {/* Glass shard with realistic layered effect */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `
                      linear-gradient(
                        ${135 + shard.rotation}deg,
                        rgba(255, 255, 255, 0.25) 0%,
                        rgba(255, 255, 255, 0.08) 20%,
                        rgba(200, 220, 255, 0.12) 40%,
                        rgba(255, 255, 255, 0.05) 60%,
                        rgba(180, 200, 255, 0.15) 80%,
                        rgba(255, 255, 255, 0.3) 100%
                      )
                    `,
                    backdropFilter: 'blur(1px)',
                    boxShadow: `
                      inset 0 0 30px rgba(255, 255, 255, 0.15),
                      inset 0 1px 0 rgba(255, 255, 255, 0.4),
                      0 0 40px rgba(255, 255, 255, 0.08)
                    `,
                  }}
                />
                
                {/* Sharp edge highlight - top edge */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(${shard.rotation + 90}deg, rgba(255,255,255,0.6) 0%, transparent 3%, transparent 97%, rgba(255,255,255,0.4) 100%)`,
                  }}
                />
                
                {/* Internal fracture line */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(${shard.rotation + 45}deg, transparent 45%, rgba(255,255,255,0.3) 50%, transparent 55%)`,
                  }}
                />
                
                {/* Specular highlight */}
                <div
                  className="absolute"
                  style={{
                    top: '10%',
                    left: '15%',
                    width: '30%',
                    height: '20%',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 100%)',
                    borderRadius: '50%',
                    filter: 'blur(2px)',
                  }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Radial crack lines from impact point */}
        {(phase === 'impact' || phase === 'shatter') && (
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <defs>
              <filter id="crack-glow-intense">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Main radial cracks */}
            {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const length = 1200 + (i % 4) * 300;
              const x2 = 50 + (length / 12) * Math.cos(rad);
              const y2 = 50 + (length / 12) * Math.sin(rad);
              
              return (
                <motion.line
                  key={`crack-${angle}`}
                  x1="50%"
                  y1="50%"
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth="2"
                  filter="url(#crack-glow-intense)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: 1,
                    opacity: phase === 'shatter' ? [1, 0.6, 0.3] : 1
                  }}
                  transition={{ 
                    pathLength: { duration: 0.4, delay: i * 0.015 },
                    opacity: { duration: 2.5, delay: 0.5 }
                  }}
                />
              );
            })}
            
            {/* Secondary branching cracks */}
            {[15, 75, 135, 195, 255, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const startDist = 15;
              const endDist = 45;
              const x1 = 50 + startDist * Math.cos(rad);
              const y1 = 50 + startDist * Math.sin(rad);
              const branchAngle = rad + (i % 2 === 0 ? 0.4 : -0.4);
              const x2 = 50 + endDist * Math.cos(branchAngle);
              const y2 = 50 + endDist * Math.sin(branchAngle);
              
              return (
                <motion.line
                  key={`branch-${angle}`}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgba(255, 255, 255, 0.5)"
                  strokeWidth="1.5"
                  filter="url(#crack-glow-intense)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: 1,
                    opacity: phase === 'shatter' ? [1, 0.4, 0] : 1
                  }}
                  transition={{ 
                    pathLength: { duration: 0.3, delay: 0.15 + i * 0.02 },
                    opacity: { duration: 2, delay: 0.8 }
                  }}
                />
              );
            })}
            
            {/* Concentric stress rings */}
            {[8, 18, 32, 50].map((radius, i) => (
              <motion.circle
                key={`ring-${radius}`}
                cx="50%"
                cy="50%"
                r={`${radius}%`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.5)"
                strokeWidth="1.5"
                strokeDasharray="15 8 5 8"
                filter="url(#crack-glow-intense)"
                initial={{ pathLength: 0, opacity: 0, scale: 0.8 }}
                animate={{ 
                  pathLength: 1,
                  opacity: phase === 'shatter' ? [1, 0.5, 0.2] : 1,
                  scale: 1
                }}
                transition={{ 
                  pathLength: { duration: 0.5, delay: 0.08 + i * 0.08 },
                  opacity: { duration: 2.5, delay: 0.6 },
                  scale: { duration: 0.6, delay: 0.08 + i * 0.08 }
                }}
              />
            ))}
          </svg>
        )}

        {/* Central impact point - intense glow */}
        {(phase === 'impact' || phase === 'shatter') && (
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: phase === 'impact' ? [0, 3, 2] : [2, 2.5, 0],
              opacity: phase === 'impact' ? [0, 1, 0.8] : [0.8, 0.4, 0]
            }}
            transition={{ 
              duration: phase === 'impact' ? 0.2 : 2.5,
              ease: 'easeOut'
            }}
          >
            <div 
              className="w-48 h-48 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 30%, rgba(200,220,255,0.3) 60%, transparent 80%)',
                filter: 'blur(15px)',
              }}
            />
          </motion.div>
        )}

        {/* Dismiss hint - subtle */}
        {phase === 'hold' && (
          <motion.p
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-sm"
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
