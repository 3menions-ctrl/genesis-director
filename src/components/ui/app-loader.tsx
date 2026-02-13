/**
 * AppLoader - Uses unified CinemaLoader component
 * 
 * Wraps CinemaLoader with smooth simulated progress that ALWAYS reaches 100%.
 * Progress curve: fast start → slow middle → guaranteed completion.
 */

import { cn } from '@/lib/utils';
import { forwardRef, useEffect, useState, useRef, useCallback } from 'react';
import { CinemaLoader } from './CinemaLoader';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';

interface AppLoaderProps {
  message?: string;
  className?: string;
}

export const AppLoader = forwardRef<HTMLDivElement, AppLoaderProps>(
  function AppLoader({ message = 'Loading...', className }, ref) {
    const [progress, setProgress] = useState(0);
    const startTimeRef = useRef(Date.now());
    const rafRef = useRef<number>(0);

    const { state: navState } = useNavigationLoading();
    const isGlobalLoading = navState.isLoading;

    // Smooth eased progress that always reaches 100%
    // Uses a curve: fast 0→60, medium 60→85, slow 85→95, then jumps to 100
    const tick = useCallback(() => {
      const elapsed = Date.now() - startTimeRef.current;
      let p: number;

      if (elapsed < 600) {
        // Phase 1: Quick burst to ~55%
        p = (elapsed / 600) * 55;
      } else if (elapsed < 1400) {
        // Phase 2: Ease to ~80%
        p = 55 + ((elapsed - 600) / 800) * 25;
      } else if (elapsed < 2500) {
        // Phase 3: Slow crawl to ~92%
        p = 80 + ((elapsed - 1400) / 1100) * 12;
      } else if (elapsed < 3500) {
        // Phase 4: Crawl to ~97%
        p = 92 + ((elapsed - 2500) / 1000) * 5;
      } else {
        // Phase 5: Complete
        p = 100;
      }

      setProgress(Math.min(Math.round(p), 100));

      if (p < 100) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }, []);

    useEffect(() => {
      startTimeRef.current = Date.now();
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [tick]);

    // If global overlay is showing, render minimal placeholder
    if (isGlobalLoading) {
      return <div ref={ref} className="fixed inset-0 bg-[#030303]" />;
    }

    return (
      <div ref={ref} className={cn("contents", className)}>
        <CinemaLoader
          message={message}
          progress={progress}
          showProgress={true}
          variant="fullscreen"
        />
      </div>
    );
  }
);

AppLoader.displayName = 'AppLoader';
