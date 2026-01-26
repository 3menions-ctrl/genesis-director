import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  // Generate horizontal flowing lines
  const horizontalLines = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      y: 5 + (i * 8),
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 5,
      opacity: 0.03 + Math.random() * 0.05,
      height: 1 + Math.random() * 2,
    })), []
  );

  // Generate vertical accent lines
  const verticalLines = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 10 + (i * 15),
      duration: 4 + Math.random() * 3,
      delay: Math.random() * 4,
      opacity: 0.02 + Math.random() * 0.03,
    })), []
  );

  // Generate diagonal streaks
  const diagonalStreaks = useMemo(() => 
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      startY: Math.random() * 100,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 6,
      opacity: 0.04 + Math.random() * 0.04,
    })), []
  );

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Pure black base */}
      <div className="absolute inset-0 bg-black" />

      {/* Horizontal flowing lines */}
      {horizontalLines.map((line) => (
        <motion.div
          key={`h-${line.id}`}
          className="absolute left-0 right-0"
          style={{
            top: `${line.y}%`,
            height: `${line.height}px`,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,${line.opacity}), transparent)`,
          }}
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ 
            x: ['100%', '-100%'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: line.duration,
            delay: line.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Vertical flowing lines */}
      {verticalLines.map((line) => (
        <motion.div
          key={`v-${line.id}`}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: `${line.x}%`,
            background: `linear-gradient(180deg, transparent, rgba(255,255,255,${line.opacity}), transparent)`,
          }}
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{
            duration: line.duration,
            delay: line.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Diagonal light streaks */}
      {diagonalStreaks.map((streak) => (
        <motion.div
          key={`d-${streak.id}`}
          className="absolute w-[200%] h-px origin-left"
          style={{
            top: `${streak.startY}%`,
            left: '-50%',
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,${streak.opacity}) 20%, rgba(255,255,255,${streak.opacity * 1.5}) 50%, rgba(255,255,255,${streak.opacity}) 80%, transparent 100%)`,
            transform: 'rotate(-15deg)',
          }}
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ 
            x: '50%',
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: streak.duration,
            delay: streak.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Central glow pulse */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 50%)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Grid intersection points that pulse */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={`point-${i}`}
          className="absolute w-1 h-1 rounded-full bg-white"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            opacity: [0, 0.3, 0],
            scale: [0.5, 1.5, 0.5],
          }}
          transition={{
            duration: 3,
            delay: i * 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Subtle grain overlay */}
      <div 
        className="absolute inset-0 opacity-[0.012] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </div>
  );
}
