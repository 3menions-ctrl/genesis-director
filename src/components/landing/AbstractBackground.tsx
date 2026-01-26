import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  // Generate horizontal flowing lines - more visible
  const horizontalLines = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      y: 2 + (i * 5),
      duration: 2 + Math.random() * 2,
      delay: i * 0.3,
      width: 30 + Math.random() * 40,
    })), []
  );

  // Generate diagonal streaks
  const diagonalStreaks = useMemo(() => 
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      startY: -10 + (i * 8),
      duration: 1.5 + Math.random() * 2,
      delay: i * 0.4,
      length: 200 + Math.random() * 300,
    })), []
  );

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Pure black base */}
      <div className="absolute inset-0 bg-black" />

      {/* Horizontal racing lines */}
      {horizontalLines.map((line) => (
        <motion.div
          key={`h-${line.id}`}
          className="absolute h-[1px]"
          style={{
            top: `${line.y}%`,
            width: `${line.width}%`,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 20%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 80%, transparent 100%)',
            boxShadow: '0 0 10px rgba(255,255,255,0.3), 0 0 20px rgba(255,255,255,0.1)',
          }}
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ 
            x: '400%',
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: line.duration,
            delay: line.delay,
            repeat: Infinity,
            ease: 'easeOut',
            repeatDelay: 3,
          }}
        />
      ))}

      {/* Diagonal light streaks - shooting across */}
      {diagonalStreaks.map((streak) => (
        <motion.div
          key={`d-${streak.id}`}
          className="absolute h-[2px] origin-left"
          style={{
            top: `${streak.startY}%`,
            left: '-20%',
            width: `${streak.length}px`,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 10%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.15) 90%, transparent 100%)',
            transform: 'rotate(25deg)',
            boxShadow: '0 0 8px rgba(255,255,255,0.2)',
          }}
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ 
            x: '500%',
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: streak.duration,
            delay: streak.delay,
            repeat: Infinity,
            ease: 'linear',
            repeatDelay: 5,
          }}
        />
      ))}

      {/* Vertical accent lines */}
      {[15, 35, 55, 75, 90].map((x, i) => (
        <motion.div
          key={`v-${i}`}
          className="absolute w-[1px] h-[30%]"
          style={{
            left: `${x}%`,
            background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
          }}
          initial={{ y: '-100%' }}
          animate={{ y: '400%' }}
          transition={{
            duration: 3 + i * 0.5,
            delay: i * 0.8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Central ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Pulsing nodes at intersections */}
      {[
        { x: 20, y: 25 }, { x: 45, y: 40 }, { x: 70, y: 30 },
        { x: 30, y: 60 }, { x: 60, y: 70 }, { x: 85, y: 55 },
      ].map((pos, i) => (
        <motion.div
          key={`node-${i}`}
          className="absolute w-1 h-1 rounded-full bg-white"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
          }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0.5, 2, 0.5],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Subtle grain */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}
