import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Deep black base */}
      <div className="absolute inset-0 bg-black" />

      {/* SVG container for flowing paths */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gradient definitions */}
          <linearGradient id="purpleBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0)" />
            <stop offset="30%" stopColor="rgba(139, 92, 246, 0.8)" />
            <stop offset="70%" stopColor="rgba(59, 130, 246, 0.8)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
          </linearGradient>
          
          <linearGradient id="pinkOrange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(236, 72, 153, 0)" />
            <stop offset="30%" stopColor="rgba(236, 72, 153, 0.7)" />
            <stop offset="70%" stopColor="rgba(251, 146, 60, 0.7)" />
            <stop offset="100%" stopColor="rgba(251, 146, 60, 0)" />
          </linearGradient>
          
          <linearGradient id="cyanGreen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0)" />
            <stop offset="30%" stopColor="rgba(34, 211, 238, 0.6)" />
            <stop offset="70%" stopColor="rgba(74, 222, 128, 0.6)" />
            <stop offset="100%" stopColor="rgba(74, 222, 128, 0)" />
          </linearGradient>
          
          {/* Strong glow filter */}
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Line 1 - Top area, purple to blue */}
        <motion.path
          d="M-200,200 C200,450 500,50 800,350 S1200,100 1500,400 S1800,150 2200,350"
          fill="none"
          stroke="url(#purpleBlue)"
          strokeWidth={6}
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Line 2 - Middle area, pink to orange */}
        <motion.path
          d="M-200,550 C150,250 450,700 800,400 S1150,700 1500,350 S1850,650 2200,400"
          fill="none"
          stroke="url(#pinkOrange)"
          strokeWidth={5}
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 10,
            delay: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Line 3 - Bottom area, cyan to green */}
        <motion.path
          d="M-200,850 C250,550 550,900 900,600 S1300,900 1600,550 S1900,800 2200,600"
          fill="none"
          stroke="url(#cyanGreen)"
          strokeWidth={4}
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 9,
            delay: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </svg>

      {/* Ambient glow spots */}
      <motion.div
        className="absolute top-[15%] left-[20%] w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        className="absolute bottom-[20%] right-[15%] w-[450px] h-[450px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, delay: 3 }}
      />

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />
    </div>
  );
}
