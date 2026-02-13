/**
 * CinemaLoader - Ultra-minimalist premium loading component
 * 
 * THE SINGLE SOURCE OF TRUTH for all loading states in the application.
 * 
 * Design: Apple-level minimalism. Single breathing ring, clean typography,
 * hairline progress bar. Nothing else. The restraint IS the premium feel.
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
        }, 400);
      }
      return () => { if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current); };
    }, [isVisible, onExitComplete]);

    if (isHidden && !isVisible) return null;

    const containerClasses = cn(
      "flex items-center justify-center overflow-hidden",
      variant === 'fullscreen' && "fixed inset-0 z-[9999]",
      variant === 'overlay' && "absolute inset-0 z-50",
      variant === 'inline' && "relative w-full min-h-[400px]",
      className
    );

    const displayProgress = Math.max(progress, 2);

    return (
      <div
        ref={ref}
        className={containerClasses}
        style={{
          backgroundColor: '#030303',
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isExiting ? 0 : 1,
        }}
      >
        {/* Subtle radial ambient — barely there */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.015) 0%, transparent 60%)',
        }} />

        {/* Core content */}
        <div
          className="relative z-10 flex flex-col items-center gap-10"
          style={{
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? 'scale(0.97) translateY(8px)' : 'scale(1) translateY(0)',
          }}
        >
          {/* Breathing ring + logo mark */}
          <div className="relative w-20 h-20">
            {/* Outer breathing ring */}
            <svg
              viewBox="0 0 80 80"
              className="absolute inset-0 w-full h-full"
              style={{ animation: 'loaderSpin 4s linear infinite' }}
            >
              <circle
                cx="40" cy="40" r="38"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.5"
              />
              {/* Arc indicator — rotating progress arc */}
              <circle
                cx="40" cy="40" r="38"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray={`${displayProgress * 2.39} ${238.76 - displayProgress * 2.39}`}
                strokeDashoffset="0"
                style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            </svg>

            {/* Inner breathing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-1.5 h-1.5 rounded-full bg-white/60"
                style={{ animation: 'loaderPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
              />
            </div>
          </div>

          {/* Text block */}
          <div className="flex flex-col items-center gap-4">
            {/* Message */}
            <p className="text-white/50 text-[13px] font-light tracking-[0.2em] uppercase">
              {message}
            </p>

            {/* Progress bar */}
            {showProgress && (
              <div className="w-48">
                <div className="h-px w-full bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${displayProgress}%`,
                      background: 'rgba(255,255,255,0.4)',
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
                <div className="flex justify-end mt-1.5">
                  <span className="text-[10px] text-white/20 font-mono tabular-nums">
                    {Math.round(displayProgress)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes loaderSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes loaderPulse {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.8); }
          }
        `}</style>
      </div>
    );
  }
));

CinemaLoader.displayName = 'CinemaLoader';
export default CinemaLoader;
