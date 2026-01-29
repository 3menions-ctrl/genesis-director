import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { forwardRef, useEffect, useState } from 'react';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface AppLoaderProps {
  message?: string;
  className?: string;
}

const CINEMATIC_MESSAGES = [
  'Initializing studio...',
  'Loading creative engine...',
  'Preparing your workspace...',
];

// Pre-computed particle positions for deterministic animations
const PARTICLE_POSITIONS = [
  { angle: 0, delay: 0 },
  { angle: 45, delay: 0.2 },
  { angle: 90, delay: 0.4 },
  { angle: 135, delay: 0.6 },
  { angle: 180, delay: 0.8 },
  { angle: 225, delay: 1.0 },
  { angle: 270, delay: 1.2 },
  { angle: 315, delay: 1.4 },
];

// Pre-computed light ray positions
const LIGHT_RAYS = [
  { left: '15%', rotate: -10, duration: 4, delay: 0 },
  { left: '30%', rotate: -5, duration: 4.5, delay: 0.3 },
  { left: '45%', rotate: 0, duration: 5, delay: 0.6 },
  { left: '60%', rotate: 5, duration: 4.7, delay: 0.9 },
  { left: '75%', rotate: 10, duration: 5.2, delay: 1.2 },
  { left: '90%', rotate: 15, duration: 4.3, delay: 1.5 },
];

export const AppLoader = forwardRef<HTMLDivElement, AppLoaderProps>(
  function AppLoader({ message, className }, ref) {
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const displayMessage = message || CINEMATIC_MESSAGES[currentMessageIndex];

    useEffect(() => {
      if (message) return;
      
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % CINEMATIC_MESSAGES.length);
      }, 2000);
      
      return () => clearInterval(interval);
    }, [message]);

    return (
      <div 
        ref={ref}
        className={cn(
          "fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden",
          className
        )}
      >
        {/* Premium background - single motion for entry, then static */}
        <motion.div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${landingAbstractBg})` }}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.4, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-primary/20" />
        
        {/* Elegant light rays - CSS animated */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          {LIGHT_RAYS.map((ray, i) => (
            <div
              key={i}
              className="absolute w-1 h-[200%] bg-gradient-to-b from-transparent via-white/30 to-transparent animate-loader-light-ray will-change-transform"
              style={{
                left: ray.left,
                top: '-50%',
                transform: `rotate(${ray.rotate}deg)`,
                animationDuration: `${ray.duration}s`,
                animationDelay: `${ray.delay}s`,
              }}
            />
          ))}
        </div>
        
        {/* Premium film grain - CSS animated */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none animate-loader-grain will-change-auto"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
          }}
        />
        
        <div className="relative flex flex-col items-center gap-10">
          {/* Logo with CSS-animated effects */}
          <div className="relative">
            {/* Orbiting particles - CSS animated */}
            {PARTICLE_POSITIONS.map((pos, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-white/40 animate-loader-particle will-change-transform"
                style={{
                  left: '50%',
                  top: '50%',
                  '--particle-end': `translate(${Math.cos((pos.angle * Math.PI) / 180) * 60}px, ${Math.sin((pos.angle * Math.PI) / 180) * 60}px)`,
                  animationDelay: `${pos.delay}s`,
                } as React.CSSProperties}
              />
            ))}
            
            {/* Pulsing outer ring - CSS animated */}
            <div className="absolute inset-[-30px] rounded-full border border-white/10 animate-loader-ring-pulse will-change-transform" />
            
            {/* Secondary ring - CSS animated */}
            <div 
              className="absolute inset-[-20px] rounded-full border border-white/5 animate-loader-ring-pulse will-change-transform"
              style={{ animationDelay: '0.5s' }}
            />
            
            {/* Main logo container with glow */}
            <motion.div 
              className="relative w-24 h-24"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-loader-glow will-change-opacity" />
              
              {/* Logo background */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 backdrop-blur-sm border border-white/10" />
              
              {/* Logo icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg 
                  viewBox="0 0 48 48" 
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  {/* Film camera stylized icon */}
                  <path d="M8 16h24a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" />
                  <path d="M36 22l8-4v12l-8-4" />
                  <circle cx="14" cy="26" r="4" />
                  <circle cx="26" cy="26" r="3" />
                  <path d="M4 12h32" strokeLinecap="round" />
                </svg>
              </div>
            </motion.div>
          </div>
          
          {/* Loading text with elegant animation */}
          <motion.div 
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {/* Animated message */}
            <AnimatePresence mode="wait">
              <motion.p
                key={displayMessage}
                className="text-white/90 text-lg font-light tracking-wide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {displayMessage}
              </motion.p>
            </AnimatePresence>
            
            {/* Minimal elegant progress bar */}
            <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary via-primary to-primary/50 rounded-full animate-loader-progress will-change-transform origin-left" 
              />
            </div>
            
            {/* Brand tagline */}
            <motion.p
              className="text-white/40 text-xs tracking-[0.2em] uppercase mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              Cinema-Grade AI Video
            </motion.p>
          </motion.div>
        </div>
      </div>
    );
  }
);

AppLoader.displayName = 'AppLoader';
