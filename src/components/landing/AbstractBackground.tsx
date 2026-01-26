import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AbstractBackgroundProps {
  className?: string;
}

export default function AbstractBackground({ className }: AbstractBackgroundProps) {
  // Roller coaster style paths - curvy and dynamic
  const paths = [
    {
      d: "M-100,400 C100,100 300,700 500,300 S700,600 900,200 S1100,500 1300,250 S1500,450 1700,150 S1900,400 2100,200",
      color: "rgba(99, 102, 241, 0.6)", // Indigo
      width: 2,
      delay: 0,
      duration: 8,
    },
    {
      d: "M-100,500 C150,200 350,600 550,350 S750,550 950,250 S1150,600 1350,300 S1550,500 1750,200 S1950,450 2150,250",
      color: "rgba(168, 85, 247, 0.5)", // Purple
      width: 2.5,
      delay: 0.5,
      duration: 9,
    },
    {
      d: "M-100,300 C200,600 400,150 600,450 S800,200 1000,500 S1200,150 1400,400 S1600,250 1800,550 S2000,300 2200,500",
      color: "rgba(236, 72, 153, 0.5)", // Pink
      width: 1.5,
      delay: 1,
      duration: 10,
    },
    {
      d: "M-100,600 C100,300 300,550 500,200 S700,450 900,350 S1100,150 1300,450 S1500,200 1700,400 S1900,150 2100,350",
      color: "rgba(59, 130, 246, 0.4)", // Blue
      width: 2,
      delay: 1.5,
      duration: 11,
    },
    {
      d: "M-100,200 C200,500 400,250 600,550 S800,300 1000,450 S1200,200 1400,550 S1600,350 1800,200 S2000,500 2200,300",
      color: "rgba(34, 211, 238, 0.4)", // Cyan
      width: 1.5,
      delay: 2,
      duration: 12,
    },
  ];

  // Secondary accent lines
  const accentPaths = [
    {
      d: "M-50,350 Q200,100 450,400 T900,250 T1350,450 T1800,200 T2250,400",
      color: "rgba(251, 146, 60, 0.3)", // Orange
      delay: 0.3,
    },
    {
      d: "M-50,550 Q250,300 500,550 T950,300 T1400,500 T1850,250 T2300,450",
      color: "rgba(74, 222, 128, 0.25)", // Green
      delay: 0.8,
    },
  ];

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
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0)" />
            <stop offset="20%" stopColor="rgba(99, 102, 241, 0.6)" />
            <stop offset="50%" stopColor="rgba(168, 85, 247, 0.8)" />
            <stop offset="80%" stopColor="rgba(236, 72, 153, 0.6)" />
            <stop offset="100%" stopColor="rgba(236, 72, 153, 0)" />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
            <stop offset="30%" stopColor="rgba(59, 130, 246, 0.5)" />
            <stop offset="70%" stopColor="rgba(34, 211, 238, 0.5)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
          </linearGradient>
          <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(168, 85, 247, 0)" />
            <stop offset="40%" stopColor="rgba(168, 85, 247, 0.6)" />
            <stop offset="60%" stopColor="rgba(251, 146, 60, 0.5)" />
            <stop offset="100%" stopColor="rgba(251, 146, 60, 0)" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Main flowing lines */}
        {paths.map((path, i) => (
          <motion.path
            key={`path-${i}`}
            d={path.d}
            fill="none"
            stroke={path.color}
            strokeWidth={path.width}
            strokeLinecap="round"
            filter="url(#glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 1, 0],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: path.duration,
              delay: path.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Accent flowing lines */}
        {accentPaths.map((path, i) => (
          <motion.path
            key={`accent-${i}`}
            d={path.d}
            fill="none"
            stroke={path.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 1, 0] }}
            transition={{
              duration: 15,
              delay: path.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Gradient ribbon lines */}
        <motion.path
          d="M-100,450 C200,150 400,650 700,300 S1000,550 1300,200 S1600,500 1900,250 S2100,450 2300,300"
          fill="none"
          stroke="url(#gradient1)"
          strokeWidth={3}
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.path
          d="M-100,650 C150,350 400,700 650,400 S950,650 1200,350 S1500,600 1750,300 S2000,550 2250,350"
          fill="none"
          stroke="url(#gradient2)"
          strokeWidth={2.5}
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ 
            pathLength: [0, 1],
            opacity: [0, 0.8, 0.8, 0],
          }}
          transition={{
            duration: 7,
            delay: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.path
          d="M-100,250 C250,550 500,200 750,500 S1050,250 1300,550 S1600,200 1850,500 S2100,250 2350,450"
          fill="none"
          stroke="url(#gradient3)"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ 
            pathLength: [0, 1],
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            duration: 8,
            delay: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </svg>

      {/* Ambient glow spots */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 10, repeat: Infinity, delay: 2 }}
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
