/**
 * CinematicTransition — Minimal CinemaLoader-based transition
 * 
 * Clean 2-second fade-to-black with the APEX logo, then navigates.
 * Replaces the previous 500+ line particle/ray animation.
 */

import { memo, forwardRef, useEffect, useRef, useState } from 'react';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const TRANSITION_DURATION = 2000;

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete }, ref) {
    const hasNavigated = useRef(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      if (!isActive) {
        hasNavigated.current = false;
        setProgress(0);
        return;
      }

      const start = Date.now();

      const tick = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(elapsed / TRANSITION_DURATION, 1);
        setProgress(t * 100);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const timer = setTimeout(() => {
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          onComplete();
        }
      }, TRANSITION_DURATION + 200);

      return () => clearTimeout(timer);
    }, [isActive, onComplete]);

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-background"
        style={{
          animation: 'fade-in 0.4s ease-out',
        }}
      >
        <CinemaLoader
          isVisible={true}
          message="Entering the studio..."
          progress={progress}
          showProgress={true}
          variant="fullscreen"
        />
      </div>
    );
  }
));

export default CinematicTransition;
