import { memo, useCallback } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryHeroSectionProps {
  onBack: () => void;
  onScrollToAvatars: () => void;
  showAvatarHint: boolean;
}

/**
 * GalleryHeroSection - Navigation buttons for gallery
 * STABILITY: Replaced Framer Motion with CSS animations to prevent crashes
 */
export const GalleryHeroSection = memo(function GalleryHeroSection({
  onBack,
  onScrollToAvatars,
  showAvatarHint,
}: GalleryHeroSectionProps) {
  // STABILITY: Wrap click handlers in try-catch
  const handleBack = useCallback(() => {
    try {
      onBack();
    } catch (e) {
      console.debug('[GalleryHeroSection] Back error:', e);
    }
  }, [onBack]);

  const handleScrollToAvatars = useCallback(() => {
    try {
      onScrollToAvatars();
    } catch (e) {
      console.debug('[GalleryHeroSection] ScrollToAvatars error:', e);
    }
  }, [onScrollToAvatars]);

  return (
    <>
      {/* Premium back button - STABILITY: Using CSS animation instead of motion */}
      <button
        onClick={handleBack}
        className={cn(
          "fixed top-6 left-6 z-50 flex items-center gap-2 text-zinc-500 hover:text-white transition-all duration-300 group",
          "animate-fade-in"
        )}
        style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}
      >
        <div className="w-10 h-10 rounded-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.06] hover:border-white/20 flex items-center justify-center transition-all">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </div>
        <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Back</span>
      </button>
      
      {/* Avatar collection button - STABILITY: Using CSS animation instead of motion */}
      <button
        onClick={handleScrollToAvatars}
        className={cn(
          "fixed bottom-8 left-8 z-50 group",
          "animate-fade-in"
        )}
        style={{ animationDelay: '0.8s', animationFillMode: 'backwards' }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 blur-xl opacity-60 group-hover:opacity-100 transition-opacity scale-110" />
        
        <div className="relative px-6 py-3 rounded-full bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 hover:from-violet-500 hover:to-fuchsia-500 backdrop-blur-xl border border-white/20 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 group-hover:scale-105">
          View Avatar Collection
        </div>
      </button>
      
      {/* Scroll indicator - STABILITY: Using CSS animation instead of motion */}
      {showAvatarHint && (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-4 pointer-events-none",
            "animate-fade-in"
          )}
          style={{ animationDelay: '1.2s', animationFillMode: 'backwards' }}
        >
          <div className="flex flex-col items-center gap-2 animate-bounce">
            <span className="text-white/20 text-xs tracking-wide">Scroll for Avatar Collection</span>
            <ChevronDown className="w-4 h-4 text-white/20" />
          </div>
        </div>
      )}
    </>
  );
});

export default GalleryHeroSection;
