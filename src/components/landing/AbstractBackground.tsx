import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Pure black base */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Subtle gradient sphere - top right */}
      <motion.div
        className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 50%)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Subtle gradient sphere - bottom left */}
      <motion.div
        className="absolute -bottom-[30%] -left-[30%] w-[70%] h-[70%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 50%)',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Floating line - horizontal */}
      <motion.div
        className="absolute top-[30%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
        animate={{
          opacity: [0, 0.5, 0],
          scaleX: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Floating line - diagonal */}
      <motion.div
        className="absolute top-0 bottom-0 left-[60%] w-px bg-gradient-to-b from-transparent via-white/[0.03] to-transparent"
        style={{ transform: 'rotate(15deg)' }}
        animate={{
          opacity: [0, 0.4, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />

      {/* Subtle grain overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}
