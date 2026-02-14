/**
 * CinematicTransition - Lightweight fade-to-black transition
 * 
 * Replaced the 650-line particle/ray/orb animation monster with a clean
 * 2-second fade using the existing CinemaLoader component.
 */

import { memo, forwardRef, useEffect, useRef, useCallback, useState } from 'react';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete, className }, ref) {
    const hasNavigated = useRef(false);
    const isMountedRef = useRef(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
      if (!isActive) {
        hasNavigated.current = false;
        setProgress(0);
        return;
      }

      // Animate progress from 0 to 100 over 1.5s
      const start = Date.now();
      const duration = 1500;
      const tick = () => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - start;
        const pct = Math.min((elapsed / duration) * 100, 100);
        setProgress(pct);
        if (pct < 100) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);

      // Navigate after 1.5s
      const timer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          onComplete();
        }
      }, 1500);

      return () => clearTimeout(timer);
    }, [isActive, onComplete]);

    if (!isActive) return null;

    return (
      <CinemaLoader
        ref={ref}
        isVisible={isActive}
        message="Entering studio..."
        progress={progress}
        showProgress={true}
        variant="fullscreen"
      />
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
