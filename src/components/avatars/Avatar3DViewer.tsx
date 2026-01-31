import React, { useState, useCallback, useRef, useEffect, memo, forwardRef } from 'react';
import { Loader2, RotateCcw, Hand, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Avatar3DViewerProps {
  frontImage: string;
  sideImage?: string | null;
  backImage?: string | null;
  name: string;
  className?: string;
}

type ViewAngle = 'front' | 'side' | 'back';

/**
 * Premium Avatar Viewer with smooth image rotation
 * Uses CSS animations for stability (no framer-motion)
 * Includes forwardRef for animation compatibility
 */
export const Avatar3DViewer = memo(forwardRef<HTMLDivElement, Avatar3DViewerProps>(function Avatar3DViewer({ 
  frontImage, 
  sideImage, 
  backImage, 
  name,
  className = ''
}, ref) {
  const [currentView, setCurrentView] = useState<ViewAngle>('front');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  // Build available views array
  const views: { angle: ViewAngle; image: string; label: string }[] = [
    { angle: 'front', image: frontImage, label: 'Front' },
  ];
  
  if (sideImage) {
    views.push({ angle: 'side', image: sideImage, label: 'Side' });
  }
  
  if (backImage) {
    views.push({ angle: 'back', image: backImage, label: 'Back' });
  }
  
  const currentIndex = views.findIndex(v => v.angle === currentView);
  const currentImage = views[currentIndex]?.image || frontImage;
  const hasMultipleViews = views.length > 1;
  
  const rotateToNext = useCallback(() => {
    if (isTransitioning || !hasMultipleViews || !isMountedRef.current) return;
    setIsTransitioning(true);
    const nextIndex = (currentIndex + 1) % views.length;
    setCurrentView(views[nextIndex].angle);
    setTimeout(() => {
      if (isMountedRef.current) setIsTransitioning(false);
    }, 400);
  }, [currentIndex, views, isTransitioning, hasMultipleViews]);
  
  const rotateToPrev = useCallback(() => {
    if (isTransitioning || !hasMultipleViews || !isMountedRef.current) return;
    setIsTransitioning(true);
    const prevIndex = (currentIndex - 1 + views.length) % views.length;
    setCurrentView(views[prevIndex].angle);
    setTimeout(() => {
      if (isMountedRef.current) setIsTransitioning(false);
    }, 400);
  }, [currentIndex, views, isTransitioning, hasMultipleViews]);
  
  const goToView = useCallback((angle: ViewAngle) => {
    if (isTransitioning || currentView === angle || !isMountedRef.current) return;
    setIsTransitioning(true);
    setCurrentView(angle);
    setTimeout(() => {
      if (isMountedRef.current) setIsTransitioning(false);
    }, 400);
  }, [currentView, isTransitioning]);

  return (
    <div ref={ref} className={cn("relative flex flex-col items-center justify-center h-full", className)}>
      {/* Main Image Display with 3D-like rotation effect */}
      <div className="relative w-full max-w-[320px] aspect-[3/4] mx-auto">
        {/* Ambient glow behind image */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-transparent blur-3xl opacity-50 pointer-events-none" />
        
        {/* Image container with perspective */}
        <div 
          className="relative w-full h-full rounded-2xl overflow-hidden"
          style={{ perspective: '1000px' }}
        >
          {/* Loading state */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-2xl z-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          
          {/* Avatar image with CSS transition */}
          <div
            key={currentView}
            className={cn(
              "w-full h-full transition-all duration-400 ease-out",
              isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
            )}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <img
              src={currentImage}
              alt={`${name} - ${currentView} view`}
              className={cn(
                "w-full h-full object-cover rounded-2xl shadow-2xl transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
            
            {/* Subtle gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none rounded-2xl" />
          </div>
        </div>
        
        {/* Navigation arrows */}
        {hasMultipleViews && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={rotateToPrev}
              disabled={isTransitioning}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={rotateToNext}
              disabled={isTransitioning}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </>
        )}
      </div>
      
      {/* View indicator dots */}
      {hasMultipleViews && (
        <div className="flex items-center gap-3 mt-6">
          {views.map((view) => (
            <button
              key={view.angle}
              onClick={() => goToView(view.angle)}
              disabled={isTransitioning}
              className={cn(
                "relative w-3 h-3 rounded-full transition-all duration-300",
                currentView === view.angle 
                  ? "bg-primary scale-125 shadow-lg shadow-primary/50" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              title={`${view.label} view`}
            />
          ))}
        </div>
      )}
      
      {/* Rotate hint */}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        {hasMultipleViews ? (
          <>
            <RotateCcw className="w-3 h-3" />
            <span>Click arrows or dots to rotate</span>
          </>
        ) : (
          <>
            <Hand className="w-3 h-3" />
            <span>Single view available</span>
          </>
        )}
      </div>
    </div>
  );
}));

Avatar3DViewer.displayName = 'Avatar3DViewer';

export default Avatar3DViewer;
