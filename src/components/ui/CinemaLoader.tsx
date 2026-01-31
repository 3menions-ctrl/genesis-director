/**
 * CinemaLoader - Unified premium dark-themed loading component
 * 
 * THE SINGLE SOURCE OF TRUTH for all loading states in the application.
 * 
 * STABILITY FIX: Removed all framer-motion usage to prevent ref-injection crashes
 * that occur when this component is rendered inside error boundaries or dialogs.
 * Uses pure CSS animations for maximum stability.
 * 
 * Features:
 * - Deep black background with subtle neon accents
 * - Cinematic camera icon with animated rings
 * - Pure CSS transitions (no framer-motion)
 * - Memory cleanup for animations
 * - GPU-accelerated CSS animations
 */

import { memo, useEffect, useRef, forwardRef, useState } from 'react';
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

// Camera icon SVG component - pure React, no refs needed
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
CameraIcon.displayName = 'CameraIcon';

interface CinemaLoaderProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
  isVisible?: boolean;
  onExitComplete?: () => void;
  className?: string;
  variant?: 'fullscreen' | 'inline' | 'overlay';
}

/**
 * CinemaLoader - CSS-only implementation for maximum stability
 * 
 * CRITICAL: This component MUST NOT use framer-motion because:
 * 1. It's rendered inside ErrorBoundary contexts
 * 2. It's rendered inside ProtectedRoute which may manipulate refs
 * 3. AnimatePresence + forwardRef combinations cause crashes
 */
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
    const [isExiting, setIsExiting] = useState(false);
    const [isHidden, setIsHidden] = useState(!isVisible);
    const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Handle visibility changes with CSS transitions
    useEffect(() => {
      if (isVisible) {
        setIsHidden(false);
        setIsExiting(false);
      } else {
        // Start exit animation
        setIsExiting(true);
        
        // Clear any existing timeout
        if (exitTimeoutRef.current) {
          clearTimeout(exitTimeoutRef.current);
        }
        
        // Hide after animation completes
        exitTimeoutRef.current = setTimeout(() => {
          setIsHidden(true);
          onExitComplete?.();
        }, 300); // Match CSS transition duration
      }

      return () => {
        if (exitTimeoutRef.current) {
          clearTimeout(exitTimeoutRef.current);
        }
      };
    }, [isVisible, onExitComplete]);

    // Don't render if fully hidden
    if (isHidden && !isVisible) {
      return null;
    }

    const containerClasses = cn(
      "flex items-center justify-center overflow-hidden transition-opacity duration-300 ease-in-out",
      variant === 'fullscreen' && "fixed inset-0 z-[9999]",
      variant === 'overlay' && "absolute inset-0 z-50",
      variant === 'inline' && "relative w-full min-h-[400px]",
      isExiting ? "opacity-0" : "opacity-100",
      className
    );

    return (
      <div
        ref={ref}
        className={containerClasses}
        style={{ backgroundColor: '#030303' }}
      >
        {/* Deep black base with subtle gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(20, 8, 30, 0.4) 0%, transparent 60%), linear-gradient(180deg, #030303 0%, #050505 50%, #030303 100%)',
          }}
        />
        
        {/* Animated light rays - purple themed */}
        <div className="absolute inset-0 overflow-hidden">
          {LIGHT_RAYS.map((ray, i) => (
            <div
              key={i}
              className="absolute w-px h-[200%] animate-cinema-ray will-change-transform"
              style={{
                left: ray.left,
                top: '-50%',
                transform: `rotate(${ray.rotate}deg)`,
                background: `linear-gradient(180deg, transparent 0%, rgba(168, 85, 247, ${ray.opacity}) 30%, rgba(192, 132, 252, ${ray.opacity * 1.5}) 50%, rgba(168, 85, 247, ${ray.opacity}) 70%, transparent 100%)`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
        
        {/* Subtle ambient glow - purple */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        
        {/* Content container - CSS animation instead of motion */}
        <div
          className={cn(
            "relative z-10 flex flex-col items-center gap-6 transition-all duration-400 ease-out",
            isExiting ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0 animate-fade-in-up"
          )}
        >
          {/* Camera icon with animated rings */}
          <div className="relative">
            {/* Outer pulsing ring */}
            <div className="absolute inset-[-20px] rounded-full border border-white/[0.06] animate-cinema-ring-outer" />
            
            {/* Middle rotating ring */}
            <div className="absolute inset-[-12px] rounded-full border border-white/[0.08] animate-cinema-ring-middle" />
            
            {/* Inner glow ring */}
            <div className="absolute inset-[-4px] rounded-full border border-white/[0.12] animate-cinema-ring-inner" />
            
            {/* Main icon container - purple themed */}
            <div 
              className="relative w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.9) 0%, rgba(139, 92, 246, 0.95) 50%, rgba(124, 58, 237, 0.9) 100%)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
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
            <p
              key={message}
              className="text-white/90 text-lg font-medium tracking-wide animate-fade-in"
            >
              {message}
            </p>
            
            {/* Progress bar - CSS-based, purple themed */}
            {showProgress && (
              <div className="relative w-56 h-1 rounded-full overflow-hidden bg-white/[0.08]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.max(progress, 5)}%`,
                    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.9) 0%, rgba(168, 85, 247, 1) 50%, rgba(139, 92, 246, 0.9) 100%)',
                  }}
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
        </div>
      </div>
    );
  }
));

CinemaLoader.displayName = 'CinemaLoader';

export default CinemaLoader;
