/**
 * AppLoader - Uses unified CinemaLoader component
 * 
 * This component wraps the CinemaLoader to maintain backwards compatibility
 * while ensuring consistent dark-themed loading across the entire application.
 */

import { cn } from '@/lib/utils';
import { forwardRef, useEffect, useState, useRef } from 'react';
import { CinemaLoader } from './CinemaLoader';

interface AppLoaderProps {
  message?: string;
  className?: string;
}

const CINEMATIC_MESSAGES = [
  'Initializing studio...',
  'Loading creative engine...',
  'Preparing your workspace...',
];

export const AppLoader = forwardRef<HTMLDivElement, AppLoaderProps>(
  function AppLoader({ message, className }, ref) {
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const progressRef = useRef(0);
    const displayMessage = message || CINEMATIC_MESSAGES[currentMessageIndex];

    // Rotate through messages
    useEffect(() => {
      if (message) return;
      
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % CINEMATIC_MESSAGES.length);
      }, 2000);
      
      return () => clearInterval(interval);
    }, [message]);

    // Simulate progress
    useEffect(() => {
      const interval = setInterval(() => {
        progressRef.current = Math.min(progressRef.current + Math.random() * 15, 90);
        setProgress(progressRef.current);
      }, 500);

      return () => clearInterval(interval);
    }, []);

    return (
      <div ref={ref} className={cn("contents", className)}>
        <CinemaLoader
          message={displayMessage}
          progress={progress}
          showProgress={true}
          variant="fullscreen"
        />
      </div>
    );
  }
);

AppLoader.displayName = 'AppLoader';
