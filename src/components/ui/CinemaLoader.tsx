/**
 * CinemaLoader - Unified premium dark-themed loading component
 * 
 * THE SINGLE SOURCE OF TRUTH for all loading states in the application.
 * Features:
 * - Deep black background with subtle neon accents
 * - Cinematic camera icon with animated rings
 * - Smooth 0.3s fade transitions
 * - Memory cleanup for animations
 * - GPU-accelerated CSS animations
 */

import { memo, useEffect, useRef, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Pre-computed light ray positions for deterministic animations
const LIGHT_RAYS = [
  { left: '10%', rotate: -15, opacity: 0.06 },
  { left: '25%', rotate: -8, opacity: 0.08 },
  { left: '40%', rotate: -3, opacity: 0.1 },
  { left: '55%', rotate: 2, opacity: 0.1 },
  { left: '70%', rotate: 7, opacity: 0.08 },
  { left: '85%', rotate: 12, opacity: 0.06 },
];

// Camera icon SVG component
const CameraIcon = memo(function CameraIcon() {
  return (
    <svg 
      viewBox="0 0 48 48" 
      className="w-10 h-10 text-white/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Film camera body */}
      <rect x="6" y="16" width="28" height="20" rx="3" />
      {/* Lens viewfinder */}
      <circle cx="16" cy="26" r="5" />
      <circle cx="16" cy="26" r="2" />
      {/* Secondary lens */}
      <circle cx="28" cy="26" r="3" />
      {/* Viewfinder triangle */}
      <path d="M34 22l10 -5v14l-10 -5" />
      {/* Film reel on top */}
      <circle cx="12" cy="13" r="3" />
      <circle cx="24" cy="13" r="3" />
      <line x1="15" y1="13" x2="21" y2="13" />
    </svg>
  );
});

interface CinemaLoaderProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
  isVisible?: boolean;
  onExitComplete?: () => void;
  className?: string;
  variant?: 'fullscreen' | 'inline' | 'overlay';
}

export const CinemaLoader = memo(forwardRef<HTMLDivElement, CinemaLoaderProps>(
  function CinemaLoader({
    message = 'Loading...',
    progress = 0,
    showProgress = true,
    isVisible = true,
    onExitComplete,
    className,
    variant = 'fullscreen',
  }, ref) {
    const animationFrameRef = useRef<number>();
    const internalContainerRef = useRef<HTMLDivElement>(null);
    
    // Merge refs: support both internal and forwarded ref
    const containerRef = (ref as React.RefObject<HTMLDivElement>) || internalContainerRef;
  
  // Cleanup animation frames on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Force GPU layer creation for smooth animations
  const handleAnimationStart = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.willChange = 'opacity, transform';
    }
  }, []);

  // Clean up GPU hints after animation completes
  const handleAnimationComplete = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.willChange = 'auto';
    }
  }, []);

  const containerClasses = cn(
    "flex items-center justify-center overflow-hidden",
    variant === 'fullscreen' && "fixed inset-0 z-[9999]",
    variant === 'overlay' && "absolute inset-0 z-50",
    variant === 'inline' && "relative w-full min-h-[400px]",
    className
  );

  return (
    <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
      {isVisible && (
        <motion.div
          ref={containerRef}
          key="cinema-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          onAnimationStart={handleAnimationStart}
          onAnimationComplete={handleAnimationComplete}
          className={containerClasses}
          style={{ backgroundColor: '#030303' }}
        >
          {/* Deep black base with subtle gradient */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 30%, rgba(20, 10, 8, 0.4) 0%, transparent 60%), linear-gradient(180deg, #030303 0%, #050505 50%, #030303 100%)',
            }}
          />
          
          {/* Animated light rays */}
          <div className="absolute inset-0 overflow-hidden">
            {LIGHT_RAYS.map((ray, i) => (
              <div
                key={i}
                className="absolute w-px h-[200%] animate-cinema-ray will-change-transform"
                style={{
                  left: ray.left,
                  top: '-50%',
                  transform: `rotate(${ray.rotate}deg)`,
                  background: `linear-gradient(180deg, transparent 0%, rgba(255, 120, 80, ${ray.opacity}) 30%, rgba(255, 180, 140, ${ray.opacity * 1.5}) 50%, rgba(255, 120, 80, ${ray.opacity}) 70%, transparent 100%)`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>
          
          {/* Subtle ambient glow */}
          <div 
            className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(200, 100, 60, 0.08) 0%, transparent 60%)',
              filter: 'blur(60px)',
            }}
          />
          
          {/* Content container */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-6"
          >
            {/* Camera icon with animated rings */}
            <div className="relative">
              {/* Outer pulsing ring */}
              <div className="absolute inset-[-20px] rounded-full border border-white/[0.06] animate-cinema-ring-outer" />
              
              {/* Middle rotating ring */}
              <div className="absolute inset-[-12px] rounded-full border border-white/[0.08] animate-cinema-ring-middle" />
              
              {/* Inner glow ring */}
              <div className="absolute inset-[-4px] rounded-full border border-white/[0.12] animate-cinema-ring-inner" />
              
              {/* Main icon container */}
              <div 
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, rgba(200, 80, 50, 0.9) 0%, rgba(160, 60, 40, 0.95) 50%, rgba(120, 50, 35, 0.9) 100%)',
                  boxShadow: '0 8px 32px rgba(180, 70, 40, 0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
                }}
              >
                <CameraIcon />
              </div>
              
              {/* Subtle rotating particle */}
              <div className="absolute inset-0 animate-cinema-orbit">
                <div 
                  className="absolute w-1.5 h-1.5 rounded-full bg-white/30"
                  style={{ top: '-8px', left: '50%', transform: 'translateX(-50%)' }}
                />
              </div>
            </div>
            
            {/* Loading message */}
            <div className="flex flex-col items-center gap-4">
              <motion.p
                key={message}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="text-white/90 text-lg font-medium tracking-wide"
              >
                {message}
              </motion.p>
              
              {/* Progress bar */}
              {showProgress && (
                <div className="relative w-56 h-1 rounded-full overflow-hidden bg-white/[0.08]">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, rgba(200, 80, 50, 0.9) 0%, rgba(220, 120, 80, 1) 50%, rgba(200, 80, 50, 0.9) 100%)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(progress, 5)}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                  {/* Shimmer overlay */}
                  <div 
                    className="absolute inset-0 animate-cinema-shimmer"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                    }}
                  />
                </div>
              )}
              
              {/* Brand tagline */}
              <p className="text-white/30 text-xs tracking-[0.25em] uppercase mt-1">
                Cinema-Grade AI Video
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}));

CinemaLoader.displayName = 'CinemaLoader';

export default CinemaLoader;
