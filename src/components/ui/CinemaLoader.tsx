/**
 * CinemaLoader - Futuristic holographic loading component
 * 
 * THE SINGLE SOURCE OF TRUTH for all loading states in the application.
 * 
 * Features:
 * - Holographic scanning rings with counter-rotation
 * - Hexagonal grid background pattern
 * - Glitch text effect on loading message
 * - Pulsing energy core with particle orbits
 * - Data stream lines with staggered animation
 * - Pure CSS animations for maximum stability (no framer-motion)
 */

import { memo, useEffect, useRef, forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

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
    const [isExiting, setIsExiting] = useState(false);
    const [isHidden, setIsHidden] = useState(!isVisible);
    const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (isVisible) {
        setIsHidden(false);
        setIsExiting(false);
      } else {
        setIsExiting(true);
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = setTimeout(() => {
          setIsHidden(true);
          onExitComplete?.();
        }, 300);
      }
      return () => { if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current); };
    }, [isVisible, onExitComplete]);

    if (isHidden && !isVisible) return null;

    const containerClasses = cn(
      "flex items-center justify-center overflow-hidden transition-opacity duration-300 ease-in-out",
      variant === 'fullscreen' && "fixed inset-0 z-[9999]",
      variant === 'overlay' && "absolute inset-0 z-50",
      variant === 'inline' && "relative w-full min-h-[400px]",
      isExiting ? "opacity-0" : "opacity-100",
      className
    );

    const clampedProgress = Math.max(progress, 5);

    return (
      <div ref={ref} className={containerClasses} style={{ backgroundColor: '#020208' }}>
        {/* Deep space background */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(99, 102, 241, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 50% 60%, rgba(139, 92, 246, 0.04) 0%, transparent 50%)',
        }} />

        {/* Hex grid pattern - desktop only */}
        <div className="absolute inset-0 hidden md:block opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='52' viewBox='0 0 60 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 16v20L30 52 0 36V16z' fill='none' stroke='%23818cf8' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 52px',
        }} />

        {/* Scanning lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-full h-px animate-holo-scan" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(129, 140, 248, 0.4) 20%, rgba(167, 139, 250, 0.6) 50%, rgba(129, 140, 248, 0.4) 80%, transparent 100%)',
            boxShadow: '0 0 20px 2px rgba(139, 92, 246, 0.3)',
          }} />
          <div className="absolute w-full h-px animate-holo-scan-reverse" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.3) 30%, rgba(129, 140, 248, 0.5) 50%, rgba(99, 102, 241, 0.3) 70%, transparent 100%)',
            boxShadow: '0 0 15px 1px rgba(99, 102, 241, 0.2)',
            animationDelay: '2s',
          }} />
        </div>

        {/* Vertical data streams - desktop only */}
        <div className="absolute inset-0 overflow-hidden hidden md:block pointer-events-none">
          {[15, 35, 55, 75, 85].map((left, i) => (
            <div key={i} className="absolute w-px animate-data-stream" style={{
              left: `${left}%`,
              height: '100%',
              background: `linear-gradient(180deg, transparent 0%, rgba(129, 140, 248, ${0.04 + i * 0.01}) 40%, rgba(167, 139, 250, ${0.06 + i * 0.01}) 50%, rgba(129, 140, 248, ${0.04 + i * 0.01}) 60%, transparent 100%)`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }} />
          ))}
        </div>

        {/* Core content */}
        <div className={cn(
          "relative z-10 flex flex-col items-center gap-8 transition-all duration-400 ease-out",
          isExiting ? "opacity-0 scale-95" : "opacity-100 scale-100 animate-fade-in-up"
        )}>
          {/* Holographic ring system */}
          <div className="relative w-32 h-32 md:w-40 md:h-40">
            {/* Outermost ring - slow rotation */}
            <div className="absolute inset-0 rounded-full animate-holo-ring-1">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(129,140,248,0.15)" strokeWidth="0.5" strokeDasharray="4 8" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(167,139,250,0.1)" strokeWidth="0.3" strokeDasharray="2 12" />
              </svg>
            </div>

            {/* Middle ring - counter rotation with tick marks */}
            <div className="absolute inset-3 md:inset-4 rounded-full animate-holo-ring-2">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(99,102,241,0.25)" strokeWidth="0.8" strokeDasharray="1 5" />
                {/* Tick marks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
                  <line key={angle}
                    x1={50 + 42 * Math.cos(angle * Math.PI / 180)}
                    y1={50 + 42 * Math.sin(angle * Math.PI / 180)}
                    x2={50 + 46 * Math.cos(angle * Math.PI / 180)}
                    y2={50 + 46 * Math.sin(angle * Math.PI / 180)}
                    stroke="rgba(129,140,248,0.3)" strokeWidth="1"
                  />
                ))}
              </svg>
            </div>

            {/* Inner ring - fast rotation, arc segments */}
            <div className="absolute inset-6 md:inset-8 rounded-full animate-holo-ring-3">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M 50 6 A 44 44 0 0 1 94 50" fill="none" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 94 50 A 44 44 0 0 1 50 94" fill="none" stroke="rgba(129,140,248,0.3)" strokeWidth="1" strokeLinecap="round" />
                <path d="M 50 94 A 44 44 0 0 1 6 50" fill="none" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 6 50 A 44 44 0 0 1 50 6" fill="none" stroke="rgba(129,140,248,0.3)" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>

            {/* Energy core */}
            <div className="absolute inset-10 md:inset-12 rounded-full flex items-center justify-center">
              {/* Glow backdrop */}
              <div className="absolute inset-0 rounded-full animate-core-pulse" style={{
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.1) 50%, transparent 70%)',
                filter: 'blur(8px)',
              }} />
              {/* Core shape */}
              <div className="relative w-full h-full rounded-full flex items-center justify-center" style={{
                background: 'radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, rgba(99, 102, 241, 0.05) 60%, transparent 100%)',
                border: '1px solid rgba(129, 140, 248, 0.2)',
                boxShadow: 'inset 0 0 20px rgba(139, 92, 246, 0.15), 0 0 30px rgba(139, 92, 246, 0.1)',
              }}>
                {/* Holographic diamond icon */}
                <svg viewBox="0 0 24 24" className="w-6 h-6 md:w-8 md:h-8 text-indigo-300/90 animate-core-icon" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 9l10 13L22 9z" strokeLinejoin="round" />
                  <path d="M2 9h20" />
                  <path d="M12 2l4 7-4 13-4-13z" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Orbiting particles */}
            <div className="absolute inset-0 hidden md:block animate-holo-ring-1" style={{ animationDuration: '8s' }}>
              <div className="absolute w-1.5 h-1.5 rounded-full bg-indigo-400/60" style={{ top: '2px', left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 6px rgba(129,140,248,0.5)' }} />
            </div>
            <div className="absolute inset-0 hidden md:block animate-holo-ring-2" style={{ animationDuration: '6s' }}>
              <div className="absolute w-1 h-1 rounded-full bg-violet-400/50" style={{ bottom: '5px', left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(167,139,250,0.4)' }} />
            </div>
          </div>

          {/* Loading info */}
          <div className="flex flex-col items-center gap-5">
            {/* Glitch-style message */}
            <div className="relative">
              <p className="text-indigo-100/90 text-lg md:text-xl font-light tracking-[0.15em] uppercase animate-text-flicker">
                {message}
              </p>
              {/* Glitch echo layers - desktop only */}
              <p className="absolute inset-0 text-indigo-400/20 text-lg md:text-xl font-light tracking-[0.15em] uppercase hidden md:block animate-glitch-1" aria-hidden="true">
                {message}
              </p>
              <p className="absolute inset-0 text-violet-400/15 text-lg md:text-xl font-light tracking-[0.15em] uppercase hidden md:block animate-glitch-2" aria-hidden="true">
                {message}
              </p>
            </div>

            {/* Progress bar */}
            {showProgress && (
              <div className="relative w-64 md:w-72">
                {/* Track */}
                <div className="relative h-[2px] rounded-full overflow-hidden" style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  boxShadow: '0 0 8px rgba(99, 102, 241, 0.05)',
                }}>
                  {/* Fill */}
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out" style={{
                    width: `${clampedProgress}%`,
                    background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.6) 0%, rgba(139, 92, 246, 0.9) 50%, rgba(167, 139, 250, 1) 100%)',
                    boxShadow: '0 0 12px rgba(139, 92, 246, 0.5), 0 0 4px rgba(167, 139, 250, 0.8)',
                  }} />
                  {/* Leading glow dot */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-500 ease-out" style={{
                    left: `${clampedProgress}%`,
                    transform: `translate(-50%, -50%)`,
                    background: 'rgba(167, 139, 250, 1)',
                    boxShadow: '0 0 10px rgba(167, 139, 250, 0.8), 0 0 20px rgba(139, 92, 246, 0.4)',
                  }} />
                  {/* Shimmer - desktop only */}
                  <div className="absolute inset-0 hidden md:block animate-cinema-shimmer" style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                  }} />
                </div>
                {/* Percentage */}
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-indigo-300/30 font-mono tracking-wider">SYS.INIT</span>
                  <span className="text-[10px] text-indigo-300/40 font-mono tracking-wider">{Math.round(clampedProgress)}%</span>
                </div>
              </div>
            )}

            {/* Tagline */}
            <p className="text-indigo-300/20 text-[10px] tracking-[0.4em] uppercase font-mono">
              Genesis Engine v2.0
            </p>
          </div>
        </div>
      </div>
    );
  }
));

CinemaLoader.displayName = 'CinemaLoader';
export default CinemaLoader;
